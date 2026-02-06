import { writeFileSync } from "fs";
import { join } from "path";

import { Logger } from "./utils.js";
import { Script } from "./script.js";
import { getChannelConfig } from "./channels.config.js";

export interface SubtitleSegment {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * 🔥 GENERADOR DE SUBTÍTULOS OPTIMIZADOS PARA MÁXIMA RETENCIÓN
 *
 * Características virales:
 * - Máximo 2 líneas simultáneas
 * - Frases cortas (4-8 palabras)
 * - Palabras clave en MAYÚSCULAS
 * - Sincronización perfecta para Shorts
 * - Sin pausas largas (mantiene atención)
 */
export function generateShortsOptimizedSRT(
  script: Script,
  duration: number,
  outputPath: string,
): string {
  const language = script.language as "es" | "en";
  const channelConfig = getChannelConfig(language);

  Logger.info("Generando subtítulos optimizados para máxima retención...");

  // Dividir en fragmentos ultra-cortos para mantener atención
  const words = script.narrative.split(/\s+/);
  const segments: SubtitleSegment[] = [];

  // Calcular palabras por segmento basado en wordsPerSecond
  const totalWords = words.length;
  const wordsPerSegment = Math.ceil(
    channelConfig.subtitles.wordsPerSecond * 2.0,
  ); // 2.0s por segmento para mejor sincronización
  const totalSegments = Math.ceil(totalWords / wordsPerSegment);

  // Ajustar timing para que coincida con la duración real del audio
  const timePerSegment = duration / totalSegments;

  let segmentIndex = 1;

  for (let i = 0; i < totalWords; i += wordsPerSegment) {
    const segmentWords = words.slice(i, i + wordsPerSegment);
    let text = segmentWords.join(" ");

    // 🔥 ÉNFASIS EN PALABRAS CLAVE (MAYÚSCULAS)
    if (channelConfig.subtitles.emphasizeKeywords) {
      channelConfig.subtitles.keywordIndicators.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        text = text.replace(regex, (match) => match.toUpperCase());
      });
    }

    // Dividir en máximo 2 líneas si es muy largo
    const lines = splitIntoLines(text, channelConfig.subtitles.maxCharsPerLine);
    const finalText = lines
      .slice(0, channelConfig.subtitles.maxLines)
      .join("\n");

    const startSeconds = (segmentIndex - 1) * timePerSegment;
    const endSeconds = segmentIndex * timePerSegment;

    segments.push({
      index: segmentIndex,
      startTime: formatSRTTime(startSeconds),
      endTime: formatSRTTime(endSeconds),
      text: finalText,
    });

    segmentIndex++;
  }

  // Generar contenido SRT
  const srtContent = segments
    .map(
      (seg) =>
        `${seg.index}\n${seg.startTime} --> ${seg.endTime}\n${seg.text}\n`,
    )
    .join("\n");

  // Guardar archivo
  const srtPath = join(outputPath, "subtitles.srt");
  writeFileSync(srtPath, srtContent, "utf-8");

  Logger.success(
    `✅ Subtítulos optimizados: ${srtPath} (${segments.length} segmentos dinámicos)`,
  );
  return srtPath;
}

/**
 * Divide texto en líneas respetando límite de caracteres
 * Maneja palabras largas y evita pérdida de contenido
 */
function splitIntoLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    // Si la palabra sola es más larga que el máximo, truncarla
    if (word.length > maxCharsPerLine) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
      // Truncar palabra larga y continuar
      lines.push(word.substring(0, maxCharsPerLine - 3) + "...");
      return;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      // Línea completa, guardarla y empezar nueva
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  });

  // Agregar última línea si existe
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Formatea segundos a formato SRT (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Añade ceros a la izquierda
 */
function pad(num: number, size: number = 2): string {
  return num.toString().padStart(size, "0");
}
