import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { writeFileSync, unlinkSync, existsSync } from "fs";

import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
import { Script } from "./script.js";
import { getChannelConfig } from "./channels.config.js";

const execAsync = promisify(exec);

export interface TTSResult {
  audioPath: string;
  duration: number;
}

/**
 * 🔥 GENERADOR DE AUDIO OPTIMIZADO PARA CONTENIDO VIRAL
 *
 * Características:
 * - Velocidad ajustable (1.05x-1.1x para ritmo rápido)
 * - Pitch configurable por canal
 * - Soporte futuro para música de fondo
 */
export async function generateTTS(
  script: Script,
  outputDir: string,
): Promise<TTSResult> {
  Logger.info(`Generando TTS para: ${script.title}`);

  const language = script.language as "es" | "en";
  const channelConfig = getChannelConfig(language);
  const voice = channelConfig.audio.voice;

  const audioPath = join(outputDir, "audio.mp3");
  const tempAudioPath = join(outputDir, "audio_temp.mp3");

  // Crear archivo temporal con el texto
  const textPath = join(outputDir, "script.txt");
  writeFileSync(textPath, script.narrative, "utf-8");

  try {
    // ⚡ GENERAR AUDIO CON EDGE-TTS
    // Edge-TTS soporta --rate para velocidad (formato: +X% o -X%)
    const speedPercent = Math.round((channelConfig.audio.voiceSpeed - 1) * 100);
    const rateParam =
      speedPercent > 0 ? `+${speedPercent}%` : `${speedPercent}%`;
    const pitchParam = channelConfig.audio.voicePitch;

    const command = `edge-tts --voice "${voice}" --rate="${rateParam}" --pitch="${pitchParam}" --file "${textPath}" --write-media "${tempAudioPath}"`;
    Logger.info(`Ejecutando: ${command}`);

    await execAsync(command);

    // 🎵 FUTURO: Mezclar con música de fondo si está habilitado
    // if (channelConfig.audio.backgroundMusic.enabled) {
    //   await mixWithBackgroundMusic(tempAudioPath, audioPath, channelConfig);
    // } else {
    //   renameSync(tempAudioPath, audioPath);
    // }

    // Por ahora, simplemente renombrar
    if (existsSync(tempAudioPath)) {
      if (existsSync(audioPath)) unlinkSync(audioPath);
      const renameCommand =
        process.platform === "win32"
          ? `move "${tempAudioPath}" "${audioPath}"`
          : `mv "${tempAudioPath}" "${audioPath}"`;
      await execAsync(renameCommand);
    }

    // Obtener duración del audio con ffprobe
    const durationCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
    const { stdout } = await execAsync(durationCommand);
    const duration = Math.ceil(parseFloat(stdout.trim()));

    // Limpiar archivo temporal
    if (existsSync(textPath)) {
      unlinkSync(textPath);
    }

    Logger.success(
      `✅ Audio generado: ${audioPath} (${duration}s) @ ${channelConfig.audio.voiceSpeed}x speed`,
    );

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
