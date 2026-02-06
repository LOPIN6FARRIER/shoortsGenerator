import { Router } from "express";
import {
  getAnalyticsHandler,
  getAnalyticsSummaryHandler,
} from "./analytics.handler.js";

const router = Router();

router.get("/", getAnalyticsHandler);
router.get("/summary", getAnalyticsSummaryHandler);

export default router;
