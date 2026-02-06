import { Router } from "express";
import channelsRouter from "./channels/channels.routes.js";
import promptsRouter from "./prompts/prompts.routes.js";
import configRouter from "./config/config.routes.js";
import videosRouter from "./videos/videos.routes.js";
import { healthCheckHandler } from "./health/health.handler.js";

const router = Router();

// Health check
router.get("/health", healthCheckHandler);

// Modules
router.use("/channels", channelsRouter);
router.use("/prompts", promptsRouter);
router.use("/config", configRouter);
router.use("/videos", videosRouter);

export default router;
