import { Request, Response, NextFunction } from "express";
import { Logger } from "../../utils.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { method, url } = req;
    const { statusCode } = res;

    const logMessage = `${method} ${url} ${statusCode} - ${duration}ms`;

    if (statusCode >= 500) {
      Logger.error(logMessage);
    } else if (statusCode >= 400) {
      Logger.warn(logMessage);
    } else {
      Logger.info(logMessage);
    }
  });

  next();
}
