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
import { uploadToYouTube, checkCredentials } from "./upload.js";
import { generateBilingualScripts, Script } from "./script.js";
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
} from "./database.js";

interface ChannelResult {
  videoPath: string;
  uploadUrl: string;
  videoId: string;
  scriptId: string;
  videoDbId: string;
  audioPath: string;
  srtPath: string;
  duration: number;
  processingTime: number;
}

async function processChannel(
  language: "es" | "en",
  script: Script,
  scriptDbId: string,
  outputDir: string,
): Promise<ChannelResult> {
  const channelConfig = CONFIG.channels[language];
  const startTime = Date.now();

  // TTS
  Logger.info(`Generando audio con voz: ${channelConfig.voice}`);
  const ttsStart = Date.now();
  const ttsResult = await generateTTS(script, outputDir);
  const ttsDuration = Math.round((Date.now() - ttsStart) / 1000);
  Logger.success(`Audio generado: ${ttsResult.duration}s (${ttsDuration}s)`);

  // Subtítulos
  Logger.info("Generando subtítulos...");
  const srtPath = generateShortsOptimizedSRT(
    script,
    ttsResult.duration,
    outputDir,
  );

  // Video
  Logger.info("Generando video vertical (9:16)...");
  const videoStart = Date.now();
  const videoResult = await generateVideo(
    script,
    ttsResult.audioPath,
    srtPath,
    outputDir,
  );
  const videoDuration = Math.round((Date.now() - videoStart) / 1000);
  Logger.success(`Video final: ${videoResult.videoPath} (${videoDuration}s)`);

  // Calcular tamaño del archivo
  const videoStats = statSync(videoResult.videoPath);
  const fileSizeMb = videoStats.size / (1024 * 1024);

  // Guardar video en BD
  const videoDbId = await saveVideo({
    script_id: scriptDbId,
    language,
    file_path: videoResult.videoPath,
    duration_seconds: videoResult.duration,
    width: videoResult.width,
    height: videoResult.height,
    file_size_mb: parseFloat(fileSizeMb.toFixed(2)),
    audio_voice: channelConfig.voice,
    audio_file_path: ttsResult.audioPath,
    subtitles_file_path: srtPath,
    processing_time_seconds: videoDuration,
  });

  // Upload a YouTube
  Logger.info(`Subiendo a YouTube (${language.toUpperCase()})...`);
  const uploadStart = Date.now();
  const uploadResult = await uploadToYouTube(
    videoResult.videoPath,
    script,
    channelConfig,
  );
  const uploadDuration = Math.round((Date.now() - uploadStart) / 1000);
  Logger.success(`Subido: ${uploadResult.url} (${uploadDuration}s)`);

  // Guardar upload en BD
  await saveYouTubeUpload({
    video_id: videoDbId,
    youtube_video_id: uploadResult.videoId,
    youtube_url: uploadResult.url,
    channel: language,
    title: uploadResult.title,
    privacy_status: "public",
    upload_duration_seconds: uploadDuration,
  });

  const totalTime = Math.round((Date.now() - startTime) / 1000);

  return {
    videoPath: videoResult.videoPath,
    uploadUrl: uploadResult.url,
    videoId: uploadResult.videoId,
    scriptId: scriptDbId,
    videoDbId,
    audioPath: ttsResult.audioPath,
    srtPath,
    duration: videoResult.duration,
    processingTime: totalTime,
  };
}

