import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import OpenAI from "openai";

import { Logger } from "./utils.js";
import { Script } from "./script.js";
import { getChannelConfig } from "./channels.config.js";
import { CONFIG } from "./config.js";

export interface SubtitleSegment {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!CONFIG.openai.apiKey) {
    throw new Error(
      "⚠️  OPENAI_API_KEY no configurada. Whisper API requiere OpenAI.\n" +
        "   💡 Alternativa: Instalar whisper.cpp localmente para transcripción sin API.",
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: CONFIG.openai.apiKey });
  }

  return openaiClient;
}

/**
 * 🔥 GENERADOR DE SUBTÍTULOS CON WHISPER
 *
 * Características:
 * - Timing perfecto palabra por palabra usando Whisper
 * - Sincronización automática con el audio
 * - Detecta pausas naturales
 * - Agrupa palabras en segmentos óptimos
 */
export async function generateShortsOptimizedSRT(
  script: Script,
  audioPath: string,
  outputPath: string,
): Promise<string> {
  const language = script.language as "es" | "en";
  const channelConfig = getChannelConfig(language);

  Logger.info("Generando subtítulos con Whisper AI (timing perfecto)...");

  try {
    // 1. Transcribir audio con Whisper para obtener timestamps
    const words = await transcribeWithWhisper(audioPath, language);

    // 2. Agrupar palabras en segmentos óptimos para Shorts
    const segments = groupWordsIntoSegments(
      words,
      channelConfig.subtitles.maxCharsPerLine,
      channelConfig.subtitles.maxLines,
    );

    // 3. Aplicar énfasis a palabras clave si está habilitado
    if (channelConfig.subtitles.emphasizeKeywords) {
      segments.forEach((seg) => {
        channelConfig.subtitles.keywordIndicators.forEach((keyword) => {
          const regex = new RegExp(`\\b${keyword}\\b`, "gi");
          seg.text = seg.text.replace(regex, (match) => match.toUpperCase());
        });
      });
    }

    // 4. Generar contenido SRT
    const srtContent = segments
      .map(
        (seg) =>
          `${seg.index}\n${seg.startTime} --> ${seg.endTime}\n${seg.text}\n`,
      )
      .join("\n");

    // 5. Guardar archivo
    const srtPath = join(outputPath, "subtitles.srt");
    writeFileSync(srtPath, srtContent, "utf-8");

    Logger.success(
      `✅ Subtítulos Whisper: ${srtPath} (${segments.length} segmentos con timing perfecto)`,
    );
    return srtPath;
  } catch (error: any) {
    Logger.warn(`⚠️  Error con Whisper, usando fallback: ${error.message}`);
    // Fallback al método anterior si Whisper falla
    return generateFallbackSRT(script, audioPath, outputPath);
  }
}

/**
 * Transcribe audio con Whisper y obtiene timestamps palabra por palabra
 */
