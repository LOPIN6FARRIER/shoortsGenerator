import { writeFileSync } from "fs";
import { join } from "path";

import { Logger } from "./utils.js";
import { Script } from "./script.js";

export interface SubtitleSegment {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * Genera archivo SRT de subtítulos
 * Distribuye el texto del guion en segmentos de tiempo
 */
export function generateSRT(
  script: Script,
  duration: number,
  outputPath: string,
): string {
  Logger.info(`Generando subtítulos SRT para: ${script.title}`);

  // Dividir el guion en oraciones
  const sentences = script.narrative
    .replace(/([.!?])\s+/g, "$1|")
    .split("|")
    .filter((s: string) => s.trim().length > 0);

  const totalSentences = sentences.length;
  const timePerSentence = duration / totalSentences;

  const segments: SubtitleSegment[] = [];

  sentences.forEach((sentence: string, index: number) => {
    const startSeconds = index * timePerSentence;
    const endSeconds = (index + 1) * timePerSentence;

    segments.push({
      index: index + 1,
      startTime: formatSRTTime(startSeconds),
      endTime: formatSRTTime(endSeconds),
      text: sentence.trim(),
    });
  });

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
    `Subtítulos generados: ${srtPath} (${segments.length} segmentos)`,
  );
  return srtPath;
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

/**
 * Genera subtítulos optimizados para YouTube Shorts
 * Máximo 2 líneas por segmento, texto centrado
 */
export function generateShortsOptimizedSRT(
  script: Script,
  duration: number,
  outputPath: string,
): string {
  Logger.info("Generando subtítulos optimizados para Shorts...");

  // Dividir en fragmentos cortos (5-8 palabras por segmento)
  const words = script.narrative.split(/\s+/);
  const segments: SubtitleSegment[] = [];
  const wordsPerSegment = 6;

  let segmentIndex = 1;
  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const segmentWords = words.slice(i, i + wordsPerSegment);
    const text = segmentWords.join(" ");

    const startSeconds = (i / words.length) * duration;
    const endSeconds = ((i + wordsPerSegment) / words.length) * duration;

    segments.push({
      index: segmentIndex++,
      startTime: formatSRTTime(startSeconds),
      endTime: formatSRTTime(Math.min(endSeconds, duration)),
      text,
    });
  }

  const srtContent = segments
    .map(
      (seg) =>
        `${seg.index}\n${seg.startTime} --> ${seg.endTime}\n${seg.text}\n`,
    )
    .join("\n");

  const srtPath = join(outputPath, "subtitles.srt");
  writeFileSync(srtPath, srtContent, "utf-8");

  Logger.success(`Subtítulos optimizados: ${srtPath}`);
  return srtPath;
}
