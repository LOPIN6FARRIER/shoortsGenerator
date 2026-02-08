import { Request, Response } from "express";
import { getPool } from "../../database.js";
import { AuthService } from "./auth.service.js";
import { Logger } from "../../utils.js";

/**
 * Login handler
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: "Bad Request",
        message: "Email and password are required",
      });
      return;
    }

    const pool = getPool();
    const authService = new AuthService(pool);

    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await authService.login(email, password, ipAddress, userAgent);

    if (!result.success) {
      res.status(401).json({
        error: "Unauthorized",
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    Logger.error("❌ Login handler error:", error.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Login failed",
    });
  }
}

/**
 * Logout handler
 */
export async function logoutHandler(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(400).json({
        error: "Bad Request",
        message: "No token provided",
      });
      return;
    }

    const token = authHeader.substring(7);

    const pool = getPool();
    const authService = new AuthService(pool);

    const success = await authService.logout(token);

    if (success) {
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } else {
      res.status(400).json({
        error: "Bad Request",
        message: "Invalid token",
      });
    }
  } catch (error: any) {
    Logger.error("❌ Logout handler error:", error.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Logout failed",
    });
  }
}

/**
 * Refresh token handler
 */
export async function refreshTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: "Bad Request",
        message: "Refresh token is required",
      });
      return;
    }

    const pool = getPool();
    const authService = new AuthService(pool);

    const result = await authService.refreshAccessToken(refreshToken);

    if (!result.success) {
      res.status(401).json({
        error: "Unauthorized",
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error: any) {
    Logger.error("❌ Refresh token handler error:", error.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Token refresh failed",
    });
  }
}

/**
 * Get current user handler (requires authentication)
 */
export async function getMeHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
      return;
    }

    res.json({
      success: true,
      user: req.user,
    });
  } catch (error: any) {
    Logger.error("❌ Get me handler error:", error.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to get user",
    });
  }
}

/**
 * Register new user handler (admin only)
 */
export async function registerHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({
        error: "Bad Request",
        message: "Email, password, and name are required",
      });
      return;
    }

    const pool = getPool();
    const authService = new AuthService(pool);

    const user = await authService.createUser(email, password, name, role || "viewer");

    if (!user) {
      res.status(400).json({
        error: "Bad Request",
        message: "User creation failed. Email may already exist.",
      });
      return;
    }

    res.status(201).json({
      success: true,
      user,
    });
  } catch (error: any) {
    Logger.error("❌ Register handler error:", error.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Registration failed",
    });
  }
}

/**
 * Change password handler (requires authentication)
 */
export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
      return;
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({
        error: "Bad Request",
        message: "Old password and new password are required",
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        error: "Bad Request",
        message: "New password must be at least 6 characters",
      });
      return;
    }

    const pool = getPool();
    const authService = new AuthService(pool);

    const success = await authService.changePassword(req.user.id, oldPassword, newPassword);

    if (success) {
      res.json({
        success: true,
        message: "Password changed successfully. Please login again.",
      });
    } else {
      res.status(400).json({
        error: "Bad Request",
        message: "Invalid old password",
      });
    }
  } catch (error: any) {
    Logger.error("❌ Change password handler error:", error.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Password change failed",
    });
  }
}
