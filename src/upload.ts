import { google } from "googleapis";
import { readFileSync, existsSync, createReadStream } from "fs";
import { Logger } from "./utils.js";
import { ChannelConfig } from "./config.js";
import { Script } from "./script.js";

const youtube = google.youtube("v3");

function getReauthHint(channelId?: string): string {
  if (channelId) {
    return `Re-autentica el canal via endpoint: GET /api/youtube-auth/${channelId}/auth-url y luego completa callback/manual-code.`;
  }
  return "Re-autentica el canal via endpoints de YouTube Auth (/api/youtube-auth/:channelId/auth-url y callback/manual-code).";
}

export interface UploadResult {
  videoId: string;
  url: string;
  title: string;
}

/**
 * Sube un video a YouTube usando OAuth2
 */
export async function uploadToYouTube(
  videoPath: string,
  script: Script,
  channelConfig: ChannelConfig,
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
    token_type?: string;
    scope?: string;
  },
  uploadAsShort: boolean = true,
  channelId?: string,
): Promise<UploadResult> {
  const videoType = uploadAsShort ? "Short" : "video";
  Logger.info(
    `Subiendo ${videoType} a YouTube (${channelConfig.language}): ${script.title}`,
  );

  try {
    // Configurar OAuth2
    const oauth2Client = new google.auth.OAuth2(
      channelConfig.youtubeClientId,
      channelConfig.youtubeClientSecret,
      channelConfig.youtubeRedirectUri,
    );

    // Si se pasaron tokens directamente (desde BD), usarlos
    if (tokens && tokens.access_token) {
      oauth2Client.setCredentials(tokens);

      // Verificar si el token está expirado o por expirar (margen de 5 minutos)
      const now = Date.now();
      const tokenExpiry = tokens.expiry_date || 0;
      const isExpired = tokenExpiry > 0 && now >= tokenExpiry - 5 * 60 * 1000;

      if (isExpired && tokens.refresh_token) {
        Logger.info(
          "Token de YouTube expirado, refrescando automáticamente...",
        );
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(credentials);

          // Actualizar tokens en BD si tenemos channelId
          if (channelId && credentials.access_token) {
            const { updateChannelTokens } = await import("./database.js");
            await updateChannelTokens(channelId, {
              access_token: credentials.access_token,
              refresh_token: credentials.refresh_token || undefined,
              expiry_date: credentials.expiry_date || undefined,
              token_type: credentials.token_type || undefined,
              scope: credentials.scope || undefined,
            });
            Logger.success("✅ Token de YouTube refrescado y guardado en BD");
          }
        } catch (refreshError: any) {
          Logger.error("Error refrescando token:", refreshError.message);
          throw new Error(
            `Token expirado y no se pudo refrescar: ${refreshError.message}. ${getReauthHint(channelId)}`,
          );
        }
      }
    } else {
      // Cargar credenciales desde archivo (flujo legacy)
      if (!existsSync(channelConfig.youtubeCredentialsPath)) {
        throw new Error(
          `Credenciales no encontradas en: ${channelConfig.youtubeCredentialsPath}\n` +
            `${getReauthHint(channelId)}`,
        );
      }

      const credentials = JSON.parse(
        readFileSync(channelConfig.youtubeCredentialsPath, "utf-8"),
      );
      oauth2Client.setCredentials(credentials);
    }

    // Preparar metadata del video
    const description = uploadAsShort
      ? script.description + "\n\n#Shorts"
      : script.description;

    const videoMetadata = {
      snippet: {
        title: script.title,
        description: description,
        tags: script.tags,
        categoryId: "27", // Education
        defaultLanguage: script.language,
      },
      status: {
        privacyStatus: "public", // 'public', 'unlisted', 'private'
        selfDeclaredMadeForKids: false,
      },
    };

    // Subir video
    const response = await youtube.videos.insert({
      auth: oauth2Client,
      part: ["snippet", "status"],
      requestBody: videoMetadata,
      media: {
        body: createReadStream(videoPath),
      },
    });

    const videoId = response.data.id!;
    const videoUrl = uploadAsShort
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;

    Logger.success(`Video subido exitosamente: ${videoUrl}`);

    return {
      videoId,
      url: videoUrl,
      title: script.title,
    };
  } catch (error: any) {
    Logger.error("Error subiendo a YouTube:", error.message);
    throw new Error(`Error en upload: ${error.message}`);
  }
}

/**
 * Refresca tokens de YouTube para un canal si están por expirar
 * @returns true si se refrescaron, false si no era necesario o falló
 */
