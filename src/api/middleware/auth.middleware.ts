import { Request, Response, NextFunction } from "express";
import { getPool } from "../../database.js";
import { AuthService } from "../auth/auth.service.js";
import { Logger } from "../../utils.js";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: "admin" | "editor" | "viewer";
      };
    }
  }
}

/**
 * Authentication middleware - Verifies JWT token
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
        message: "No token provided",
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token
    const pool = getPool();
    const authService = new AuthService(pool);
    const user = await authService.verifyToken(token);

    if (!user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired token",
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch (error: any) {
    Logger.error("❌ Auth middleware error:", error.message);
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication failed",
    });
  }
}

/**
 * Role-based authorization middleware
 * @param allowedRoles - Array of roles that can access the route
 */
export function requireRole(...allowedRoles: Array<"admin" | "editor" | "viewer">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware - doesn't fail if no token is provided
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const pool = getPool();
      const authService = new AuthService(pool);
      const user = await authService.verifyToken(token);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    }

    next();
  } catch (error: any) {
    Logger.error("❌ Optional auth middleware error:", error.message);
    next();
  }
}
