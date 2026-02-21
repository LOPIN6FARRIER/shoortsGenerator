import { katax } from "katax-service-manager";
import { existsSync, mkdirSync, unlinkSync, rmSync } from "fs";
import { dirname } from "path";

function getKataxLogger() {
  if (!katax.isInitialized) {
    return null;
  }
  return katax.logger;
}

/**
 * Logger class compatible with existing codebase
 */
export class Logger {
  static info(message: string, data?: any): void {
    const kataxLogger = getKataxLogger();
    if (kataxLogger) {
      kataxLogger.info({
        message,
        ...(data && typeof data === "object" ? data : {}),
      });
      return;
    }
    console.info(message, data ?? "");
  }

  static error(message: string, error?: any): void {
    const kataxLogger = getKataxLogger();
    if (kataxLogger) {
      if (error instanceof Error) {
        kataxLogger.error({
          message,
          err: error,
          broadcast: true,
          persist: true,
        });
        return;
      }
      if (error) {
        kataxLogger.error({
          message,
          data: error,
          broadcast: true,
          persist: true,
        });
        return;
      }
      kataxLogger.error({ message, broadcast: true, persist: true });
      return;
    }
    console.error(message, error ?? "");
  }

  static success(message: string): void {
    const kataxLogger = getKataxLogger();
    if (kataxLogger) {
      kataxLogger.info({ message: `✅ ${message}`, broadcast: true });
      return;
    }
    console.info(`✅ ${message}`);
  }

  static warn(message: string, data?: any): void {
    const kataxLogger = getKataxLogger();
    if (kataxLogger) {
      kataxLogger.warn({
        message,
        ...(data && typeof data === "object" ? data : {}),
        broadcast: true,
      });
      return;
    }
    console.warn(message, data ?? "");
  }

  static debug(message: string, data?: any): void {
    const kataxLogger = getKataxLogger();
    if (kataxLogger) {
      kataxLogger.debug({
        message,
        ...(data && typeof data === "object" ? data : {}),
        broadcast: true,
      });
      return;
    }
    console.debug(message, data ?? "");
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
