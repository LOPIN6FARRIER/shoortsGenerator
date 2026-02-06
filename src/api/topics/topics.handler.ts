import type { Request, Response, NextFunction } from "express";
import { sendResponse } from "../shared/api.utils.js";
import * as topicsController from "./topics.controller.js";
import * as topicsValidator from "./topics.validator.js";

/**
 * Get all topics
 */
export async function getTopicsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => topicsValidator.validateTopicsQuery(req.query),
    async (validatedData) => {
      const { limit = 20, offset = 0 } = validatedData;
      return await topicsController.getTopics(limit, offset);
    },
  );
}
