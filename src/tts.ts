import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { writeFileSync, unlinkSync, existsSync } from "fs";

import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
import { Script } from "./script.js";

const execAsync = promisify(exec);

export interface TTSResult {
  audioPath: string;
  duration: number;
}

/**
 * Genera audio usando Edge TTS
 * Requiere que edge-tts esté instalado: pip install edge-tts
 */
export async function generateTTS(
  script: Script,
  outputDir: string,
): Promise<TTSResult> {
  Logger.info(`Generando TTS para: ${script.title}`);

  const voice =
    script.language === "es"
      ? CONFIG.channels.es.voice
      : CONFIG.channels.en.voice;

  const audioPath = join(outputDir, "audio.mp3");

  // Crear archivo temporal con el texto
  const textPath = join(outputDir, "script.txt");
  writeFileSync(textPath, script.narrative, "utf-8");

  try {
    // Ejecutar edge-tts
    const command = `edge-tts --voice "${voice}" --file "${textPath}" --write-media "${audioPath}"`;
    Logger.info(`Ejecutando: ${command}`);

    await execAsync(command);

    // Obtener duración del audio con ffprobe
    const durationCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
    const { stdout } = await execAsync(durationCommand);
    const duration = Math.ceil(parseFloat(stdout.trim()));

    // Limpiar archivo temporal
    if (existsSync(textPath)) {
      unlinkSync(textPath);
    }

    Logger.success(`Audio generado: ${audioPath} (${duration}s)`);

    return {
      audioPath,
      duration,
    };
  } catch (error: any) {
    Logger.error("Error generando TTS:", error.message);
    throw new Error(`Error en TTS: ${error.message}`);
  }
}

/**
 * Verifica que edge-tts esté instalado
 */
export async function checkEdgeTTS(): Promise<boolean> {
  try {
    await execAsync("edge-tts --version");
    Logger.success("edge-tts detectado correctamente");
    return true;
  } catch (error) {
    Logger.error("edge-tts no encontrado. Instala con: pip install edge-tts");
    return false;
  }
}

/**
 * Lista las voces disponibles en Edge TTS (útil para configuración)
 */
export async function listVoices(language?: string): Promise<void> {
  try {
    const command = language
      ? `edge-tts --list-voices | grep "${language}"`
      : "edge-tts --list-voices";

    const { stdout } = await execAsync(command);
    console.log(stdout);
  } catch (error: any) {
    Logger.error("Error listando voces:", error.message);
  }
}
