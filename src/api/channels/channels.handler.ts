import { Request, Response } from "express";
import { sendResponse } from "../shared/api.utils.js";
import {
  getChannels,
  getChannel,
  createChannel,
  updateChannel,
  deleteChannel,
} from "./channels.controller.js";
import {
  validateCreateChannelBody,
  validateUpdateChannelBody,
  validateIdParam,
} from "./channels.validator.js";

export async function getChannelsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => ({ isValid: true }),
    () => getChannels(),
  );
}

export async function getChannelHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => validateIdParam({ id: req.params.id }),
    (valid: any) => getChannel(valid.id),
  );
}

export async function createChannelHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => validateCreateChannelBody(req.body),
    (valid) => createChannel(valid),
  );
}

export async function updateChannelHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    async () => {
      const idCheck = await validateIdParam({ id: req.params.id });
      if (!idCheck.isValid) return idCheck as any;
      return validateUpdateChannelBody(req.body) as any;
    },
    (valid: any) => updateChannel(req.params.id, valid),
  );
}

export async function deleteChannelHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await sendResponse(
    req,
    res,
    () => validateIdParam({ id: req.params.id }),
    (valid: any) => deleteChannel(valid.id),
  );
}
