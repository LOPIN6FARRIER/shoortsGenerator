import { join } from "path";
import { statSync } from "fs";
import { CONFIG } from "./config.js";
import {
  Logger,
  ensureDir,
  generateTimestamp,
  sanitizeFilename,
  cleanupVideoDirectory,
} from "./utils.js";
import { generateTopic, Topic } from "./topic.js";
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
  markVideoUploadFailed,
  markVideoUploadSuccess,
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

    // Validar canales antes de procesarlos
    Logger.info("🔍 Validando configuración de canales...");
    const validChannels: ChannelConfig[] = [];
    const invalidChannels: Array<{ channel: ChannelConfig; reason: string }> =
      [];

    for (const channel of channels) {
      try {
        // Verificar que tenga prompts de topic
        const topicPrompts = await getChannelPrompts(channel.id, "topic");
        if (topicPrompts.length === 0) {
          invalidChannels.push({
            channel,
            reason: "Sin prompts de topic configurados",
          });
          continue;
        }

        // Verificar que tenga prompts de script
        const scriptPrompts = await getChannelPrompts(channel.id, "script");
        if (scriptPrompts.length === 0) {
          invalidChannels.push({
            channel,
            reason: "Sin prompts de script configurados",
          });
          continue;
        }

        // Canal válido
        validChannels.push(channel);
      } catch (error: any) {
        invalidChannels.push({
          channel,
          reason: `Error validando: ${error.message}`,
        });
      }
    }

    // Mostrar canales inválidos
    if (invalidChannels.length > 0) {
      Logger.warn(
        `⚠️  ${invalidChannels.length} canal(es) saltado(s) por configuración incompleta:`,
      );
      invalidChannels.forEach(({ channel, reason }) => {
        Logger.warn(`   - ${channel.name} (${channel.language}): ${reason}`);
      });
      Logger.info("");
    }

    if (validChannels.length === 0) {
      Logger.warn("❌ No hay canales válidos para procesar");
      await completePipelineExecution(executionId, 0);
      return;
    }

    Logger.info(
      `✅ Canales válidos para procesar: ${validChannels.length}/${channels.length}`,
    );
    Logger.info("");

    // Agrupar canales válidos por group_id
    const channelGroups = new Map<string, ChannelConfig[]>();
    const independentChannels: ChannelConfig[] = [];

    for (const channel of validChannels) {
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
      try {
        Logger.info(`\n${"=".repeat(60)}`);
        Logger.info(`🔗 PROCESANDO GRUPO: ${groupId}`);
        Logger.info(
          `   Canales: ${groupChannels.map((ch) => `${ch.name} (${ch.language})`).join(", ")}`,
        );
        Logger.info("=".repeat(60));

        await processChannelGroup(groupChannels, executionId);
      } catch (error: any) {
        Logger.error(`❌ Error procesando grupo ${groupId}: ${error.message}`);
        await logError({
          execution_id: executionId,
          error_type: "channel_group_failed",
          error_message: error.message,
          stack_trace: error.stack,
          context: {
            group_id: groupId,
            channels: groupChannels.map((ch) => ch.name),
          },
        });
        // Continuar con otros grupos
      }
    }

    // Procesar canales independientes
    for (const channel of independentChannels) {
      try {
        Logger.info(`\n${"=".repeat(60)}`);
        Logger.info(`📺 PROCESANDO CANAL INDEPENDIENTE: ${channel.name}`);
        Logger.info("=".repeat(60));

        await processChannelGroup([channel], executionId);
      } catch (error: any) {
        Logger.error(
          `❌ Error procesando canal ${channel.name}: ${error.message}`,
        );
        await logError({
          execution_id: executionId,
          error_type: "independent_channel_failed",
          error_message: error.message,
          stack_trace: error.stack,
          context: {
            channel_id: channel.id,
            channel_name: channel.name,
          },
        });
        // Continuar con otros canales independientes
      }
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
  }
  // Note: Database pool is kept open for cron jobs
  // It will be closed on application shutdown
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

  // PASO 1: Generar UN SOLO Topic (compartido para todo el grupo)
  Logger.info("\n📝 PASO 1: Generando topic compartido...");
  const firstChannel = channels[0];

  const topic = await generateTopic(
    firstChannel.language as "es" | "en",
    firstChannel.id,
  );
  Logger.success(`Topic base (${firstChannel.language.toUpperCase()}): "${topic.title}"`);

  await saveTopic({ ...topic, execution_id: executionId });

  // PASO 2: Generar Scripts por idioma (mismo topic, diferentes idiomas)
  Logger.info("\n📄 PASO 2: Generando scripts por idioma...");
  const scripts = new Map<string, { script: Script; scriptDbId: string }>();
  const uniqueLanguages = [...new Set(channels.map((ch) => ch.language))];

  for (const language of uniqueLanguages) {
    // Usar el primer canal de este idioma para obtener el prompt
    const channelForLang = channels.find((ch) => ch.language === language)!;
    const scriptPrompts = await getChannelPrompts(channelForLang.id, "script");

    // IMPORTANTE: Mismo topic para todos los idiomas
    // El prompt de script debe manejar la traducción/adaptación al idioma target
    const script = await generateScriptWithPrompt(
      topic,
      language as "es" | "en",
      scriptPrompts[0].prompt_text,
    );

    const scriptDbId = await saveScript(script);
    scripts.set(language, { script, scriptDbId });

    Logger.success(
      `  ${language.toUpperCase()}: ${script.narrative.split(" ").length} palabras`,
    );
  }

  // PASO 3-5: Procesar cada canal
  const results: ChannelResult[] = [];

  for (const channel of channels) {
    const scriptData = scripts.get(channel.language);
    if (!scriptData) continue;

    const { script, scriptDbId } = scriptData;

    Logger.info(`\n🎬 Procesando: ${channel.name}`);

    // Crear directorio de output usando el topic del script correspondiente
    const timestamp = generateTimestamp();
    const sanitizedTitle = sanitizeFilename(script.topic.title);
    const outputDir = join(
      CONFIG.paths.output,
      channel.language,
      `${timestamp}-${sanitizedTitle}`,
    );
    ensureDir(outputDir);

    // TTS con configuración del canal
    const ttsResult = await generateTTS(script, outputDir, {
      voice: channel.voice,
      voiceRate: channel.voice_rate,
      voicePitch: channel.voice_pitch,
    });

    // Subtítulos
    const srtPath = await generateShortsOptimizedSRT(
      script,
      ttsResult.audioPath,
      outputDir,
      {
        width: channel.video_width,
        height: channel.video_height,
      },
    );

    // Video
    const videoResult = await generateVideo(
      script,
      ttsResult.audioPath,
      srtPath,
      outputDir,
      {
        width: channel.video_width,
        height: channel.video_height,
        fps: channel.video_fps,
      },
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
      upload_status: "pending", // Por defecto pending hasta que se suba
      upload_attempts: 0,
    });

    // Upload a YouTube (si está autenticado y no está en modo DEBUG)
    if (channel.youtube_access_token && process.env.DEBUGGING !== "true") {
      try {
        Logger.info("Subiendo a YouTube...");

        // Convertir ChannelConfig de BD a formato esperado por uploadToYouTube
        const legacyChannelConfig = {
          language: channel.language,
          youtubeClientId: channel.youtube_client_id || "",
          youtubeClientSecret: channel.youtube_client_secret || "",
          youtubeRedirectUri: channel.youtube_redirect_uri || "",
          youtubeCredentialsPath: "", // No usado cuando pasamos tokens directamente
        } as any;

        // Tokens desde BD
        const tokens = {
          access_token: channel.youtube_access_token,
          refresh_token: channel.youtube_refresh_token || undefined,
          expiry_date: channel.youtube_token_expiry || undefined,
          token_type: channel.youtube_token_type || "Bearer",
          scope: channel.youtube_scope || undefined,
        };

        const uploadResult = await uploadToYouTube(
          videoResult.videoPath,
          script,
          legacyChannelConfig,
          tokens,
          channel.upload_as_short,
        );

        await saveYouTubeUpload({
          video_id: videoDbId,
          youtube_video_id: uploadResult.videoId,
          youtube_url: uploadResult.url,
          channel: channel.language as "es" | "en",
          title: uploadResult.title,
          privacy_status: "public",
        });

        // Marcar video como exitosamente subido
        await markVideoUploadSuccess(videoDbId);

        // Limpiar archivos del disco después de subida exitosa
        cleanupVideoDirectory(videoResult.videoPath);

        results.push({
          channelName: channel.name,
          language: channel.language,
          videoPath: videoResult.videoPath,
          uploadUrl: uploadResult.url,
          videoId: uploadResult.videoId,
        });

        Logger.success(`✅ ${channel.name}: ${uploadResult.url}`);
      } catch (uploadError: any) {
        // Si el upload falla, registrar error pero continuar con otros canales
        Logger.error(
          `❌ Error subiendo ${channel.name} a YouTube: ${uploadError.message}`,
        );

        // Verificar si es error de cuota
        const isQuotaError =
          uploadError.message.includes("exceeded the number of videos") ||
          uploadError.message.includes("quota");

        if (isQuotaError) {
          Logger.warn(
            `⚠️  Límite de cuota de YouTube alcanzado para ${channel.name}. Se reintentará más tarde.`,
          );
        }

        // Marcar video como fallido (se reintentará después)
        await markVideoUploadFailed(
          videoDbId,
          uploadError.message,
          isQuotaError,
        );

        // Guardar video localmente aunque el upload falle
        results.push({
          channelName: channel.name,
          language: channel.language,
          videoPath: videoResult.videoPath,
        });

        // Registrar error en BD
        await logError({
          execution_id: executionId,
          error_type: "youtube_upload_failed",
          error_message: uploadError.message,
          stack_trace: uploadError.stack,
          context: {
            channel: channel.name,
            language: channel.language,
            video_path: videoResult.videoPath,
          },
        });

        Logger.info(`💾 Video guardado localmente: ${videoResult.videoPath}`);
      }
    } else {
      // Modo DEBUGGING o canal sin autenticación
      if (process.env.DEBUGGING === "true") {
        Logger.warn(
          `⚠️  MODO DEBUGGING: Saltando upload a YouTube. Video disponible en: ${videoResult.videoPath}`,
        );
      }

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
