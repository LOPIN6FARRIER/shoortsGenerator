import pino from "pino";
import { existsSync, mkdirSync, unlinkSync } from "fs";

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Pino logger configuration
 * - Pretty printing in development
 * - JSON logs in production
 */
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

/**
 * Logger class compatible with existing codebase
 */
export class Logger {
  static info(message: string, data?: any): void {
    if (data && typeof data === "object") {
      logger.info(data, message);
    } else {
      logger.info(message);
    }
  }

  static error(message: string, error?: any): void {
    if (error instanceof Error) {
      logger.error({ err: error }, message);
    } else if (error) {
      logger.error({ data: error }, message);
    } else {
      logger.error(message);
    }
  }

  static success(message: string): void {
    logger.info(`✅ ${message}`);
  }

  static warn(message: string, data?: any): void {
    if (data) {
      logger.warn(data, message);
    } else {
      logger.warn(message);
    }
  }

  static debug(message: string, data?: any): void {
    if (data) {
      logger.debug(data, message);
    } else {
      logger.debug(message);
    }
  }
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    Logger.info(`Directorio creado: ${dirPath}`);
  }
}

export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
}

export function cleanupFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      Logger.info(`Archivo eliminado: ${filePath}`);
    }
  } catch (error) {
    Logger.error(`Error al eliminar archivo ${filePath}:`, error);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sanitizeFilename(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
