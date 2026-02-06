import { google } from "googleapis";
import { getPool } from "../../database.js";
import { readFileSync } from "fs";
import { join } from "path";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";

interface AuthUrlResult {
  authUrl: string;
  state: string;
}

interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

interface GoogleOAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

/**
 * Lee las credenciales OAuth desde google.json
 */
export async function getGoogleOAuthConfig(): Promise<
  ControllerResult<GoogleOAuthConfig>
> {
  try {
    const googleJsonPath = join(process.cwd(), "google.json");
    const googleJson = JSON.parse(readFileSync(googleJsonPath, "utf-8"));

    if (!googleJson.installed) {
      return createErrorResult("Invalid google.json format", undefined, 400);
    }

    return createSuccessResult("OAuth config retrieved", {
      client_id: googleJson.installed.client_id,
      client_secret: googleJson.installed.client_secret,
      redirect_uris: googleJson.installed.redirect_uris,
    });
  } catch (error: any) {
    return createErrorResult("Failed to read google.json", error.message, 500);
  }
}

/**
 * Genera URL de autenticación OAuth2 para un canal
 */
export async function generateAuthUrl(
  channelId: string,
): Promise<ControllerResult<AuthUrlResult>> {
  try {
    const pool = getPool();

    // Obtener configuración del canal
    const channelResult = await pool.query(
      `SELECT id, language, youtube_client_id, youtube_client_secret, youtube_redirect_uri
       FROM channels WHERE id = $1`,
      [channelId],
    );

    if (channelResult.rows.length === 0) {
      return createErrorResult("Channel not found", undefined, 404);
    }

    const channel = channelResult.rows[0];

    if (
      !channel.youtube_client_id ||
      !channel.youtube_client_secret ||
      !channel.youtube_redirect_uri
    ) {
      return createErrorResult(
        "Channel OAuth configuration incomplete",
        undefined,
        400,
      );
    }

    // Crear cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      channel.youtube_client_id,
      channel.youtube_client_secret,
      channel.youtube_redirect_uri,
    );

    // Generar URL con state para seguridad
    const state = Buffer.from(
      JSON.stringify({ channelId, timestamp: Date.now() }),
    ).toString("base64");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/youtube.upload"],
      state,
      prompt: "consent", // Forzar consent para obtener refresh_token
    });

    return createSuccessResult("Auth URL generated successfully", {
      authUrl,
      state,
    });
  } catch (error: any) {
    return createErrorResult("Failed to generate auth URL", error.message);
  }
}

/**
 * Procesa el callback de OAuth2 y guarda los tokens en la BD
 */
export async function handleOAuthCallback(
  code: string,
  state: string,
): Promise<ControllerResult<{ success: boolean }>> {
  try {
    // Decodificar state para obtener channelId
    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const { channelId } = stateData;

    const pool = getPool();

    // Obtener configuración del canal
    const channelResult = await pool.query(
      `SELECT id, youtube_client_id, youtube_client_secret, youtube_redirect_uri
       FROM channels WHERE id = $1`,
      [channelId],
    );

    if (channelResult.rows.length === 0) {
      return createErrorResult("Channel not found", undefined, 404);
    }

    const channel = channelResult.rows[0];

    // Crear cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      channel.youtube_client_id,
      channel.youtube_client_secret,
      channel.youtube_redirect_uri,
    );

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Guardar tokens en la base de datos
    await pool.query(
      `UPDATE channels SET
         youtube_access_token = $1,
         youtube_refresh_token = $2,
         youtube_token_expiry = $3,
         youtube_refresh_token_expires_in = $4,
         youtube_token_type = $5,
         youtube_scope = $6,
         updated_at = NOW()
       WHERE id = $7`,
      [
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date || null,
        tokens.expiry_date
          ? tokens.expiry_date + 6 * 30 * 24 * 60 * 60 * 1000
          : null,
        tokens.token_type || "Bearer",
        tokens.scope || "https://www.googleapis.com/auth/youtube.upload",
        channelId,
      ],
    );

    return createSuccessResult("YouTube authentication successful", {
      success: true,
    });
  } catch (error: any) {
    return createErrorResult("Failed to process OAuth callback", error.message);
  }
}

/**
 * Procesa el código OAuth manualmente (sin callback redirect)
 */
export async function handleManualOAuthCode(
  channelId: string,
  code: string,
): Promise<ControllerResult<{ success: boolean }>> {
  try {
    const pool = getPool();

    // Obtener configuración del canal
    const channelResult = await pool.query(
      `SELECT id, youtube_client_id, youtube_client_secret, youtube_redirect_uri
       FROM channels WHERE id = $1`,
      [channelId],
    );

    if (channelResult.rows.length === 0) {
      return createErrorResult("Channel not found", undefined, 404);
    }

    const channel = channelResult.rows[0];

    if (
      !channel.youtube_client_id ||
      !channel.youtube_client_secret ||
      !channel.youtube_redirect_uri
    ) {
      return createErrorResult(
        "Channel OAuth configuration incomplete",
        undefined,
        400,
      );
    }

    // Crear cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      channel.youtube_client_id,
      channel.youtube_client_secret,
      channel.youtube_redirect_uri,
    );

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Guardar tokens en la base de datos
    await pool.query(
      `UPDATE channels SET
         youtube_access_token = $1,
         youtube_refresh_token = $2,
         youtube_token_expiry = $3,
         youtube_refresh_token_expires_in = $4,
         youtube_token_type = $5,
         youtube_scope = $6,
         updated_at = NOW()
       WHERE id = $7`,
      [
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date || null,
        tokens.expiry_date
          ? tokens.expiry_date + 6 * 30 * 24 * 60 * 60 * 1000
          : null,
        tokens.token_type || "Bearer",
        tokens.scope || "https://www.googleapis.com/auth/youtube.upload",
        channelId,
      ],
    );

    return createSuccessResult("YouTube authentication successful", {
      success: true,
    });
  } catch (error: any) {
    return createErrorResult(
      "Failed to process OAuth code",
      error.message,
      400,
    );
  }
}

/**
 * Verifica si un canal está autenticado con YouTube
 */
export async function checkAuthStatus(
  channelId: string,
): Promise<ControllerResult<{ isAuthenticated: boolean; expiresAt?: number }>> {
  try {
    const pool = getPool();

    const result = await pool.query(
      `SELECT youtube_access_token, youtube_refresh_token, youtube_token_expiry
       FROM channels WHERE id = $1`,
      [channelId],
    );

    if (result.rows.length === 0) {
      return createErrorResult("Channel not found", undefined, 404);
    }

    const channel = result.rows[0];
    const isAuthenticated =
      !!channel.youtube_access_token && !!channel.youtube_refresh_token;

    return createSuccessResult("Auth status retrieved", {
      isAuthenticated,
      expiresAt: channel.youtube_token_expiry,
    });
  } catch (error: any) {
    return createErrorResult("Failed to check auth status", error.message);
  }
}

/**
 * Revoca la autenticación de YouTube para un canal
 */
export async function revokeAuth(
  channelId: string,
): Promise<ControllerResult<{ success: boolean }>> {
  try {
    const pool = getPool();

    await pool.query(
      `UPDATE channels SET
         youtube_access_token = NULL,
         youtube_refresh_token = NULL,
         youtube_token_expiry = NULL,
         youtube_token_type = NULL,
         youtube_scope = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [channelId],
    );

    return createSuccessResult("YouTube authentication revoked", {
      success: true,
    });
  } catch (error: any) {
    return createErrorResult("Failed to revoke authentication", error.message);
  }
}
