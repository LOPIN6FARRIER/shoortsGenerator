import { Logger } from "./utils.js";
import {
  initDatabase,
  getPendingUploadVideos,
  saveYouTubeUpload,
  markVideoUploadSuccess,
  markVideoUploadFailed,
  logError,
  type ChannelConfig,
  getActiveChannels,
} from "./database.js";
import { uploadToYouTube } from "./upload.js";
import { Script } from "./script.js";

/**
 * Job que reintenta subir videos que fallaron previamente
 * Ejecutar cada 2 horas con cron
 */
export async function retryPendingUploads(): Promise<void> {
  Logger.info("=".repeat(60));
  Logger.info("  🔄 RETRY JOB - Reintentando uploads pendientes");
  Logger.info("=".repeat(60));
  Logger.info(
    "📝 Nota: Videos con quota_exceeded esperan 24h antes de reintento",
  );
  Logger.info("");

  try {
    initDatabase();

    const pendingVideos = await getPendingUploadVideos();

    if (pendingVideos.length === 0) {
      Logger.info(
        "✅ No hay videos pendientes de upload (o aún en período de espera)",
      );
      return;
    }

    Logger.info(`📋 Videos listos para reintento: ${pendingVideos.length}`);
    Logger.info("");

    let successCount = 0;
    let failCount = 0;
    let quotaLimitReached = false;

    for (const video of pendingVideos) {
      // Si ya alcanzamos límite de cuota en este lote, saltar el resto
      if (quotaLimitReached) {
        Logger.warn(
          `⏭️  Saltando ${video.script_title} - cuota agotada en este lote`,
        );
        continue;
      }

      try {
        Logger.info(
          `🔄 Reintentando (intento ${(video.upload_attempts || 0) + 1}/5): ${video.script_title} [${video.language.toUpperCase()}]`,
        );

        // Buscar el canal correspondiente

        const channels = await getActiveChannels();
        const channel = channels.find(
          (c) => c.id === video.channel_id && c.language === video.language,
        );

        if (!channel) {
          Logger.error(`❌ No se encontró canal activo para ${video.language}`);
          await markVideoUploadFailed(
            video.id!,
            "Canal no encontrado o deshabilitado",
            false,
          );
          failCount++;
          continue;
        }

        if (!channel.youtube_access_token) {
          Logger.error(`❌ Canal ${channel.name} sin credenciales de YouTube`);
          await markVideoUploadFailed(
            video.id!,
            "Canal sin credenciales de YouTube",
            false,
          );
          failCount++;
          continue;
        }

        // Reconstruir script para upload
        const script: Script = {
          title: video.script_title,
          description: video.script_description,
          tags: video.script_tags,
          language: video.language as "es" | "en",
          narrative: "", // No necesario para upload
          estimatedDuration: 60, // No necesario para upload
          topic: {
            id: "",
            title: "",
            description: "",
            imageKeywords: "",
            videoKeywords: "",
            timestamp: "",
          }, // No necesario para upload, solo estructura
        };

        // Configuración del canal
        const legacyChannelConfig = {
          language: channel.language,
          youtubeClientId: channel.youtube_client_id || "",
          youtubeClientSecret: channel.youtube_client_secret || "",
          youtubeRedirectUri: channel.youtube_redirect_uri || "",
          youtubeCredentialsPath: "",
        } as any;

        const tokens = {
          access_token: channel.youtube_access_token,
          refresh_token: channel.youtube_refresh_token || undefined,
          expiry_date: channel.youtube_token_expiry || undefined,
          token_type: channel.youtube_token_type || "Bearer",
          scope: channel.youtube_scope || undefined,
        };

        // Intentar upload
        const uploadResult = await uploadToYouTube(
          video.file_path,
          script,
          legacyChannelConfig,
          tokens,
          channel.upload_as_short,
        );

        // Guardar registro de upload
        await saveYouTubeUpload({
          video_id: video.id!,
          youtube_video_id: uploadResult.videoId,
          youtube_url: uploadResult.url,
          channel: video.language as "es" | "en",
          title: uploadResult.title,
          privacy_status: "public",
        });

        // Marcar como exitoso
        await markVideoUploadSuccess(video.id!);

        Logger.success(`✅ ${video.script_title}: ${uploadResult.url}`);
        successCount++;
      } catch (error: any) {
        Logger.error(`❌ Error: ${error.message}`);

        // Verificar si es error de cuota
        const isQuotaError =
          error.message.includes("exceeded the number of videos") ||
          error.message.includes("quota");

        if (isQuotaError) {
          Logger.warn(
            "⚠️  Límite de cuota alcanzado. Deteniendo reintentos en este lote.",
          );
          quotaLimitReached = true;
        }

        // Marcar como fallido
        await markVideoUploadFailed(video.id!, error.message, isQuotaError);

        // Registrar error
        await logError({
          error_type: "retry_upload_failed",
          error_message: error.message,
          stack_trace: error.stack,
          context: {
            video_id: video.id,
            attempt: (video.upload_attempts || 0) + 1,
            channel: video.channel_name,
          },
        });

        failCount++;
      }
    }

    Logger.info("\n" + "=".repeat(60));
    Logger.info(
      `📊 Resultados: ${successCount} exitosos, ${failCount} fallidos`,
    );
    Logger.info("=".repeat(60));
  } catch (error: any) {
    Logger.error("Error fatal en retry job:", error.message);
    await logError({
      error_type: "retry_job_fatal",
      error_message: error.message,
      stack_trace: error.stack,
    });
  }
  // Note: Database pool is kept open for cron jobs
  // It will be closed on application shutdown
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  retryPendingUploads()
    .then(() => process.exit(0))
    .catch((err) => {
      Logger.error("Error ejecutando retry job:", err);
      process.exit(1);
    });
}
