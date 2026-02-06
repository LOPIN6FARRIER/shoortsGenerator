import { createWriteStream, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
import { Topic } from "./topic.js";

export interface VideoSource {
  url: string;
  downloadUrl: string;
  duration: number;
  width: number;
  height: number;
  photographer: string;
  videoId: string;
}

/**
 * Descarga videos de Pexels relacionados con el topic
 */
export async function downloadPexelsVideos(
  topic: Topic,
  outputDir: string,
  count: number = 3,
): Promise<string[]> {
  try {
    if (!CONFIG.pexels.apiKey) {
      Logger.warn("Pexels API key no configurada");
      return [];
    }

    // Crear directorio si no existe
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    Logger.info(`🎬 Buscando videos en Pexels...`);

    // Extraer keywords simples del topic
    const keywords = extractVideoKeywords(topic);
    Logger.info(`🔍 Keywords: "${keywords}"`);

    // Buscar videos en Pexels
    const videos = await searchPexelsVideos(keywords, count);

    if (videos.length === 0) {
      Logger.warn("No se encontraron videos en Pexels");
      return [];
    }

    Logger.info(`✅ Encontrados ${videos.length} videos`);

    // Descargar videos
    const downloadedPaths: string[] = [];
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const filename = `${topic.id}_video_${i + 1}.mp4`;
      const filePath = join(outputDir, filename);

      try {
        Logger.info(`Descargando video ${i + 1}/${videos.length}...`);
        await downloadVideo(video.downloadUrl, filePath);
        downloadedPaths.push(filePath);
        Logger.success(`✓ Video ${i + 1} descargado: ${filename}`);
      } catch (error: any) {
        Logger.error(`Error descargando video ${i + 1}:`, error.message);
      }
    }

    return downloadedPaths;
  } catch (error: any) {
    Logger.error("Error en downloadPexelsVideos:", error.message);
    return [];
  }
}

/**
 * Extrae keywords simples para búsqueda de videos
 */
function extractVideoKeywords(topic: Topic): string {
  // Usar imageKeywords si existen, sino extraer del título
  if (topic.imageKeywords) {
    return topic.imageKeywords.split(",")[0].trim();
  }

  // Extraer primeras 2-3 palabras del título
  const words = topic.title.toLowerCase().split(" ");
  return words.slice(0, 3).join(" ");
}

/**
 * Busca videos en Pexels API
 */
async function searchPexelsVideos(
  query: string,
  count: number,
): Promise<VideoSource[]> {
  try {
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
      {
        headers: {
          Authorization: CONFIG.pexels.apiKey,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = (await response.json()) as any;

    return data.videos.map((video: any) => {
      // Encontrar el archivo de video más apropiado (HD vertical)
      const videoFile =
        video.video_files.find(
          (file: any) =>
            file.quality === "hd" &&
            file.width < file.height && // Vertical
            file.width >= 720,
        ) || video.video_files[0]; // Fallback al primero

      return {
        url: video.url,
        downloadUrl: videoFile.link,
        duration: video.duration,
        width: videoFile.width,
        height: videoFile.height,
        photographer: video.user.name,
        videoId: video.id.toString(),
      };
    });
  } catch (error: any) {
    Logger.error("Error buscando videos en Pexels:", error.message);
    return [];
  }
}

/**
 * Descarga un video desde URL
 */
async function downloadVideo(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download video: ${response.status}`);
  }

  const fileStream = createWriteStream(filePath);
  await pipeline(response.body as any, fileStream);
}
