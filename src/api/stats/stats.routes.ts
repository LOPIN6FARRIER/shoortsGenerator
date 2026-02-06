import { Router } from "express";
import {
  getDashboardStatsHandler,
  getRecentActivityHandler,
} from "./stats.handler.js";

const router = Router();

// Get dashboard stats
router.get("/", getDashboardStatsHandler);

// Get recent activity
router.get("/activity", getRecentActivityHandler);

export default router;
