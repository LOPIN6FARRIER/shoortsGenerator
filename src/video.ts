import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { unlinkSync, existsSync, writeFileSync } from "fs";

import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
import { Script } from "./script.js";
import { downloadTopicImages } from "./images.js";
import { getChannelConfig } from "./channels.config.js";

const execAsync = promisify(exec);

export interface VideoResult {
  videoPath: string;
  width: number;
  height: number;
  duration: number;
}

/**
 * 🔥 GENERADOR DE VIDEO OPTIMIZADO PARA MÁXIMA RETENCIÓN
 *
 * Características virales:
 * - Ken Burns effect (zoom lento y fluido)
 * - Pan vertical suave
 * - Cambios visuales cada 2-3 segundos
 * - Transiciones dinámicas
 * - Subtítulos con estilo de identidad de canal
 * - Formato vertical perfecto 9:16
 */
export async function generateVideo(
  script: Script,
  audioPath: string,
  srtPath: string,
  outputDir: string,
): Promise<VideoResult> {
  Logger.info(`Generando video para: ${script.title}`);

  const { width, height, fps } = CONFIG.video;
  const language = script.language as "es" | "en";
  const channelConfig = getChannelConfig(language);
  const outputVideoPath = join(outputDir, "final.mp4");

  // Obtener duración del audio
  const durationCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
  const { stdout } = await execAsync(durationCommand);
  const duration = parseFloat(stdout.trim());

  // Intentar descargar imágenes del topic
  Logger.info("Descargando imágenes del topic...");
  const imagePaths = await downloadTopicImages(script.topic, outputDir, 4);

  let backgroundInput: string;
  let filterComplex: string;

  if (imagePaths.length >= 3) {
    // MODO: Slideshow con imágenes + efectos Ken Burns + Pan vertical
    Logger.info(
      `🎬 Generando video con ${imagePaths.length} imágenes + efectos dinámicos...`,
    );

    const imageDuration = channelConfig.video.imageDisplayTime;
    const totalImageTime = imagePaths.length * imageDuration;
    const adjustedImageDuration = duration / imagePaths.length;

    // Crear inputs para cada imagen con duración
    const imageInputs = imagePaths
      .map((p) => `-loop 1 -t ${adjustedImageDuration} -i "${p}"`)
      .join(" ");

    // 🔥 CREAR FILTER_COMPLEX CON KEN BURNS + PAN VERTICAL
    const videoFilters = imagePaths
      .map((_, i) => {
        const kenBurnsDirection =
          channelConfig.video.kenBurns.direction === "alternate"
            ? i % 2 === 0
              ? "in"
              : "out"
            : channelConfig.video.kenBurns.direction;

        const zoomIntensity = channelConfig.video.kenBurns.zoomIntensity;

        // Ken Burns: zoom gradual
        const kenBurnsEffect =
          kenBurnsDirection === "in"
            ? `zoompan=z='min(zoom+0.0015,${zoomIntensity})':d=${adjustedImageDuration * fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}`
            : `zoompan=z='if(lte(zoom,1.0),${zoomIntensity},max(1.001,zoom-0.0015))':d=${adjustedImageDuration * fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}`;

        // Pan vertical suave (opcional)
        const panEffect = channelConfig.video.pan.enabled
          ? `,crop=iw:ih*0.8:0:'if(lte(t,${adjustedImageDuration}/2),0,ih*0.2*(t-${adjustedImageDuration}/2)/(${adjustedImageDuration}/2))' `
          : "";

        return `[${i}:v]${kenBurnsEffect},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuv420p[v${i}]`;
      })
      .join(";");

    const concatInputs = imagePaths.map((_, i) => `[v${i}]`).join("");
    const audioIndex = imagePaths.length;

    // 🎨 SUBTÍTULOS CON ESTILO DE IDENTIDAD DE CANAL
    const subtitleStyle = [
      `FontName=${channelConfig.visual.fontFamily}`,
      `FontSize=${channelConfig.visual.fontSize}`,
      `Bold=${channelConfig.visual.subtitleStyle.fontWeight === "bold" ? "1" : "0"}`,
      `PrimaryColour=&H${hexToABGR(channelConfig.visual.primaryColor)}`,
      `OutlineColour=&H${hexToABGR(channelConfig.visual.subtitleStyle.strokeColor)}`,
      `Outline=${channelConfig.visual.subtitleStyle.strokeWidth}`,
      `Shadow=${Math.round(channelConfig.visual.subtitleStyle.shadowOpacity * 3)}`,
      `BackColour=&H${hexToABGRWithOpacity(channelConfig.visual.subtitleStyle.backgroundColor, channelConfig.visual.subtitleStyle.backgroundOpacity)}`,
      `Alignment=5`, // Centrado
      `MarginV=200`,
    ].join(",");

    filterComplex =
      `${videoFilters};${concatInputs}concat=n=${imagePaths.length}:v=1:a=0[vconcat];` +
      `[vconcat]subtitles='${srtPath.replace(/\\/g, "/")}':force_style='${subtitleStyle}',` +
      `colorlevels=rimin=0.05:gimin=0.05:bimin=0.05:rimax=0.95:gimax=0.95:bimax=0.95,` +
      `eq=contrast=1.05:brightness=0.02:saturation=1.1[outv]`; // Mejoras de color

    const ffmpegCommand =
      `ffmpeg ${imageInputs} -i "${audioPath}" ` +
      `-filter_complex "${filterComplex}" ` +
      `-map "[outv]" -map ${audioIndex}:a -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 192k ` +
      `-shortest -pix_fmt yuv420p -movflags +faststart "${outputVideoPath}" -y`;

    try {
      Logger.info(
        "🎬 Ejecutando FFmpeg con efectos Ken Burns + Pan vertical...",
      );
      await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 20 });

      // Limpiar imágenes temporales
      imagePaths.forEach((path) => {
        if (existsSync(path)) unlinkSync(path);
      });

      Logger.success(`Video generado con slideshow: ${outputVideoPath}`);
    } catch (error: any) {
      Logger.error("Error en slideshow, usando fallback:", error.message);
      // Fallback a gradiente si falla
      return await generateVideoWithGradient(
        script,
        audioPath,
        srtPath,
        outputDir,
        duration,
      );
    }
  } else {
    // MODO: Gradiente (fallback)
    Logger.info("Generando video con gradiente...");
    return await generateVideoWithGradient(
      script,
      audioPath,
      srtPath,
      outputDir,
      duration,
    );
  }

  return {
    videoPath: outputVideoPath,
    width,
    height,
    duration,
  };
}

