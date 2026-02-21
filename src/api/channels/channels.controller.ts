import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";
import type {
  CreateChannelBody,
  UpdateChannelBody,
} from "./channels.validator.js";

export interface Channel {
  id: string;
  language: string;
  name: string;
  voice: string;
  voice_rate: string;
  voice_pitch: string;
  youtube_client_id?: string;
  youtube_client_secret?: string;
  youtube_redirect_uri?: string;
  youtube_credentials_path?: string;
  youtube_access_token?: string;
  youtube_refresh_token?: string;
  youtube_token_expiry?: number;
  youtube_refresh_token_expires_in?: number;
  youtube_token_type?: string;
  youtube_scope?: string;
  enabled: boolean;
  cron_schedule: string;
  subtitle_color: string;
  subtitle_outline_color: string;
  font_size: number;
  max_chars_per_line: number;
  video_width: number;
  video_height: number;
  video_fps: number;
  video_max_duration: number;
  use_pexels_videos: boolean;
  created_at: string;
  updated_at: string;
}

export async function getChannels(): Promise<ControllerResult<Channel[]>> {
  try {
    const pool = getPool();
    const result = await pool.query<Channel>(
      `SELECT * FROM channels ORDER BY created_at DESC`,
    );

    return createSuccessResult("Channels retrieved successfully", result.rows);
  } catch (error: any) {
    return createErrorResult("Error fetching channels", error.message, 500);
  }
}

