import { Router } from "express";
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

const router = Router();

// Health check
router.get("/health", healthCheckHandler);

// Modules
router.use("/channels", channelsRouter);
router.use("/prompts", promptsRouter);
router.use("/groups", groupsRouter);
router.use("/config", configRouter);
router.use("/videos", videosRouter);
router.use("/stats", statsRouter);
router.use("/pipeline", pipelineRouter);
router.use("/topics", topicsRouter);
router.use("/scripts", scriptsRouter);
router.use("/analytics", analyticsRouter);
router.use("/youtube-auth", youtubeAuthRouter);

export default router;
