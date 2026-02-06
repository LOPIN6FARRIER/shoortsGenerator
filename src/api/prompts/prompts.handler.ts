import type { Request, Response } from "express";
import {
  getPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "./prompts.controller.js";
import * as promptsValidator from "./prompts.validator.js";
import { sendResponse } from "../shared/api.utils.js";

export async function getPromptsHandler(req: Request, res: Response) {
  return sendResponse(
    req,
    res,
    () => promptsValidator.validatePromptQuery(req.query),
    async (validatedData) => {
      const { channel_id, type, enabled } = validatedData;
      return getPrompts({ channel_id, type, enabled });
    },
  );
}

export async function getPromptHandler(req: Request, res: Response) {
  return sendResponse(
    req,
    res,
    () => promptsValidator.validatePromptId(req.params),
    async (validatedData) => {
      return getPrompt(validatedData.id);
    },
  );
}

export async function createPromptHandler(req: Request, res: Response) {
  return sendResponse(
    req,
    res,
    () => promptsValidator.validateCreatePrompt(req.body),
    async (validatedData) => {
      return createPrompt(validatedData);
    },
  );
}

export async function updatePromptHandler(req: Request, res: Response) {
  return sendResponse(
    req,
    res,
    () => promptsValidator.validateUpdatePrompt(req.body),
    async (validatedData) => {
      const { id } = req.params;
      return updatePrompt(id, validatedData);
    },
  );
}

export async function deletePromptHandler(req: Request, res: Response) {
  return sendResponse(
    req,
    res,
    () => promptsValidator.validatePromptId(req.params),
    async (validatedData) => {
      return deletePrompt(validatedData.id);
    },
  );
}
