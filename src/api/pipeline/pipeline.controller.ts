import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";

export interface PipelineExecution {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  status: "running" | "completed" | "failed";
  durationSeconds: number | null;
  errorMessage: string | null;
}

export interface PipelineExecutionDetail extends PipelineExecution {
  topic?: {
    id: string;
    title: string;
    description: string;
    imageKeywords: string;
    videoKeywords: string;
  };
  scripts?: Array<{
    id: string;
    language: string;
    title: string;
    wordCount: number;
    estimatedDuration: number;
  }>;
  videos?: Array<{
    id: string;
    language: string;
    filePath: string;
    durationSeconds: number;
    fileSizeMb: number;
  }>;
  uploads?: Array<{
    id: string;
    youtubeVideoId: string;
    youtubeUrl: string;
    channel: string;
    title: string;
    privacyStatus: string;
  }>;
  resourceUsage?: {
    openaiTokensTotal: number;
    openaiCostUsd: number;
    processingTimeSeconds: number;
    edgeTtsDurationSeconds: number;
    ffmpegDurationSeconds: number;
  };
}

export async function getPipelineExecutions(
  limit: number = 20,
  offset: number = 0,
): Promise<ControllerResult<PipelineExecution[]>> {
  try {
    const pool = getPool();

    const countQuery = `SELECT COUNT(*) FROM pipeline_executions`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    const query = `
    SELECT 
      id,
      started_at as "startedAt",
      completed_at as "completedAt",
      status,
      duration_seconds as "durationSeconds",
      error_message as "errorMessage"
    FROM pipeline_executions
    ORDER BY started_at DESC
    LIMIT $1 OFFSET $2
  `;

    const result = await pool.query(query, [limit, offset]);

    return createSuccessResult(
      "Pipeline executions retrieved successfully",
      result.rows,
      200,
      total,
    );
  } catch (error: any) {
    return createErrorResult(
      "Failed to get pipeline executions",
      error.message,
    );
  }
}

export async function getPipelineExecutionById(
  id: string,
): Promise<ControllerResult<PipelineExecutionDetail | null>> {
  try {
    const pool = getPool();

    // Get execution
    const execQuery = `
    SELECT 
      id,
      started_at as "startedAt",
      completed_at as "completedAt",
      status,
      duration_seconds as "durationSeconds",
      error_message as "errorMessage"
    FROM pipeline_executions
    WHERE id = $1
  `;

    const execResult = await pool.query(execQuery, [id]);
    if (execResult.rows.length === 0) {
      return createErrorResult("Pipeline execution not found", undefined, 404);
    }

    const execution = execResult.rows[0];

    // Get topic
    const topicQuery = `
    SELECT 
      id,
      title,
      description,
      image_keywords as "imageKeywords",
      video_keywords as "videoKeywords"
    FROM topics
    WHERE execution_id = $1
  `;
    const topicResult = await pool.query(topicQuery, [id]);
    const topic = topicResult.rows[0] || null;

    // Get scripts
    const scriptsQuery = `
    SELECT 
      s.id,
      s.language,
      s.title,
      s.word_count as "wordCount",
      s.estimated_duration as "estimatedDuration"
    FROM scripts s
    INNER JOIN topics t ON s.topic_id = t.id
    WHERE t.execution_id = $1
  `;
    const scriptsResult = await pool.query(scriptsQuery, [id]);

    // Get videos
    const videosQuery = `
    SELECT 
      v.id,
      v.language,
      v.file_path as "filePath",
      v.duration_seconds as "durationSeconds",
      v.file_size_mb as "fileSizeMb"
    FROM videos v
    INNER JOIN scripts s ON v.script_id = s.id
    INNER JOIN topics t ON s.topic_id = t.id
    WHERE t.execution_id = $1
  `;
    const videosResult = await pool.query(videosQuery, [id]);

    // Get uploads
    const uploadsQuery = `
    SELECT 
      u.id,
      u.youtube_video_id as "youtubeVideoId",
      u.youtube_url as "youtubeUrl",
      COALESCE(c.name, u.channel::text) as channel,
      u.title,
      u.privacy_status as "privacyStatus"
    FROM youtube_uploads u
    INNER JOIN videos v ON u.video_id = v.id
    INNER JOIN scripts s ON v.script_id = s.id
    INNER JOIN topics t ON s.topic_id = t.id
    LEFT JOIN channels c ON v.language::text = c.language
    WHERE t.execution_id = $1
  `;
    const uploadsResult = await pool.query(uploadsQuery, [id]);

    // Get resource usage
    const resourceQuery = `
    SELECT 
      openai_tokens_total as "openaiTokensTotal",
      openai_cost_usd as "openaiCostUsd",
      processing_time_seconds as "processingTimeSeconds",
      edge_tts_duration_seconds as "edgeTtsDurationSeconds",
      ffmpeg_duration_seconds as "ffmpegDurationSeconds"
    FROM resource_usage
    WHERE execution_id = $1
  `;
    const resourceResult = await pool.query(resourceQuery, [id]);

    const result = {
      ...execution,
      topic: topic || undefined,
      scripts: scriptsResult.rows,
      videos: videosResult.rows,
      uploads: uploadsResult.rows,
      resourceUsage: resourceResult.rows[0] || undefined,
    };

    return createSuccessResult(
      "Pipeline execution retrieved successfully",
      result,
    );
  } catch (error: any) {
    return createErrorResult("Failed to get pipeline execution", error.message);
  }
}
