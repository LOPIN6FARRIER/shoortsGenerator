import { Request, Response } from "express";
import { sendResponse } from "../shared/api.utils.js";
import { getDashboardStats, getRecentActivity } from "./stats.controller.js";
import { validateLimitParam } from "./stats.validator.js";

export async function getDashboardStatsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => ({ isValid: true }),
    () => getDashboardStats(),
  );
}

export async function getRecentActivityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () =>
      validateLimitParam({
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      }),
    (valid: any) => getRecentActivity(valid.limit),
  );
}
