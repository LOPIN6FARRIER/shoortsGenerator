import { getPool, pool } from "../../database.js";
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
  enabled: boolean;
  subtitle_color: string;
  subtitle_outline_color: string;
  font_size: number;
  max_chars_per_line: number;
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
    const result = await pool.query<Channel>(
      `INSERT INTO channels (
        language, name, voice, voice_rate, voice_pitch,
        youtube_client_id, youtube_client_secret, youtube_redirect_uri, youtube_credentials_path,
        enabled, subtitle_color, subtitle_outline_color, 
        font_size, max_chars_per_line
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.language,
        data.name,
        data.voice,
        data.voiceRate || "+8%",
        data.voicePitch || "+2Hz",
        data.youtubeClientId,
        data.youtubeClientSecret,
        data.youtubeRedirectUri,
        data.youtubeCredentialsPath,
        data.enabled !== false,
        data.subtitleColor || "#00D7FF",
        data.subtitleOutlineColor || "#000000",
        data.fontSize || 22,
        data.maxCharsPerLine || 16,
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
    if (data.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      values.push(data.enabled);
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
