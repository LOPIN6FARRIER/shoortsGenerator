import { Logger } from "./utils.js";

interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

/**
 * Obtiene configuración de Telegram desde variables de entorno
 */
function getTelegramConfig(): TelegramConfig {
  return {
    enabled: process.env.TELEGRAM_ENABLED === "true",
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  };
}

/**
 * Envía un mensaje a Telegram
 */
async function sendTelegramMessage(
  message: string,
  parseMode: "Markdown" | "HTML" = "Markdown",
): Promise<boolean> {
  const config = getTelegramConfig();

  if (!config.enabled) {
    Logger.debug("Telegram notifications disabled");
    return false;
  }

  if (!config.botToken || !config.chatId) {
    Logger.warn(
      "Telegram enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured",
    );
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      Logger.error(`Error sending Telegram message: ${error}`);
      return false;
    }

    Logger.debug("Telegram notification sent successfully");
    return true;
  } catch (error: any) {
    Logger.error(`Failed to send Telegram notification: ${error.message}`);
    return false;
  }
}

/**
 * Notifica que un video se generó exitosamente
 */
export async function notifyVideoSuccess(
  channelName: string,
  language: string,
  title: string,
  youtubeUrl?: string,
): Promise<void> {
  const videoLink = youtubeUrl || "Video guardado localmente";
  const message = `✅ *Video Generado Exitosamente*

📺 *Canal:* ${channelName} (${language.toUpperCase()})
🎬 *Título:* ${title}
🔗 *Link:* ${youtubeUrl ? `[Ver en YouTube](${youtubeUrl})` : videoLink}

🕐 ${new Date().toLocaleString("es-ES", { timeZone: "America/Mexico_City" })}`;

  await sendTelegramMessage(message);
}

/**
 * Notifica que un video falló en upload
 */
export async function notifyVideoError(
  channelName: string,
  language: string,
  title: string,
  error: string,
): Promise<void> {
  const message = `❌ *Error en Video*

📺 *Canal:* ${channelName} (${language.toUpperCase()})
🎬 *Título:* ${title}
⚠️ *Error:* ${error.substring(0, 200)}${error.length > 200 ? "..." : ""}

🕐 ${new Date().toLocaleString("es-ES", { timeZone: "America/Mexico_City" })}`;

  await sendTelegramMessage(message);
}

/**
 * Notifica que un canal necesita re-autenticación
 */
export async function notifyReauthRequired(
  channelName: string,
  channelId: string,
): Promise<void> {
  const message = `🔑 *Re-Autenticación Requerida*

📺 *Canal:* ${channelName}
🆔 *ID:* \`${channelId}\`

⚠️ Los tokens de YouTube expiraron o son inválidos.

*Acción necesaria:*
1. Ir al dashboard
2. Re-autenticar el canal
O usar API:
\`GET /api/youtube-auth/${channelId}/auth-url\`

🕐 ${new Date().toLocaleString("es-ES", { timeZone: "America/Mexico_City" })}`;

  await sendTelegramMessage(message);
}

/**
 * Notifica el inicio de ejecución del pipeline
 */
export async function notifyPipelineStart(channelCount: number): Promise<void> {
  const message = `🚀 *Pipeline Iniciado*

📊 *Canales a procesar:* ${channelCount}

🕐 ${new Date().toLocaleString("es-ES", { timeZone: "America/Mexico_City" })}`;

  await sendTelegramMessage(message);
}

/**
 * Notifica completación exitosa del pipeline
 */
export async function notifyPipelineComplete(
  videosGenerated: number,
  errors: number,
  processingTime: number,
): Promise<void> {
  const timeFormatted =
    processingTime < 60
      ? `${processingTime}s`
      : `${Math.floor(processingTime / 60)}m ${processingTime % 60}s`;

  const message = `✅ *Pipeline Completado*

📹 *Videos generados:* ${videosGenerated}
${errors > 0 ? `⚠️ *Errores:* ${errors}\n` : ""}⏱️ *Tiempo:* ${timeFormatted}

🕐 ${new Date().toLocaleString("es-ES", { timeZone: "America/Mexico_City" })}`;

  await sendTelegramMessage(message);
}

/**
 * Notifica error crítico del pipeline
 */
export async function notifyPipelineError(error: string): Promise<void> {
  const message = `🔥 *Error Crítico en Pipeline*

⚠️ *Error:* ${error.substring(0, 300)}${error.length > 300 ? "..." : ""}

🕐 ${new Date().toLocaleString("es-ES", { timeZone: "America/Mexico_City" })}`;

  await sendTelegramMessage(message);
}

/**
 * Envía resumen diario de actividad
 */
export async function notifyDailySummary(
  videosToday: number,
  uploadsSuccess: number,
  uploadsFailed: number,
): Promise<void> {
  const message = `📊 *Resumen Diario*

📹 *Videos generados hoy:* ${videosToday}
✅ *Uploads exitosos:* ${uploadsSuccess}
❌ *Uploads fallidos:* ${uploadsFailed}

🕐 ${new Date().toLocaleString("es-ES", { timeZone: "America/Mexico_City" })}`;

  await sendTelegramMessage(message);
}

/**
 * Notifica error de cuota de YouTube
 */
export async function notifyQuotaExceeded(channelName: string): Promise<void> {
  const message = `⚠️ *Cuota de YouTube Excedida*

📺 *Canal:* ${channelName}

El canal alcanzó su límite diario de uploads.
Se reintentará en 24 horas automáticamente.

🕐 ${new Date().toLocaleString("es-ES", { timeZone: "America/Mexico_City" })}`;

  await sendTelegramMessage(message);
}
