import type { Request, Response, NextFunction } from "express";
import { sendResponse } from "../shared/api.utils.js";
import * as analyticsController from "./analytics.controller.js";
import * as analyticsValidator from "./analytics.validator.js";

/**
 * Get all analytics records
 */
export async function getAnalyticsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => analyticsValidator.validateAnalyticsQuery(req.query),
    async (validatedData) => {
      const { limit = 50, offset = 0 } = validatedData;
      return await analyticsController.getAnalytics(limit, offset);
    },
  );
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => analyticsValidator.validateEmpty(),
    async () => {
      return await analyticsController.getAnalyticsSummary();
    },
  );
}
