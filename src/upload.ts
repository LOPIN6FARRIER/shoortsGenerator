import { google } from "googleapis";
import { readFileSync, existsSync, createReadStream } from "fs";
import { Logger } from "./utils.js";
import { ChannelConfig } from "./config.js";
import { Script } from "./script.js";

const youtube = google.youtube("v3");

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
): Promise<UploadResult> {
  Logger.info(
    `Subiendo video a YouTube (${channelConfig.language}): ${script.title}`,
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
    } else {
      // Cargar credenciales desde archivo (flujo legacy)
      if (!existsSync(channelConfig.youtubeCredentialsPath)) {
        throw new Error(
          `Credenciales no encontradas en: ${channelConfig.youtubeCredentialsPath}\n` +
            "Ejecuta el flujo de autenticación primero con: npm run auth",
        );
      }

      const credentials = JSON.parse(
        readFileSync(channelConfig.youtubeCredentialsPath, "utf-8"),
      );
      oauth2Client.setCredentials(credentials);
    }

    // Preparar metadata del video
    const videoMetadata = {
      snippet: {
        title: script.title,
        description: script.description + "\n\n#Shorts",
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
    const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

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
