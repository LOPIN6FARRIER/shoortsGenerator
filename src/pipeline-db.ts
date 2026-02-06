import { join } from "path";
import { statSync } from "fs";
import { CONFIG } from "./config.js";
import {
  Logger,
  ensureDir,
  generateTimestamp,
  sanitizeFilename,
} from "./utils.js";
import { generateTopic } from "./topic.js";
import { generateTTS, checkEdgeTTS } from "./tts.js";
import { generateShortsOptimizedSRT } from "./subtitles.js";
import { generateVideo, checkFFmpeg } from "./video.js";
import { uploadToYouTube } from "./upload.js";
import { Script, generateScriptWithPrompt } from "./script.js";
import {
  initDatabase,
  checkDatabaseHealth,
  startPipelineExecution,
  completePipelineExecution,
  failPipelineExecution,
  saveTopic,
  saveScript,
  saveVideo,
  saveYouTubeUpload,
  saveResourceUsage,
  logError,
  closeDatabase,
  type ChannelConfig,
  type DBResourceUsage,
  getChannelPrompts,
} from "./database.js";

interface ChannelResult {
  channelName: string;
  language: string;
  videoPath: string;
  uploadUrl?: string;
  videoId?: string;
}

/**
 * Pipeline moderno: usa configuración desde BD
 */
export async function executePipelineFromDB(
  channels: ChannelConfig[],
): Promise<void> {
  const startTime = Date.now();
  let executionId: string | null = null;

  try {
    Logger.info("=".repeat(80));
    Logger.info("  🚀 PIPELINE - YOUTUBE SHORTS GENERATOR");
    Logger.info("=".repeat(80));
    Logger.info("");

    // Inicializar BD
    initDatabase();
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      throw new Error("Base de datos no disponible");
    }

    executionId = await startPipelineExecution();

    Logger.info(`📺 Total de canales activos: ${channels.length}`);

    // Agrupar canales por group_id
    const channelGroups = new Map<string, ChannelConfig[]>();
    const independentChannels: ChannelConfig[] = [];

    for (const channel of channels) {
      if (channel.group_id) {
        const groupChannels = channelGroups.get(channel.group_id) || [];
        groupChannels.push(channel);
        channelGroups.set(channel.group_id, groupChannels);
      } else {
        independentChannels.push(channel);
      }
    }

    Logger.info(`📊 Grupos detectados: ${channelGroups.size}`);
    Logger.info(`📊 Canales independientes: ${independentChannels.length}`);
    Logger.info("");

    // Procesar cada grupo de canales (mismo contenido, diferentes idiomas)
    for (const [groupId, groupChannels] of channelGroups.entries()) {
      Logger.info(`\n${"=".repeat(60)}`);
      Logger.info(`🔗 PROCESANDO GRUPO: ${groupId}`);
      Logger.info(
        `   Canales: ${groupChannels.map((ch) => `${ch.name} (${ch.language})`).join(", ")}`,
      );
      Logger.info("=".repeat(60));

      await processChannelGroup(groupChannels, executionId);
    }

    // Procesar canales independientes
    for (const channel of independentChannels) {
      Logger.info(`\n${"=".repeat(60)}`);
      Logger.info(`📺 PROCESANDO CANAL INDEPENDIENTE: ${channel.name}`);
      Logger.info("=".repeat(60));

      await processChannelGroup([channel], executionId);
    }

    // Completar pipeline
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    await completePipelineExecution(executionId, processingTime);

    Logger.info("\n" + "=".repeat(80));
    Logger.success("✅ PIPELINE COMPLETADO EXITOSAMENTE");
    Logger.info("=".repeat(80));
  } catch (error: any) {
    Logger.error("❌ ERROR EN PIPELINE:", error.message);
    if (executionId) {
      await failPipelineExecution(executionId, error.message);
    }
    throw error;
  } finally {
    closeDatabase();
  }
}

/**
 * Procesa un grupo de canales (mismo topic, scripts por idioma)
 */
