import type { Request, Response, NextFunction } from "express";
import { sendResponse } from "../shared/api.utils.js";
import * as videosController from "./videos.controller.js";
import * as videosValidator from "./videos.validator.js";

/**
 * Get all videos with optional filters
 */
export async function getVideosHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => videosValidator.validateVideoQuery(req.query),
    async (validatedData) => {
      const { limit = 20, offset = 0, language } = validatedData;
      return await videosController.getVideos(limit, offset, language);
    },
  );
}

/**
 * Get a specific video by ID
 */
export async function getVideoByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => videosValidator.validateVideoId(req.params),
    async (validatedData) => {
      return await videosController.getVideoById(validatedData.id);
    },
  );
}
