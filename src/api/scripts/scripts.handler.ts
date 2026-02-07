import type { Request, Response, NextFunction } from "express";
import { sendResponse } from "../shared/api.utils.js";
import * as scriptsController from "./scripts.controller.js";
import * as scriptsValidator from "./scripts.validator.js";

/**
 * Get all scripts with optional filters
 */
export async function getScriptsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => scriptsValidator.validateScriptsQuery(req.query),
    async (validatedData) => {
      const { limit = 20, offset = 0, language } = validatedData;
      return await scriptsController.getScripts(limit, offset, language);
    },
  );
}

/**
 * Get script by ID
 */
export async function getScriptByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await sendResponse(
    req,
    res,
    () => scriptsValidator.validateScriptId(req.params),
    async (validatedData) => {
      return await scriptsController.getScriptById(validatedData.id);
    },
  );
}
