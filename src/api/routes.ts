import { Router } from "express";
import authRouter from "./auth/auth.routes.js";
import channelsRouter from "./channels/channels.routes.js";
import promptsRouter from "./prompts/prompts.routes.js";
import groupsRouter from "./groups/groups.routes.js";
import configRouter from "./config/config.routes.js";
import videosRouter from "./videos/videos.routes.js";
import statsRouter from "./stats/stats.routes.js";
import pipelineRouter from "./pipeline/pipeline.routes.js";
import topicsRouter from "./topics/topics.routes.js";
import scriptsRouter from "./scripts/scripts.routes.js";
import analyticsRouter from "./analytics/analytics.routes.js";
import youtubeAuthRouter from "./youtube-auth/youtube-auth.routes.js";
import { healthCheckHandler } from "./health/health.handler.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

const router = Router();

// Health check (public)
router.get("/health", healthCheckHandler);

// Auth routes (public)
router.use("/auth", authRouter);

// Protected routes (require authentication)
router.use("/channels", authMiddleware, channelsRouter);
router.use("/prompts", authMiddleware, promptsRouter);
router.use("/groups", authMiddleware, groupsRouter);
router.use("/config", authMiddleware, configRouter);
router.use("/videos", authMiddleware, videosRouter);
router.use("/stats", authMiddleware, statsRouter);
router.use("/pipeline", authMiddleware, pipelineRouter);
router.use("/topics", authMiddleware, topicsRouter);
router.use("/scripts", authMiddleware, scriptsRouter);
router.use("/analytics", authMiddleware, analyticsRouter);
router.use("/youtube-auth", authMiddleware, youtubeAuthRouter);

export default router;
