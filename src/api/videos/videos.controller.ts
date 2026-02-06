import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";

export interface VideoRecord {
  id: string;
  scriptId: string;
  language: string;
  filePath: string;
  durationSeconds: number;
  width: number;
  height: number;
  fileSizeMb: number;
  audioVoice: string;
  audioFilePath: string;
  subtitlesFilePath: string;
  processingTimeSeconds: number;
  createdAt: Date;
  topic?: {
    title: string;
    description: string;
  };
  upload?: {
    youtubeVideoId: string;
    youtubeUrl: string;
    channel: string;
    privacyStatus: string;
  };
}

export async function getVideos(
  limit: number = 20,
  offset: number = 0,
  language?: string,
): Promise<ControllerResult<VideoRecord[]>> {
  try {
    const pool = getPool();

    let whereClause = "";
    let countParams: any[] = [];
    let queryParams: any[] = [];

    if (language) {
      whereClause = "WHERE v.language = $1";
      countParams = [language];
      queryParams = [language, limit, offset];
    } else {
      queryParams = [limit, offset];
    }

    const countQuery = `SELECT COUNT(*) FROM videos v ${whereClause}`;
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const limitOffsetClause = language
      ? "LIMIT $2 OFFSET $3"
      : "LIMIT $1 OFFSET $2";

    const query = `
    SELECT 
      v.id,
      v.script_id as "scriptId",
      v.language,
      v.file_path as "filePath",
      v.duration_seconds as "durationSeconds",
      v.width,
      v.height,
      v.file_size_mb as "fileSizeMb",
      v.audio_voice as "audioVoice",
      v.audio_file_path as "audioFilePath",
      v.subtitles_file_path as "subtitlesFilePath",
      v.processing_time_seconds as "processingTimeSeconds",
      v.created_at as "createdAt",
      t.title as "topicTitle",
      t.description as "topicDescription",
      u.youtube_video_id as "youtubeVideoId",
      u.youtube_url as "youtubeUrl",
      COALESCE(c.name, u.channel::text) as "uploadChannel",
      u.privacy_status as "privacyStatus"
    FROM videos v
    INNER JOIN scripts s ON v.script_id = s.id
    INNER JOIN topics t ON s.topic_id = t.id
    LEFT JOIN youtube_uploads u ON u.video_id = v.id
    LEFT JOIN channels c ON v.language::text = c.language
    ${whereClause}
    ORDER BY v.created_at DESC
    ${limitOffsetClause}
  `;

    const result = await pool.query(query, queryParams);

    const videos = result.rows.map((row) => ({
      id: row.id,
      scriptId: row.scriptId,
      language: row.language,
      filePath: row.filePath,
      durationSeconds: parseFloat(row.durationSeconds),
      width: parseInt(row.width),
      height: parseInt(row.height),
      fileSizeMb: parseFloat(row.fileSizeMb),
      audioVoice: row.audioVoice,
      audioFilePath: row.audioFilePath,
      subtitlesFilePath: row.subtitlesFilePath,
      processingTimeSeconds: parseFloat(row.processingTimeSeconds),
      createdAt: row.createdAt,
      topic: row.topicTitle
        ? {
            title: row.topicTitle,
            description: row.topicDescription,
          }
        : undefined,
      upload: row.youtubeVideoId
        ? {
            youtubeVideoId: row.youtubeVideoId,
            youtubeUrl: row.youtubeUrl,
            channel: row.uploadChannel,
            privacyStatus: row.privacyStatus,
          }
        : undefined,
    }));

    return createSuccessResult(
      "Videos retrieved successfully",
      videos,
      200,
      total,
    );
  } catch (error: any) {
    return createErrorResult("Failed to get videos", error.message);
  }
}

export async function getVideoById(
  id: string,
): Promise<ControllerResult<VideoRecord | null>> {
  try {
    const pool = getPool();

    const query = `
    SELECT 
      v.id,
      v.script_id as "scriptId",
      v.language,
      v.file_path as "filePath",
      v.duration_seconds as "durationSeconds",
      v.width,
      v.height,
      v.file_size_mb as "fileSizeMb",
      v.audio_voice as "audioVoice",
      v.audio_file_path as "audioFilePath",
      v.subtitles_file_path as "subtitlesFilePath",
      v.processing_time_seconds as "processingTimeSeconds",
      v.created_at as "createdAt",
      t.title as "topicTitle",
      t.description as "topicDescription",
      u.youtube_video_id as "youtubeVideoId",
      u.youtube_url as "youtubeUrl",
      COALESCE(c.name, u.channel::text) as "uploadChannel",
      u.privacy_status as "privacyStatus"
    FROM videos v
    INNER JOIN scripts s ON v.script_id = s.id
    INNER JOIN topics t ON s.topic_id = t.id
    LEFT JOIN youtube_uploads u ON u.video_id = v.id
    LEFT JOIN channels c ON v.language::text = c.language
    WHERE v.id = $1
  `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return createErrorResult("Video not found", undefined, 404);
    }

    const row = result.rows[0];

    const video = {
      id: row.id,
      scriptId: row.scriptId,
      language: row.language,
      filePath: row.filePath,
      durationSeconds: parseFloat(row.durationSeconds),
      width: parseInt(row.width),
      height: parseInt(row.height),
      fileSizeMb: parseFloat(row.fileSizeMb),
      audioVoice: row.audioVoice,
      audioFilePath: row.audioFilePath,
      subtitlesFilePath: row.subtitlesFilePath,
      processingTimeSeconds: parseFloat(row.processingTimeSeconds),
      createdAt: row.createdAt,
      topic: row.topicTitle
        ? {
            title: row.topicTitle,
            description: row.topicDescription,
          }
        : undefined,
      upload: row.youtubeVideoId
        ? {
            youtubeVideoId: row.youtubeVideoId,
            youtubeUrl: row.youtubeUrl,
            channel: row.uploadChannel,
            privacyStatus: row.privacyStatus,
          }
        : undefined,
    };

    return createSuccessResult("Video retrieved successfully", video);
  } catch (error: any) {
    return createErrorResult("Failed to get video", error.message);
  }
}
