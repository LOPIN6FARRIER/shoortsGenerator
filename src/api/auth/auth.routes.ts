import { Router } from "express";
import {
  loginHandler,
  logoutHandler,
  refreshTokenHandler,
  getMeHandler,
  registerHandler,
  changePasswordHandler,
} from "./auth.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.post("/login", loginHandler);
router.post("/refresh", refreshTokenHandler);

// Protected routes (require authentication)
router.post("/logout", authMiddleware, logoutHandler);
router.get("/me", authMiddleware, getMeHandler);
router.post("/change-password", authMiddleware, changePasswordHandler);

// Admin only routes
router.post("/register", authMiddleware, requireRole("admin"), registerHandler);

export default router;