export async function refreshChannelTokensIfNeeded(
  channelId: string,
  channelConfig: ChannelConfig,
  tokens: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
    token_type?: string;
    scope?: string;
  },
): Promise<boolean> {
  try {
    // Verificar si el token está por expirar (margen de 24 horas)
    const now = Date.now();
    const tokenExpiry = tokens.expiry_date || 0;
    const shouldRefresh =
      tokenExpiry <= 0 || now >= tokenExpiry - 24 * 60 * 60 * 1000;

    if (!shouldRefresh) {
      Logger.debug(
        `Canal ${channelId}: token aún vigente, no requiere refresh (expira en ${new Date(tokenExpiry).toISOString()})`,
      );
      return false; // No necesita refresh todavía
    }

    if (tokenExpiry <= 0) {
      Logger.warn(
        `Canal ${channelId}: token sin expiry_date, intentando refresh preventivo`,
      );
    }

    if (!tokens.refresh_token) {
      Logger.warn(
        `Canal ${channelId} no tiene refresh_token. ${getReauthHint(channelId)}`,
      );
      return false;
    }

    Logger.info(`Refrescando tokens de YouTube para canal ${channelId}...`);

    const oauth2Client = new google.auth.OAuth2(
      channelConfig.youtubeClientId,
      channelConfig.youtubeClientSecret,
      channelConfig.youtubeRedirectUri,
    );

    oauth2Client.setCredentials(tokens);
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (credentials.access_token) {
      const { updateChannelTokens } = await import("./database.js");
      await updateChannelTokens(channelId, {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || undefined,
        expiry_date: credentials.expiry_date || undefined,
        token_type: credentials.token_type || undefined,
        scope: credentials.scope || undefined,
      });
      Logger.success(`✅ Tokens refrescados para canal ${channelId}`);
      return true;
    }

    Logger.warn(
      `Canal ${channelId}: refresh ejecutado pero sin access_token nuevo en respuesta`,
    );

    return false;
  } catch (error: any) {
    if (
      typeof error?.message === "string" &&
      error.message.includes("invalid_grant")
    ) {
      Logger.error(
        `Error refrescando tokens para canal ${channelId}: invalid_grant. ${getReauthHint(channelId)}`,
      );
      return false;
    }

    Logger.error(
      `Error refrescando tokens para canal ${channelId}:`,
      error.message,
    );
    return false;
  }
}

/**
 * Refresca tokens de todos los canales activos que estén por expirar
 */
export async function refreshAllChannelTokens(): Promise<void> {
  try {
    const { getActiveChannels } = await import("./database.js");
    const channels = await getActiveChannels();

    let refreshedCount = 0;
    let checkedCount = 0;
    let missingRefreshTokenCount = 0;

    for (const channel of channels) {
      // Solo procesar canales con tokens
      if (!channel.youtube_access_token) {
        continue;
      }

      checkedCount++;

      if (!channel.youtube_refresh_token) {
        missingRefreshTokenCount++;
      }

      const channelConfig = {
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

      const refreshed = await refreshChannelTokensIfNeeded(
        channel.id,
        channelConfig,
        tokens,
      );

      if (refreshed) {
        refreshedCount++;
      }
    }

    Logger.info(
      `✅ Job de refresh de tokens completado: ${refreshedCount}/${checkedCount} canales refrescados (${missingRefreshTokenCount} sin refresh_token)`,
    );
  } catch (error: any) {
    Logger.error("Error en job de refresh de tokens:", error.message);
  }
}

/**
 * Genera URL de autenticación OAuth2
 * El usuario debe visitar esta URL y autorizar la aplicación
 */
export function generateAuthUrl(channelConfig: ChannelConfig): string {
  const oauth2Client = new google.auth.OAuth2(
    channelConfig.youtubeClientId,
    channelConfig.youtubeClientSecret,
    channelConfig.youtubeRedirectUri,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });

  Logger.info(
    `URL de autenticación generada para canal ${channelConfig.language}:`,
  );
  console.log(authUrl);

  return authUrl;
}

/**
 * Guarda tokens OAuth2 después de la autenticación
 */
export async function saveCredentials(
  code: string,
  channelConfig: ChannelConfig,
): Promise<void> {
  const oauth2Client = new google.auth.OAuth2(
    channelConfig.youtubeClientId,
    channelConfig.youtubeClientSecret,
    channelConfig.youtubeRedirectUri,
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const { writeFileSync } = await import("fs");
  writeFileSync(
    channelConfig.youtubeCredentialsPath,
    JSON.stringify(tokens, null, 2),
    "utf-8",
  );

  Logger.success(
    `Credenciales guardadas en: ${channelConfig.youtubeCredentialsPath}`,
  );
}

/**
 * Verifica si las credenciales OAuth2 existen y son válidas
 */
export function checkCredentials(channelConfig: ChannelConfig): boolean {
  if (!existsSync(channelConfig.youtubeCredentialsPath)) {
    Logger.error(
      `Credenciales no encontradas: ${channelConfig.youtubeCredentialsPath}`,
    );
    return false;
  }

  try {
    const credentials = JSON.parse(
      readFileSync(channelConfig.youtubeCredentialsPath, "utf-8"),
    );

    if (!credentials.access_token) {
      Logger.error("Token de acceso inválido");
      return false;
    }

    Logger.success(
      `Credenciales válidas encontradas para canal ${channelConfig.language}`,
    );
    return true;
  } catch (error) {
    Logger.error("Error leyendo credenciales:", error);
    return false;
  }
}