/**
 * Genera video con gradiente (fallback)
 */
async function generateVideoWithGradient(
  script: Script,
  audioPath: string,
  srtPath: string,
  outputDir: string,
  duration: number,
): Promise<VideoResult> {
  const { width, height, fps } = CONFIG.video;
  const outputVideoPath = join(outputDir, "final.mp4");
  const backgroundPath = join(outputDir, "background.png");

  await generateBackground(backgroundPath, width, height);

  try {
    const ffmpegCommand =
      `ffmpeg -loop 1 -i "${backgroundPath}" -i "${audioPath}" ` +
      `-filter_complex "[0:v]scale=${width}:${height},zoompan=z='min(zoom+0.0005,1.1)':d=1:s=${width}x${height}:fps=${fps}[v];` +
      `[v]subtitles='${srtPath.replace(/\\/g, "/")}':force_style='FontName=Arial Bold,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2,MarginV=180'[outv]" ` +
      `-map "[outv]" -map 1:a -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k ` +
      `-shortest -t ${duration} -pix_fmt yuv420p "${outputVideoPath}" -y`;

    await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 10 });

    if (existsSync(backgroundPath)) {
      unlinkSync(backgroundPath);
    }

    Logger.success(`Video generado con gradiente: ${outputVideoPath}`);

    return {
      videoPath: outputVideoPath,
      width,
      height,
      duration,
    };
  } catch (error: any) {
    Logger.error("Error generando video:", error.message);
    throw new Error(`Error en FFmpeg: ${error.message}`);
  }
}

