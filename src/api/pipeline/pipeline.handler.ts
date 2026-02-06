import type { Request, Response, NextFunction } from "express";
import { sendResponse } from "../shared/api.utils.js";
import * as pipelineController from "./pipeline.controller.js";
import * as pipelineValidator from "./pipeline.validator.js";

/**
 * Get all pipeline executions
 */
export async function getPipelineExecutionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => pipelineValidator.validatePipelineQuery(req.query),
    async (validatedData) => {
      const { limit = 20, offset = 0 } = validatedData;
      return await pipelineController.getPipelineExecutions(limit, offset);
    },
  );
}

/**
 * Get a specific pipeline execution by ID
 */
export async function getPipelineExecutionByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => pipelineValidator.validatePipelineId(req.params),
    async (validatedData) => {
      return await pipelineController.getPipelineExecutionById(
        validatedData.id,
      );
    },
  );
}
