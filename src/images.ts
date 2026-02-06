import { createWriteStream, existsSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
import { Topic } from "./topic.js";
import { getTopicImages, saveTopicImages, DBTopicImage } from "./database.js";

export interface ImageSource {
  url: string;
  downloadUrl: string;
  photographer: string;
  photographerUrl?: string;
  photoId?: string;
  source: "unsplash" | "pexels" | "fallback";
}

/**
 * Descarga imágenes de Unsplash relacionadas con el topic
 * Primero busca en BD si ya existen imágenes guardadas, si no las descarga
 */
export async function downloadTopicImages(
  topic: Topic,
  outputDir: string,
  count: number = 4,
): Promise<string[]> {
  try {
    // Validar que topic existe y tiene las propiedades necesarias
    if (!topic || !topic.title) {
      Logger.warn(
        "Topic inválido o sin título, no se pueden descargar imágenes",
      );
      return [];
    }

    // 1. BUSCAR PRIMERO EN BD
    Logger.info(
      `🔍 Verificando si ya existen imágenes en BD para topic: ${topic.id}`,
    );
    const existingImages = await getTopicImages(topic.id);

    if (existingImages.length > 0) {
      Logger.info(`✅ Encontradas ${existingImages.length} imágenes en BD`);

      // Verificar que los archivos existan en disco
      const validImages = existingImages.filter((img) =>
        existsSync(img.file_path),
      );

      if (validImages.length === existingImages.length) {
        Logger.info(
          `♻️  Reutilizando ${validImages.length} imágenes existentes`,
        );
        return validImages.map((img) => img.file_path);
      } else {
        Logger.warn(
          `⚠️  Solo ${validImages.length}/${existingImages.length} imágenes existen en disco`,
        );
        if (validImages.length >= count) {
          return validImages.slice(0, count).map((img) => img.file_path);
        }
      }
    }

    // 2. SI NO EXISTEN O SON INSUFICIENTES, DESCARGAR NUEVAS
    Logger.info(`📥 Descargando ${count} imágenes nuevas para: ${topic.title}`);

    // Intentar con Unsplash primero
    if (CONFIG.unsplash.accessKey) {
      const images = await searchUnsplashImages(topic, count);
      if (images.length > 0) {
        const downloadedPaths = await downloadImages(images, outputDir);

        // Guardar referencias en BD
        if (downloadedPaths.length > 0) {
          await saveImageReferences(topic.id, images, downloadedPaths);
        }

        return downloadedPaths;
      }
    }

    // Fallback: Pexels
    if (CONFIG.pexels.apiKey) {
      Logger.warn("Unsplash no disponible, intentando con Pexels...");
      const images = await searchPexelsImages(topic, count);
      if (images.length > 0) {
        const downloadedPaths = await downloadImages(images, outputDir);

        // Guardar referencias en BD
        if (downloadedPaths.length > 0) {
          await saveImageReferences(topic.id, images, downloadedPaths);
        }

        return downloadedPaths;
      }
    }

    // Si todo falla, retornar array vacío (usará gradientes)
    Logger.warn("APIs de imágenes no disponibles, usando gradientes");
    return [];
  } catch (error: any) {
    Logger.error("Error descargando imágenes:", error.message);
    return [];
  }
}

/**
 * Guarda las referencias de imágenes descargadas en BD
 */
async function saveImageReferences(
  topicId: string,
  sources: ImageSource[],
  filePaths: string[],
): Promise<void> {
  try {
    const imageRefs: DBTopicImage[] = sources.map((src, index) => ({
      topic_id: topicId,
      file_path: filePaths[index],
      source_url: src.url,
      source_platform: src.source === "fallback" ? undefined : src.source,
      unsplash_photo_id: src.source === "unsplash" ? src.photoId : undefined,
      pexels_photo_id: src.source === "pexels" ? src.photoId : undefined,
      photographer_name: src.photographer,
      photographer_url: src.photographerUrl,
      download_order: index,
    }));

    await saveTopicImages(imageRefs);
  } catch (error: any) {
    Logger.error("Error guardando referencias de imágenes:", error.message);
  }
}

/**
 * Busca imágenes en Unsplash
 */
async function searchUnsplashImages(
  topic: Topic,
  count: number,
): Promise<ImageSource[]> {
  try {
    const searchQuery = encodeURIComponent(topic.title);
    const url = `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=${count}&orientation=portrait`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${CONFIG.unsplash.accessKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data: any = await response.json();

    if (!data.results || data.results.length === 0) {
      Logger.warn(
        `No se encontraron imágenes en Unsplash para: ${topic.title}`,
      );
      return [];
    }

    const images: ImageSource[] = data.results.map((photo: any) => ({
      url: photo.urls.regular,
      downloadUrl: photo.urls.raw + "&w=1080&h=1920&fit=crop",
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      photoId: photo.id,
      source: "unsplash" as const,
    }));

    Logger.success(`Encontradas ${images.length} imágenes en Unsplash`);
    return images;
  } catch (error: any) {
    Logger.error("Error en Unsplash API:", error.message);
    return [];
  }
}

/**
 * Busca imágenes en Pexels
 */
async function searchPexelsImages(
  topic: Topic,
  count: number,
): Promise<ImageSource[]> {
  try {
    const searchQuery = encodeURIComponent(topic.title);
    const url = `https://api.pexels.com/v1/search?query=${searchQuery}&per_page=${count}&orientation=portrait`;

    const response = await fetch(url, {
      headers: {
        Authorization: CONFIG.pexels.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data: any = await response.json();

    if (!data.photos || data.photos.length === 0) {
      Logger.warn(`No se encontraron imágenes en Pexels para: ${topic.title}`);
      return [];
    }

    const images: ImageSource[] = data.photos.map((photo: any) => ({
      url: photo.src.large,
      downloadUrl: photo.src.portrait,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      photoId: photo.id.toString(),
      source: "pexels" as const,
    }));

    Logger.success(`Encontradas ${images.length} imágenes en Pexels`);
    return images;
  } catch (error: any) {
    Logger.error("Error en Pexels API:", error.message);
    return [];
  }
}

/**
 * Descarga las imágenes al disco
 */
async function downloadImages(
  images: ImageSource[],
  outputDir: string,
): Promise<string[]> {
  const downloadedPaths: string[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const image = images[i];
      const filename = `image_${i + 1}.jpg`;
      const filepath = join(outputDir, filename);

      // Si ya existe, no descargar de nuevo
      if (existsSync(filepath)) {
        Logger.info(`Imagen ${i + 1} ya existe: ${filename}`);
        downloadedPaths.push(filepath);
        continue;
      }

      Logger.info(
        `Descargando imagen ${i + 1}/${images.length} de ${image.source}...`,
      );

      const response = await fetch(image.downloadUrl);
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      await pipeline(response.body as any, createWriteStream(filepath));

      downloadedPaths.push(filepath);
      Logger.success(`✓ Imagen ${i + 1} descargada: ${filename}`);

      // Trigger download endpoint de Unsplash (requerido por sus términos)
      if (image.source === "unsplash" && image.url) {
        triggerUnsplashDownload(image.url);
      }
    } catch (error: any) {
      Logger.error(`Error descargando imagen ${i + 1}:`, error.message);
    }
  }

  return downloadedPaths;
}

/**
 * Trigger de descarga de Unsplash (requerido por sus términos de uso)
 */
async function triggerUnsplashDownload(photoUrl: string): Promise<void> {
  try {
    // Extraer el ID de la foto de la URL
    const photoId = photoUrl.split("/").pop()?.split("?")[0];
    if (!photoId) return;

    const url = `https://api.unsplash.com/photos/${photoId}/download`;
    await fetch(url, {
      headers: {
        Authorization: `Client-ID ${CONFIG.unsplash.accessKey}`,
      },
    });
  } catch (error) {
    // No es crítico si falla
  }
}

/**
 * Genera lista de imágenes para FFmpeg slideshow
 */
export function generateImageList(imagePaths: string[]): string {
  return imagePaths.map((path) => `file '${path}'`).join("\n");
}

/**
 * Calcula duración de cada imagen en el slideshow
 */
export function calculateImageDuration(
  totalDuration: number,
  imageCount: number,
): number {
  return Math.ceil(totalDuration / imageCount);
}