/**
 * Genera una imagen de fondo con gradiente
 */
async function generateBackground(
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  // Gradiente azul oscuro a negro
  const command =
    `ffmpeg -f lavfi -i "color=c=0x1a1a2e:s=${width}x${height}:d=1" ` +
    `-vf "geq=r='128-128*Y/H':g='128-64*Y/H':b='192-128*Y/H'" ` +
    `-update 1 -frames:v 1 "${outputPath}" -y`;

  await execAsync(command);
  Logger.info("Fondo generado");
}

/**
 * 🎨 Convierte color HEX (#RRGGBB) a formato ABGR para FFmpeg subtitles
 * FFmpeg usa formato &HAABBGGRR
 */
function hexToABGR(hex: string): string {
  // Remover # si existe
  hex = hex.replace("#", "");

  // Extraer componentes RGB
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);

  // Retornar en formato BGR (sin alpha, será agregado por FFmpeg)
  return `00${b}${g}${r}`.toUpperCase();
}

/**
 * 🎨 Convierte color HEX + opacity a formato ABGR con transparencia
 */
function hexToABGRWithOpacity(hex: string, opacity: number): string {
  hex = hex.replace("#", "");

  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);

  // Convertir opacity (0-1) a hex (00-FF)
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");

  return `${alpha}${b}${g}${r}`.toUpperCase();
}

/**
 * Verifica que FFmpeg esté instalado
 */
export async function checkFFmpeg(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    Logger.success("FFmpeg detectado correctamente");
    return true;
  } catch (error) {
    Logger.error(
      "FFmpeg no encontrado. Instala FFmpeg desde: https://ffmpeg.org/download.html",
    );
    return false;
  }
}

/**
 * Genera un video con imagen o video stock de fondo (versión avanzada)
 * Si tienes imágenes/videos en assets/, esta función los usará
 */
export async function generateVideoWithMedia(
  script: Script,
  audioPath: string,
  srtPath: string,
  mediaPath: string,
  outputDir: string,
): Promise<VideoResult> {
  Logger.info(`Generando video con media: ${mediaPath}`);

  const { width, height, fps } = CONFIG.video;
  const outputVideoPath = join(outputDir, "final.mp4");

  // Obtener duración del audio
  const durationCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
  const { stdout } = await execAsync(durationCommand);
  const duration = parseFloat(stdout.trim());

  try {
    // Comando FFmpeg con media de fondo
    const ffmpegCommand =
      `ffmpeg -stream_loop -1 -i "${mediaPath}" -i "${audioPath}" ` +
      `-filter_complex "[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},` +
      `zoompan=z='min(zoom+0.0008,1.15)':d=1:s=${width}x${height}:fps=${fps}[v];` +
      `[v]subtitles='${srtPath.replace(/\\/g, "/")}':force_style='FontName=Arial Bold,FontSize=26,PrimaryColour=&HFFFFFF,` +
      `OutlineColour=&H000000,Outline=3,Shadow=2,Alignment=2,MarginV=200'[outv]" ` +
      `-map "[outv]" -map 1:a -c:v libx264 -preset medium -crf 21 -c:a aac -b:a 128k ` +
      `-shortest -t ${duration} -pix_fmt yuv420p "${outputVideoPath}" -y`;

    Logger.info("Generando video con media...");
    await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 10 });

    Logger.success(`Video con media generado: ${outputVideoPath}`);

    return {
      videoPath: outputVideoPath,
      width,
      height,
      duration,
    };
  } catch (error: any) {
    Logger.error("Error generando video con media:", error.message);
    throw new Error(`Error en FFmpeg: ${error.message}`);
  }
}
