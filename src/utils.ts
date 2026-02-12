import pino from "pino";
import { existsSync, mkdirSync, unlinkSync, rmSync } from "fs";
import { dirname } from "path";

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

/**
 * Elimina un directorio completo y todo su contenido
 */
export function cleanupDirectory(dirPath: string): void {
  try {
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
      Logger.success(`📁 Directorio eliminado: ${dirPath}`);
    }
  } catch (error) {
    Logger.error(`Error al eliminar directorio ${dirPath}:`, error);
  }
}

/**
 * Elimina el directorio de un video después de subida exitosa
 * Extrae el path del directorio desde la ruta del video
 */
export function cleanupVideoDirectory(videoPath: string): void {
  try {
    // Obtener el directorio del video (ej: output/es/2026-02-12-title/)
    const videoDir = dirname(videoPath);
    
    if (existsSync(videoDir)) {
      Logger.info(`🧹 Limpiando archivos del video: ${videoDir}`);
      cleanupDirectory(videoDir);
    }
  } catch (error) {
    Logger.error(`Error al limpiar directorio del video ${videoPath}:`, error);
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
