import { Pool } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Logger } from "../../utils.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface LoginResult {
  success: boolean;
  user?: Omit<User, "password_hash">;
  token?: string;
  refreshToken?: string;
  error?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export class AuthService {
  constructor(private pool: Pool) {}

  /**
   * Authenticate user with email and password
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    try {
      // Find user by email
      const userResult = await this.pool.query(
        `SELECT id, email, password_hash, name, role, is_active, last_login_at, created_at, updated_at
         FROM users 
         WHERE email = $1`,
        [email],
      );

      if (userResult.rows.length === 0) {
        await this.logAuthEvent(null, "failed_login", email, ipAddress, userAgent, false, "User not found");
        return { success: false, error: "Invalid credentials" };
      }

      const user = userResult.rows[0];

      // Check if user is active
      if (!user.is_active) {
        await this.logAuthEvent(user.id, "failed_login", email, ipAddress, userAgent, false, "Account inactive");
        return { success: false, error: "Account is inactive" };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        await this.logAuthEvent(user.id, "failed_login", email, ipAddress, userAgent, false, "Invalid password");
        return { success: false, error: "Invalid credentials" };
      }

      // Generate JWT token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Generate refresh token
      const refreshToken = await this.createRefreshToken(user.id);

      // Create session
      await this.createSession(user.id, token, ipAddress, userAgent);

      // Update last login
      await this.pool.query(
        "UPDATE users SET last_login_at = NOW() WHERE id = $1",
        [user.id],
      );

      // Log successful login
      await this.logAuthEvent(user.id, "login", email, ipAddress, userAgent, true);

      // Remove password_hash from response
      const { password_hash, ...userWithoutPassword } = user;

      Logger.info(`✅ User logged in: ${email}`);

      return {
        success: true,
        user: userWithoutPassword,
        token,
        refreshToken,
      };
    } catch (error: any) {
      Logger.error("❌ Login error:", error.message);
      await this.logAuthEvent(null, "failed_login", email, ipAddress, userAgent, false, error.message);
      return { success: false, error: "Login failed" };
    }
  }

  /**
   * Verify JWT token and return user
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;

      // Check if session exists and is valid
      const sessionResult = await this.pool.query(
        `SELECT s.id, s.expires_at, u.id, u.email, u.name, u.role, u.is_active
         FROM sessions s
         INNER JOIN users u ON s.user_id = u.id
         WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = true`,
        [token],
      );

      if (sessionResult.rows.length === 0) {
        return null;
      }

      const user = sessionResult.rows[0];
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error: any) {
      Logger.error("❌ Token verification error:", error.message);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<LoginResult> {
    try {
      // Find refresh token
      const tokenResult = await this.pool.query(
        `SELECT rt.user_id, u.email, u.name, u.role, u.is_active
         FROM refresh_tokens rt
         INNER JOIN users u ON rt.user_id = u.id
         WHERE rt.token = $1 AND rt.expires_at > NOW() AND u.is_active = true`,
        [refreshToken],
      );

      if (tokenResult.rows.length === 0) {
        return { success: false, error: "Invalid refresh token" };
      }

      const user = tokenResult.rows[0];

      // Generate new access token
      const newToken = this.generateToken({
        userId: user.user_id,
        email: user.email,
        role: user.role,
      });

      // Create new session
      await this.createSession(user.user_id, newToken);

      await this.logAuthEvent(user.user_id, "token_refresh", user.email, undefined, undefined, true);

      return {
        success: true,
        token: newToken,
        user: {
          id: user.user_id,
          email: user.email,
          name: user.name,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      };
    } catch (error: any) {
      Logger.error("❌ Token refresh error:", error.message);
      return { success: false, error: "Token refresh failed" };
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(token: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "DELETE FROM sessions WHERE token = $1 RETURNING user_id",
        [token],
      );

      if (result.rows.length > 0) {
        await this.logAuthEvent(result.rows[0].user_id, "logout", undefined, undefined, undefined, true);
        Logger.info(`✅ User logged out`);
        return true;
      }

      return false;
    } catch (error: any) {
      Logger.error("❌ Logout error:", error.message);
      return false;
    }
  }

  /**
   * Create new user (registration)
   */
  async createUser(
    email: string,
    password: string,
    name: string,
    role: "admin" | "editor" | "viewer" = "viewer",
  ): Promise<User | null> {
    try {
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const result = await this.pool.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role, is_active, created_at, updated_at`,
        [email, passwordHash, name, role],
      );

      Logger.success(`✅ User created: ${email}`);
      return result.rows[0];
    } catch (error: any) {
      Logger.error("❌ Create user error:", error.message);
      return null;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Get current password hash
      const userResult = await this.pool.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [userId],
      );

      if (userResult.rows.length === 0) {
        return false;
      }

      // Verify old password
      const isValid = await bcrypt.compare(oldPassword, userResult.rows[0].password_hash);
      if (!isValid) {
        return false;
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.pool.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [newPasswordHash, userId],
      );

      // Invalidate all sessions
      await this.pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);

      Logger.info(`✅ Password changed for user: ${userId}`);
      return true;
    } catch (error: any) {
      Logger.error("❌ Change password error:", error.message);
      return false;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  /**
   * Create session in database
   */
  private async createSession(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    await this.pool.query(
      `INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, token, ipAddress, userAgent, expiresAt],
    );
  }

  /**
   * Create refresh token
   */
  private async createRefreshToken(userId: string): Promise<string> {
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: `${REFRESH_TOKEN_EXPIRES_DAYS}d` } as jwt.SignOptions);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

    await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt],
    );

    return token;
  }

  /**
   * Log authentication event
   */
  private async logAuthEvent(
    userId: string | null,
    action: string,
    email?: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = false,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO auth_audit_log (user_id, action, email, ip_address, user_agent, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, action, email, ipAddress, userAgent, success, errorMessage],
      );
    } catch (error: any) {
      Logger.error("❌ Error logging auth event:", error.message);
    }
  }

  /**
   * Clean expired sessions and tokens
   */
  async cleanExpiredTokens(): Promise<void> {
    try {
      const sessionsResult = await this.pool.query("SELECT clean_expired_sessions()");
      const tokensResult = await this.pool.query("SELECT clean_expired_refresh_tokens()");
      
      Logger.info(`🧹 Cleaned ${sessionsResult.rows[0].clean_expired_sessions} expired sessions`);
      Logger.info(`🧹 Cleaned ${tokensResult.rows[0].clean_expired_refresh_tokens} expired refresh tokens`);
    } catch (error: any) {
      Logger.error("❌ Error cleaning expired tokens:", error.message);
    }
  }
}