export async function executePipeline(): Promise<void> {
  const pipelineStartTime = Date.now();
  let executionId: string | null = null;
  let totalTokens = 0;

  try {
    Logger.info("=== GENERADOR DE YOUTUBE SHORTS BILINGÜES ===");
    Logger.info("Iniciando pipeline de generación automática...\n");

    // Inicializar BD
    initDatabase();
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      Logger.warn("Base de datos no disponible, continuando sin persistencia");
    }

    // Iniciar registro de ejecución
    if (dbHealthy) {
      executionId = await startPipelineExecution();
    }

    Logger.info("Verificando dependencias...");
    const hasEdgeTTS = await checkEdgeTTS();
    const hasFFmpeg = await checkFFmpeg();

    if ((!hasEdgeTTS || !hasFFmpeg) && process.env.DEBBUGING !== "true") {
      throw new Error(
        "Faltan dependencias necesarias. Revisa los logs anteriores.",
      );
    }

    Logger.info("\nVerificando credenciales de YouTube...");
    const hasESCredentials = checkCredentials(CONFIG.channels.es);
    const hasENCredentials = checkCredentials(CONFIG.channels.en);

    if (
      (!hasESCredentials || !hasENCredentials) &&
      process.env.DEBBUGING !== "true"
    ) {
      throw new Error(
        "Faltan credenciales de YouTube. Revisa los logs anteriores.",
      );
    }

    ensureDir(CONFIG.paths.output);
    ensureDir(CONFIG.paths.outputEs);
    ensureDir(CONFIG.paths.outputEn);

    const timestamp = generateTimestamp();

    // PASO 1: Generación de tema
    Logger.info("\n--- PASO 1: GENERACIÓN DE TEMA ---");
    const topic = await generateTopic();
    Logger.success(`Tema seleccionado: ${topic.title}`);

    // Guardar topic en BD
    if (
      dbHealthy &&
      executionId &&
      topic.tokensUsed !== undefined &&
      topic.tokensUsed > 0
    ) {
      const topicTokens = topic.tokensUsed || 0;
      await saveTopic(
        {
          ...topic,
          openai_model: CONFIG.openai.model,
          openai_tokens_used: topicTokens,
        },
        executionId,
      );
      totalTokens += topicTokens;
      Logger.info(`Tokens topic: ${topicTokens}`);
    }

    // PASO 2: Generación de guiones
    Logger.info("\n--- PASO 2: GENERACIÓN DE GUIONES CON IA ---");
    const scripts = await generateBilingualScripts(topic);
    Logger.success("Guiones generados en español e inglés con OpenAI");

    // Guardar scripts en BD
    let esScriptId = "";
    let enScriptId = "";
    if (dbHealthy && process.env.DEBBUGING !== "true") {
      const esTokens = scripts.es.tokensUsed || 0;
      const enTokens = scripts.en.tokensUsed || 0;

      esScriptId = await saveScript({
        ...scripts.es,
        openai_model: CONFIG.openai.model,
        openai_tokens_used: esTokens,
      });
      enScriptId = await saveScript({
        ...scripts.en,
        openai_model: CONFIG.openai.model,
        openai_tokens_used: enTokens,
      });
      totalTokens += esTokens + enTokens;
      Logger.info(`Tokens scripts: ES=${esTokens}, EN=${enTokens}`);
    }

    // PASO 3: Canal Español
    Logger.info("\n--- PASO 3: PROCESANDO CANAL ESPAÑOL ---");
    const esDir = join(
      CONFIG.paths.outputEs,
      `${timestamp}-${sanitizeFilename(topic.id)}`,
    );
    ensureDir(esDir);
    const esResult = dbHealthy
      ? await processChannel("es", scripts.es, esScriptId, esDir)
      : await processChannelLegacy("es", scripts.es, esDir);

    // PASO 4: Canal Inglés
    Logger.info("\n--- PASO 4: PROCESANDO CANAL INGLÉS ---");
    const enDir = join(
      CONFIG.paths.outputEn,
      `${timestamp}-${sanitizeFilename(topic.id)}`,
    );
    ensureDir(enDir);
    const enResult = dbHealthy
      ? await processChannel("en", scripts.en, enScriptId, enDir)
      : await processChannelLegacy("en", scripts.en, enDir);

    // Guardar uso de recursos
    const totalDuration = Math.round((Date.now() - pipelineStartTime) / 1000);
    if (dbHealthy && executionId) {
      const esStats = statSync(esResult.videoPath);
      const enStats = statSync(enResult.videoPath);
      const totalStorage = (esStats.size + enStats.size) / (1024 * 1024);

      await saveResourceUsage({
        execution_id: executionId,
        openai_tokens_total: totalTokens,
        openai_cost_usd: (totalTokens / 1000) * 0.03, // GPT-4 pricing
        storage_used_mb: parseFloat(totalStorage.toFixed(2)),
        processing_time_seconds: totalDuration,
        edge_tts_duration_seconds:
          (esResult.processingTime || 0) + (enResult.processingTime || 0),
        ffmpeg_duration_seconds:
          (esResult.processingTime || 0) + (enResult.processingTime || 0),
      });

      await completePipelineExecution(executionId, totalDuration);
    }

    // Resumen final
    Logger.info("\n========================================");
    Logger.success("PIPELINE COMPLETADO EXITOSAMENTE");
    Logger.info("========================================");
    Logger.info(`\nCanal Español:`);
    Logger.info(`  - Video: ${esResult.videoPath}`);
    Logger.info(`  - URL: ${esResult.uploadUrl}`);
    Logger.info(`\nCanal Inglés:`);
    Logger.info(`  - Video: ${enResult.videoPath}`);
    Logger.info(`  - URL: ${enResult.uploadUrl}`);
    Logger.info(`\nEstadísticas:`);
    Logger.info(`  - Duración total: ${totalDuration}s`);
    Logger.info(`  - Tokens OpenAI: ${totalTokens}`);
    Logger.info(
      `  - Costo estimado: $${((totalTokens / 1000) * 0.03).toFixed(4)}`,
    );
    if (executionId) {
      Logger.info(`  - Execution ID: ${executionId}`);
    }
    Logger.info("\n========================================\n");
  } catch (error: any) {
    Logger.error("ERROR FATAL EN EL PIPELINE:", error.message);

    // Registrar error en BD
    if (executionId) {
      await logError({
        execution_id: executionId,
        error_type: error.constructor.name,
        error_message: error.message,
        stack_trace: error.stack,
        context: { timestamp: new Date().toISOString() },
      });
      await failPipelineExecution(executionId, error.message);
    }

    throw error;
  }
}

// Función legacy sin BD (fallback)
async function processChannelLegacy(
  language: "es" | "en",
  script: Script,
  outputDir: string,
): Promise<ChannelResult> {
  const channelConfig = CONFIG.channels[language];
  const startTime = Date.now();

  const ttsResult = await generateTTS(script, outputDir);
  const srtPath = generateShortsOptimizedSRT(
    script,
    ttsResult.duration,
    outputDir,
  );
  const videoResult = await generateVideo(
    script,
    ttsResult.audioPath,
    srtPath,
    outputDir,
  );
  const uploadResult = await uploadToYouTube(
    videoResult.videoPath,
    script,
    channelConfig,
  );

  return {
    videoPath: videoResult.videoPath,
    uploadUrl: uploadResult.url,
    videoId: uploadResult.videoId,
    scriptId: "",
    videoDbId: "",
    audioPath: ttsResult.audioPath,
    srtPath,
    duration: videoResult.duration,
    processingTime: Math.round((Date.now() - startTime) / 1000),
  };
}