async function transcribeWithWhisper(
  audioPath: string,
  language: string,
): Promise<WhisperWord[]> {
  const client = getOpenAIClient();

  Logger.info("🎤 Transcribiendo audio con Whisper...");

  const audioFile = readFileSync(audioPath);
  const audioBlob = new File([audioFile], "audio.mp3", { type: "audio/mpeg" });

  const response = await client.audio.transcriptions.create({
    file: audioBlob,
    model: "whisper-1",
    language: language,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  // @ts-ignore - La API retorna words cuando se pide word timestamps
  const words: WhisperWord[] = response.words || [];

  Logger.info(`✅ Whisper detectó ${words.length} palabras con timestamps`);

  return words;
}

/**
 * Agrupa palabras en segmentos óptimos para Shorts
 */
function groupWordsIntoSegments(
  words: WhisperWord[],
  maxCharsPerLine: number,
  maxLines: number,
): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const maxCharsTotal = maxLines * maxCharsPerLine;

  let currentSegment: WhisperWord[] = [];
  let currentLength = 0;
  let segmentIndex = 1;

  words.forEach((word, index) => {
    const wordLength = word.word.trim().length;
    const testLength =
      currentLength + wordLength + (currentSegment.length > 0 ? 1 : 0);

    // Si agregar esta palabra excede el límite, crear nuevo segmento
    if (testLength > maxCharsTotal && currentSegment.length > 0) {
      segments.push(
        createSegment(currentSegment, segmentIndex, maxCharsPerLine),
      );
      segmentIndex++;
      currentSegment = [word];
      currentLength = wordLength;
    } else {
      currentSegment.push(word);
      currentLength = testLength;
    }
  });

  // Agregar último segmento
  if (currentSegment.length > 0) {
    segments.push(createSegment(currentSegment, segmentIndex, maxCharsPerLine));
  }

  return segments;
}

/**
 * Crea un segmento SRT desde palabras con timestamps
 */
function createSegment(
  words: WhisperWord[],
  index: number,
  maxCharsPerLine: number,
): SubtitleSegment {
  const text = words.map((w) => w.word.trim()).join(" ");
  const startTime = formatSRTTime(words[0].start);
  const endTime = formatSRTTime(words[words.length - 1].end);

  // Dividir en líneas si es necesario
  const lines = splitIntoLines(text, maxCharsPerLine);
  const finalText = lines.slice(0, 2).join("\n");

  return {
    index,
    startTime,
    endTime,
    text: finalText,
  };
}

/**
 * Fallback: Genera subtítulos sin Whisper (método anterior)
 */
function generateFallbackSRT(
  script: Script,
  audioPath: string,
  outputPath: string,
): string {
  const language = script.language as "es" | "en";
  const channelConfig = getChannelConfig(language);

  Logger.info("Usando método de timing manual (fallback)...");

  // Estimar duración basada en palabras
  const words = script.narrative.split(/\s+/);
  const estimatedDuration =
    words.length / channelConfig.subtitles.wordsPerSecond;

  const avgCharsPerWord = language === "es" ? 5.5 : 4.7;
  const maxCharsTotal =
    channelConfig.subtitles.maxLines * channelConfig.subtitles.maxCharsPerLine;
  const wordsPerSegment = Math.floor(maxCharsTotal / avgCharsPerWord);
  const totalSegments = Math.ceil(words.length / wordsPerSegment);
  const timePerSegment = estimatedDuration / totalSegments;

  const segments: SubtitleSegment[] = [];
  let segmentIndex = 1;

  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const segmentWords = words.slice(i, i + wordsPerSegment);
    let text = segmentWords.join(" ");

    if (channelConfig.subtitles.emphasizeKeywords) {
      channelConfig.subtitles.keywordIndicators.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        text = text.replace(regex, (match) => match.toUpperCase());
      });
    }

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

  const srtContent = segments
    .map(
      (seg) =>
        `${seg.index}\n${seg.startTime} --> ${seg.endTime}\n${seg.text}\n`,
    )
    .join("\n");

  const srtPath = join(outputPath, "subtitles.srt");
  writeFileSync(srtPath, srtContent, "utf-8");

  Logger.success(
    `✅ Subtítulos fallback: ${srtPath} (${segments.length} segmentos)`,
  );
  return srtPath;
}

/**
 * Divide texto en líneas respetando límite de caracteres
 * Maneja palabras largas de manera inteligente
 */
function splitIntoLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    // Si la palabra sola es más larga que el máximo, dividirla con guion
    if (word.length > maxCharsPerLine) {
      if (currentLine) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      // Dividir palabra larga en partes con guion
      const chunkSize = maxCharsPerLine - 1; // Espacio para el guion
      for (let i = 0; i < word.length; i += chunkSize) {
        const chunk = word.substring(i, i + chunkSize);
        if (i + chunkSize < word.length) {
          lines.push(chunk + "-");
        } else {
          currentLine = chunk;
        }
      }
      return;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      // Línea completa, guardarla y empezar nueva
      if (currentLine) {
        lines.push(currentLine.trim());
      }
      currentLine = word;
    }
  });

  // Agregar última línea si existe
  if (currentLine) {
    lines.push(currentLine.trim());
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
