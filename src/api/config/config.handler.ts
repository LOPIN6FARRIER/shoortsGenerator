import { Request, Response } from "express";
import { sendResponse } from "../shared/api.utils.js";
import {
  getConfigs,
  getConfig,
  upsertConfig,
  bulkUpdateConfig,
  deleteConfig,
} from "./config.controller.js";
import {
  validateConfigBody,
  validateBulkUpdateBody,
  validateKeyParam,
} from "./config.validator.js";

export async function getConfigsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => ({ isValid: true }),
    () => getConfigs(),
  );
}

export async function getConfigHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => validateKeyParam({ key: req.params.key }),
    (valid: any) => getConfig(valid.key),
  );
}

export async function upsertConfigHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => validateConfigBody(req.body),
    (valid) => upsertConfig(valid),
  );
}

export async function bulkUpdateConfigHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => validateBulkUpdateBody(req.body),
    (valid: any) => bulkUpdateConfig(valid.configs),
  );
}

export async function deleteConfigHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => validateKeyParam({ key: req.params.key }),
    (valid: any) => deleteConfig(valid.key),
  );
}