async function processChannelGroup(
  channels: ChannelConfig[],
  executionId: string,
): Promise<void> {
  // Verificar dependencias
  Logger.info("Verificando dependencias...");
  const hasEdgeTTS = await checkEdgeTTS();
  const hasFFmpeg = await checkFFmpeg();

  if (!hasEdgeTTS || !hasFFmpeg) {
    throw new Error("Faltan dependencias (edge-tts o ffmpeg)");
  }

  // PASO 1: Generar Topic (compartido para todo el grupo)
  Logger.info("\n📝 PASO 1: Generando topic...");
  const firstChannel = channels[0];

  const topicPrompts = await getChannelPrompts(firstChannel.id, "topic");
  if (topicPrompts.length === 0) {
    throw new Error(
      `Canal ${firstChannel.name} no tiene prompts de topic configurados`,
    );
  }

  const topic = await generateTopic(
    firstChannel.language as "es" | "en",
    firstChannel.id,
  );
  Logger.success(`Topic: "${topic.title}"`);

  const topicDbId = await saveTopic({ ...topic, execution_id: executionId });

  // PASO 2: Generar Scripts por idioma
  Logger.info("\n📄 PASO 2: Generando scripts...");
  const scripts = new Map<string, { script: Script; scriptDbId: string }>();

  for (const channel of channels) {
    const scriptPrompts = await getChannelPrompts(channel.id, "script");
    if (scriptPrompts.length === 0) {
      throw new Error(
        `Canal ${channel.name} no tiene prompts de script configurados`,
      );
    }

    const script = await generateScriptWithPrompt(
      topic,
      channel.language as "es" | "en",
      scriptPrompts[0].prompt_text,
    );

    const scriptDbId = await saveScript(script);
    scripts.set(channel.language, { script, scriptDbId });

    Logger.success(
      `  ${channel.language.toUpperCase()}: ${script.narrative.split(" ").length} palabras`,
    );
  }

  // PASO 3-5: Procesar cada canal
  const results: ChannelResult[] = [];

  for (const channel of channels) {
    const scriptData = scripts.get(channel.language);
    if (!scriptData) continue;

    const { script, scriptDbId } = scriptData;

    Logger.info(`\n🎬 Procesando: ${channel.name}`);

    // Crear directorio de output
    const timestamp = generateTimestamp();
    const sanitizedTitle = sanitizeFilename(topic.title);
    const outputDir = join(
      CONFIG.paths.output,
      channel.language,
      `${timestamp}-${sanitizedTitle}`,
    );
    ensureDir(outputDir);

    // TTS
    const ttsResult = await generateTTS(script, outputDir);

    // Subtítulos
    const srtPath = await generateShortsOptimizedSRT(
      script,
      ttsResult.audioPath,
      outputDir,
    );

    // Video
    const videoResult = await generateVideo(
      script,
      ttsResult.audioPath,
      srtPath,
      outputDir,
    );

    // Guardar video en BD
    const videoStats = statSync(videoResult.videoPath);
    const fileSizeMb = videoStats.size / (1024 * 1024);

    const videoDbId = await saveVideo({
      script_id: scriptDbId,
      language: channel.language as "es" | "en",
      file_path: videoResult.videoPath,
      duration_seconds: Math.round(videoResult.duration),
      width: videoResult.width,
      height: videoResult.height,
      file_size_mb: parseFloat(fileSizeMb.toFixed(2)),
      audio_voice: channel.voice,
      audio_file_path: ttsResult.audioPath,
      subtitles_file_path: srtPath,
    });

    // Upload a YouTube (si está autenticado)
    if (channel.youtube_access_token && process.env.DEBBUGING !== "true") {
      Logger.info("Subiendo a YouTube...");

      // Convertir ChannelConfig de BD a formato esperado por uploadToYouTube
      const legacyChannelConfig = {
        language: channel.language,
        youtubeClientId: channel.youtube_client_id || "",
        youtubeClientSecret: channel.youtube_client_secret || "",
        youtubeRedirectUri: channel.youtube_redirect_uri || "",
        youtubeCredentialsPath: "", // No usado cuando pasamos tokens directamente
      } as any;

      const uploadResult = await uploadToYouTube(
        videoResult.videoPath,
        script,
        legacyChannelConfig,
      );

      await saveYouTubeUpload({
        video_id: videoDbId,
        youtube_video_id: uploadResult.videoId,
        youtube_url: uploadResult.url,
        channel: channel.language as "es" | "en",
        title: uploadResult.title,
        privacy_status: "public",
      });

      results.push({
        channelName: channel.name,
        language: channel.language,
        videoPath: videoResult.videoPath,
        uploadUrl: uploadResult.url,
        videoId: uploadResult.videoId,
      });

      Logger.success(`✅ ${channel.name}: ${uploadResult.url}`);
    } else {
      results.push({
        channelName: channel.name,
        language: channel.language,
        videoPath: videoResult.videoPath,
      });

      Logger.success(`✅ ${channel.name}: ${videoResult.videoPath}`);
    }
  }

  // Guardar resource usage del grupo
  try {
    let totalStorageMb = 0;
    results.forEach((result) => {
      if (result.videoPath) {
        try {
          const stats = statSync(result.videoPath);
          totalStorageMb += stats.size / (1024 * 1024);
        } catch {}
      }
    });

    if (totalStorageMb > 0) {
      const processingTime = Math.round((Date.now() - Date.now()) / 1000);
      await saveResourceUsage({
        execution_id: executionId,
        storage_used_mb: parseFloat(totalStorageMb.toFixed(2)),
        processing_time_seconds: processingTime,
      });

      Logger.info(
        `💾 Almacenamiento del grupo: ${totalStorageMb.toFixed(1)} MB`,
      );
    }
  } catch (error: any) {
    Logger.warn(`No se pudo guardar resource usage: ${error.message}`);
  }

  Logger.success(`✅ Grupo procesado exitosamente`);
}