export async function getChannel(
  id: string,
): Promise<ControllerResult<Channel>> {
  try {
    const pool = getPool();
    const result = await pool.query<Channel>(
      `SELECT * FROM channels WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return createErrorResult("Channel not found", undefined, 404);
    }

    return createSuccessResult(
      "Channel retrieved successfully",
      result.rows[0],
    );
  } catch (error: any) {
    return createErrorResult("Error fetching channel", error.message, 500);
  }
}

export async function createChannel(
  data: CreateChannelBody,
): Promise<ControllerResult<Channel>> {
  try {
    const pool = getPool();

    // Cargar credenciales OAuth desde google.json automáticamente
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const googleJsonPath = join(process.cwd(), "google.json");
    const googleJson = JSON.parse(readFileSync(googleJsonPath, "utf-8"));

    const oauthClientId = googleJson.installed?.client_id || "";
    const oauthClientSecret = googleJson.installed?.client_secret || "";
    const redirectUri =
      process.env.OAUTH_REDIRECT_URI ||
      "http://localhost:3000/api/youtube-auth/callback";

    const result = await pool.query<Channel>(
      `INSERT INTO channels (
        language, name, voice, voice_rate, voice_pitch, group_id,
        youtube_client_id, youtube_client_secret, youtube_redirect_uri, youtube_credentials_path,
        youtube_access_token, youtube_refresh_token, youtube_token_expiry, 
        youtube_refresh_token_expires_in, youtube_token_type, youtube_scope,
        enabled, cron_schedule,
        subtitle_color, subtitle_outline_color, font_size, max_chars_per_line,
        video_width, video_height, video_fps, video_max_duration, use_pexels_videos
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING *`,
      [
        data.language,
        data.name,
        data.voice,
        data.voiceRate || "+8%",
        data.voicePitch || "+2Hz",
        data.groupId || null,
        oauthClientId, // Desde google.json
        oauthClientSecret, // Desde google.json
        redirectUri, // Desde env o default
        null, // credentials_path no se usa más
        null, // youtube_access_token
        null, // youtube_refresh_token
        null, // youtube_token_expiry
        null, // youtube_refresh_token_expires_in
        null, // youtube_token_type
        null, // youtube_scope
        data.enabled !== false,
        data.cronSchedule || "0 0,8,16 * * *",
        data.subtitleColor || "#00D7FF",
        data.subtitleOutlineColor || "#000000",
        data.fontSize || 22,
        data.maxCharsPerLine || 16,
        data.videoWidth || 1080,
        data.videoHeight || 1920,
        data.videoFps || 30,
        data.videoMaxDuration || 60,
        data.usePexelsVideos !== undefined ? data.usePexelsVideos : false,
      ],
    );

    return createSuccessResult(
      "Channel created successfully",
      result.rows[0],
      201,
    );
  } catch (error: any) {
    return createErrorResult("Error creating channel", error.message, 500);
  }
}

export async function updateChannel(
  id: string,
  data: UpdateChannelBody,
): Promise<ControllerResult<Channel>> {
  try {
    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.language !== undefined) {
      fields.push(`language = $${paramIndex++}`);
      values.push(data.language);
    }
    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.voice !== undefined) {
      fields.push(`voice = $${paramIndex++}`);
      values.push(data.voice);
    }
    if (data.voiceRate !== undefined) {
      fields.push(`voice_rate = $${paramIndex++}`);
      values.push(data.voiceRate);
    }
    if (data.voicePitch !== undefined) {
      fields.push(`voice_pitch = $${paramIndex++}`);
      values.push(data.voicePitch);
    }
    if (data.groupId !== undefined) {
      fields.push(`group_id = $${paramIndex++}`);
      values.push(data.groupId);
    }
    if (data.youtubeClientId !== undefined) {
      fields.push(`youtube_client_id = $${paramIndex++}`);
      values.push(data.youtubeClientId);
    }
    if (data.youtubeClientSecret !== undefined) {
      fields.push(`youtube_client_secret = $${paramIndex++}`);
      values.push(data.youtubeClientSecret);
    }
    if (data.youtubeRedirectUri !== undefined) {
      fields.push(`youtube_redirect_uri = $${paramIndex++}`);
      values.push(data.youtubeRedirectUri);
    }
    if (data.youtubeCredentialsPath !== undefined) {
      fields.push(`youtube_credentials_path = $${paramIndex++}`);
      values.push(data.youtubeCredentialsPath);
    }
    if (data.youtubeAccessToken !== undefined) {
      fields.push(`youtube_access_token = $${paramIndex++}`);
      values.push(data.youtubeAccessToken);
    }
    if (data.youtubeRefreshToken !== undefined) {
      fields.push(`youtube_refresh_token = $${paramIndex++}`);
      values.push(data.youtubeRefreshToken);
    }
    if (data.youtubeTokenExpiry !== undefined) {
      fields.push(`youtube_token_expiry = $${paramIndex++}`);
      values.push(data.youtubeTokenExpiry);
    }
    if (data.youtubeRefreshTokenExpiresIn !== undefined) {
      fields.push(`youtube_refresh_token_expires_in = $${paramIndex++}`);
      values.push(data.youtubeRefreshTokenExpiresIn);
    }
    if (data.youtubeTokenType !== undefined) {
      fields.push(`youtube_token_type = $${paramIndex++}`);
      values.push(data.youtubeTokenType);
    }
    if (data.youtubeScope !== undefined) {
      fields.push(`youtube_scope = $${paramIndex++}`);
      values.push(data.youtubeScope);
    }
    if (data.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      values.push(data.enabled);
    }
    if (data.cronSchedule !== undefined) {
      fields.push(`cron_schedule = $${paramIndex++}`);
      values.push(data.cronSchedule);
    }
    if (data.subtitleColor !== undefined) {
      fields.push(`subtitle_color = $${paramIndex++}`);
      values.push(data.subtitleColor);
    }
    if (data.subtitleOutlineColor !== undefined) {
      fields.push(`subtitle_outline_color = $${paramIndex++}`);
      values.push(data.subtitleOutlineColor);
    }
    if (data.fontSize !== undefined) {
      fields.push(`font_size = $${paramIndex++}`);
      values.push(data.fontSize);
    }
    if (data.maxCharsPerLine !== undefined) {
      fields.push(`max_chars_per_line = $${paramIndex++}`);
      values.push(data.maxCharsPerLine);
    }
    if (data.videoWidth !== undefined) {
      fields.push(`video_width = $${paramIndex++}`);
      values.push(data.videoWidth);
    }
    if (data.videoHeight !== undefined) {
      fields.push(`video_height = $${paramIndex++}`);
      values.push(data.videoHeight);
    }
    if (data.videoFps !== undefined) {
      fields.push(`video_fps = $${paramIndex++}`);
      values.push(data.videoFps);
    }
    if (data.videoMaxDuration !== undefined) {
      fields.push(`video_max_duration = $${paramIndex++}`);
      values.push(data.videoMaxDuration);
    }
    if (data.usePexelsVideos !== undefined) {
      fields.push(`use_pexels_videos = $${paramIndex++}`);
      values.push(data.usePexelsVideos);
    }

    if (fields.length === 0) {
      return createErrorResult("No fields to update", undefined, 400);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const pool = getPool();
    const result = await pool.query<Channel>(
      `UPDATE channels SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return createErrorResult("Channel not found", undefined, 404);
    }

    return createSuccessResult("Channel updated successfully", result.rows[0]);
  } catch (error: any) {
    return createErrorResult("Error updating channel", error.message, 500);
  }
}

export async function deleteChannel(id: string): Promise<ControllerResult> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM channels WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) {
      return createErrorResult("Channel not found", undefined, 404);
    }

    return createSuccessResult("Channel deleted successfully");
  } catch (error: any) {
    return createErrorResult("Error deleting channel", error.message, 500);
  }
}
