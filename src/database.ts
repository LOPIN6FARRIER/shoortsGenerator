import { Pool, QueryResult } from "pg";
import { Logger } from "./utils.js";
import { Topic } from "./topic.js";
import { Script } from "./script.js";

// ============================================
// TIPOS
// ============================================

export interface PipelineExecution {
  id: string;
  started_at: Date;
  completed_at?: Date;
  status: "running" | "completed" | "failed";
  error_message?: string;
  duration_seconds?: number;
}

export interface DBTopic extends Topic {
  execution_id?: string;
  openai_model?: string;
  openai_tokens_used?: number;
  raw_response?: any;
}

export interface DBScript extends Script {
  id?: string;
  openai_model?: string;
  openai_tokens_used?: number;
  word_count?: number;
}

export interface DBVideo {
  id?: string;
  script_id: string;
  language: "es" | "en";
  file_path: string;
  duration_seconds: number;
  width: number;
  height: number;
  file_size_mb?: number;
  audio_voice: string;
  audio_file_path?: string;
  subtitles_file_path?: string;
  processing_time_seconds?: number;
}

export interface DBYouTubeUpload {
  id?: string;
  video_id: string;
  youtube_video_id: string;
  youtube_url: string;
  channel: "es" | "en";
  title: string;
  privacy_status?: "public" | "unlisted" | "private";
  upload_duration_seconds?: number;
}

export interface DBResourceUsage {
  execution_id: string;
  openai_tokens_total?: number;
  openai_cost_usd?: number;
  storage_used_mb?: number;
  processing_time_seconds?: number;
  edge_tts_duration_seconds?: number;
  ffmpeg_duration_seconds?: number;
}

export interface DBErrorLog {
  execution_id?: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  context?: any;
}

export interface DBTopicImage {
  id?: string;
  topic_id: string;
  file_path: string;
  source_url?: string;
  source_platform?: "unsplash" | "pexels";
  unsplash_photo_id?: string;
  pexels_photo_id?: string;
  photographer_name?: string;
  photographer_url?: string;
  download_order: number;
}

// ============================================
// CONEXIÓN A BASE DE DATOS
// ============================================

let pool: Pool | null = null;

export function initDatabase(): Pool {
  if (pool) return pool;

  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || "shorts_app"}:${process.env.DB_PASSWORD || "change_this_secure_password"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "youtube_shorts_db"}`;

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on("error", (err) => {
    Logger.error("Error inesperado en el pool de PostgreSQL:", err);
  });

  Logger.success("Conexión a PostgreSQL establecida");
  return pool;
}

export function getDatabase(): Pool {
  if (!pool) {
    return initDatabase();
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    Logger.info("Conexión a PostgreSQL cerrada");
  }
}

// ============================================
// PIPELINE EXECUTIONS
// ============================================

export async function startPipelineExecution(): Promise<string> {
  const db = getDatabase();
  const result = await db.query<{ id: string }>(
    "INSERT INTO pipeline_executions (status) VALUES ('running') RETURNING id",
  );
  const executionId = result.rows[0].id;
  Logger.info(`Pipeline execution iniciada: ${executionId}`);
  return executionId;
}

export async function completePipelineExecution(
  executionId: string,
  durationSeconds: number,
): Promise<void> {
  const db = getDatabase();
  await db.query(
    `UPDATE pipeline_executions 
     SET status = 'completed', completed_at = NOW(), duration_seconds = $1 
     WHERE id = $2`,
    [durationSeconds, executionId],
  );
  Logger.success(`Pipeline execution completada: ${executionId}`);
}

export async function failPipelineExecution(
  executionId: string,
  errorMessage: string,
): Promise<void> {
  const db = getDatabase();
  await db.query(
    `UPDATE pipeline_executions 
     SET status = 'failed', completed_at = NOW(), error_message = $1 
     WHERE id = $2`,
    [errorMessage, executionId],
  );
  Logger.error(`Pipeline execution fallida: ${executionId}`);
}

// ============================================
// TOPICS
// ============================================

export async function saveTopic(
  topic: DBTopic,
  executionId?: string,
): Promise<void> {
  const db = getDatabase();
  await db.query(
    `INSERT INTO topics (id, title, description, image_keywords, execution_id, openai_model, openai_tokens_used, raw_response, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       image_keywords = EXCLUDED.image_keywords,
       execution_id = EXCLUDED.execution_id`,
    [
      topic.id,
      topic.title,
      topic.description,
      topic.imageKeywords,
      executionId,
      topic.openai_model,
      topic.openai_tokens_used,
      topic.raw_response ? JSON.stringify(topic.raw_response) : null,
      topic.timestamp,
    ],
  );
  Logger.info(`Topic guardado en BD: ${topic.id}`);
}

export async function checkDuplicateTopic(title: string): Promise<boolean> {
  const db = getDatabase();
  const result = await db.query<{ exists: boolean }>(
    "SELECT check_duplicate_topic($1) as exists",
    [title],
  );
  return result.rows[0].exists;
}

export async function getRecentTopics(limit: number = 50): Promise<Topic[]> {
  const db = getDatabase();
  const result = await db.query<Topic>(
    'SELECT id, title, description, image_keywords as "imageKeywords", generated_at as timestamp FROM topics ORDER BY generated_at DESC LIMIT $1',
    [limit],
  );
  return result.rows;
}

export async function getLatestTopic(): Promise<Topic | null> {
  const db = getDatabase();
  const result = await db.query<Topic>(
    'SELECT id, title, description, image_keywords as "imageKeywords", generated_at as timestamp FROM topics ORDER BY generated_at DESC LIMIT 1',
  );
  return result.rows[0] || null;
}

export async function getTopicById(topicId: string): Promise<Topic | null> {
  const db = getDatabase();
  const result = await db.query<Topic>(
    'SELECT id, title, description, image_keywords as "imageKeywords", generated_at as timestamp FROM topics WHERE id = $1',
    [topicId],
  );
  return result.rows[0] || null;
}

// ============================================
// SCRIPTS
// ============================================

export async function getLattestScript(): Promise<DBScript | null> {
  const db = getDatabase();
  const result = await db.query<DBScript>(
    "SELECT * FROM scripts ORDER BY created_at DESC LIMIT 1",
  );
  return result.rows[0] || null;
}

export async function getLatestScriptByLanguage(
  language: "es" | "en",
): Promise<DBScript | null> {
  const db = getDatabase();
  const result = await db.query<DBScript>(
    "SELECT * FROM scripts WHERE language = $1 ORDER BY created_at DESC LIMIT 1",
    [language],
  );
  return result.rows[0] || null;
}

export async function saveScript(script: DBScript): Promise<string> {
  const db = getDatabase();
  const wordCount = script.narrative.split(/\s+/).length;
  const result = await db.query<{ id: string }>(
    `INSERT INTO scripts (topic_id, language, title, narrative, description, tags, estimated_duration, word_count, openai_model, openai_tokens_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (topic_id, language) DO UPDATE SET
       title = EXCLUDED.title,
       narrative = EXCLUDED.narrative,
       description = EXCLUDED.description
     RETURNING id`,
    [
      script.topic.id,
      script.language,
      script.title,
      script.narrative,
      script.description,
      JSON.stringify(script.tags),
      script.estimatedDuration,
      wordCount,
      script.openai_model,
      script.openai_tokens_used,
    ],
  );
  const scriptId = result.rows[0].id;
  Logger.info(`Script guardado en BD: ${scriptId} (${script.language})`);
  return scriptId;
}

// ============================================
// VIDEOS
// ============================================

export async function saveVideo(video: DBVideo): Promise<string> {
  const db = getDatabase();
  const result = await db.query<{ id: string }>(
    `INSERT INTO videos (script_id, language, file_path, duration_seconds, width, height, file_size_mb, audio_voice, audio_file_path, subtitles_file_path, processing_time_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      video.script_id,
      video.language,
      video.file_path,
      video.duration_seconds,
      video.width,
      video.height,
      video.file_size_mb,
      video.audio_voice,
      video.audio_file_path,
      video.subtitles_file_path,
      video.processing_time_seconds,
    ],
  );
  const videoId = result.rows[0].id;
  Logger.info(`Video guardado en BD: ${videoId}`);
  return videoId;
}

// ============================================
// YOUTUBE UPLOADS
// ============================================

export async function saveYouTubeUpload(
  upload: DBYouTubeUpload,
): Promise<string> {
  const db = getDatabase();
  const result = await db.query<{ id: string }>(
    `INSERT INTO youtube_uploads (video_id, youtube_video_id, youtube_url, channel, title, privacy_status, upload_duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (youtube_video_id) DO UPDATE SET
       youtube_url = EXCLUDED.youtube_url,
       title = EXCLUDED.title
     RETURNING id`,
    [
      upload.video_id,
      upload.youtube_video_id,
      upload.youtube_url,
      upload.channel,
      upload.title,
      upload.privacy_status || "public",
      upload.upload_duration_seconds,
    ],
  );
  const uploadId = result.rows[0].id;
  Logger.info(`YouTube upload guardado en BD: ${uploadId}`);
  return uploadId;
}

// ============================================
// RESOURCE USAGE
// ============================================

export async function saveResourceUsage(usage: DBResourceUsage): Promise<void> {
  const db = getDatabase();
  await db.query(
    `INSERT INTO resource_usage (execution_id, openai_tokens_total, openai_cost_usd, storage_used_mb, processing_time_seconds, edge_tts_duration_seconds, ffmpeg_duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      usage.execution_id,
      usage.openai_tokens_total,
      usage.openai_cost_usd,
      usage.storage_used_mb,
      usage.processing_time_seconds,
      usage.edge_tts_duration_seconds,
      usage.ffmpeg_duration_seconds,
    ],
  );
  Logger.info(`Resource usage guardado en BD`);
}

// ============================================
// ERROR LOGS
// ============================================

export async function logError(error: DBErrorLog): Promise<void> {
  const db = getDatabase();
  await db.query(
    `INSERT INTO error_logs (execution_id, error_type, error_message, stack_trace, context)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      error.execution_id,
      error.error_type,
      error.error_message,
      error.stack_trace,
      error.context ? JSON.stringify(error.context) : null,
    ],
  );
  Logger.error(`Error registrado en BD: ${error.error_type}`);
}

// ============================================
// ESTADÍSTICAS Y REPORTES
// ============================================

export async function getTopicPerformance(limit: number = 10): Promise<any[]> {
  const db = getDatabase();
  const result = await db.query(
    `SELECT * FROM topic_performance ORDER BY total_views DESC LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function getCostSummary(days: number = 30): Promise<any[]> {
  const db = getDatabase();
  const result = await db.query(
    `SELECT * FROM cost_summary 
     WHERE execution_date >= CURRENT_DATE - INTERVAL '${days} days'
     ORDER BY execution_date DESC`,
  );
  return result.rows;
}

export async function getChannelPerformance(): Promise<any[]> {
  const db = getDatabase();
  const result = await db.query("SELECT * FROM channel_performance");
  return result.rows;
}

// ============================================
// TOPIC IMAGES
// ============================================

export async function saveTopicImages(images: DBTopicImage[]): Promise<void> {
  if (images.length === 0) return;

  const db = getDatabase();

  for (const img of images) {
    await db.query(
      `INSERT INTO topic_images (id, topic_id, file_path, source_url, source_platform, unsplash_photo_id, pexels_photo_id, photographer_name, photographer_url, download_order)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (topic_id, download_order) DO UPDATE SET
         file_path = EXCLUDED.file_path,
         source_url = EXCLUDED.source_url`,
      [
        img.topic_id,
        img.file_path,
        img.source_url || null,
        img.source_platform || null,
        img.unsplash_photo_id || null,
        img.pexels_photo_id || null,
        img.photographer_name || null,
        img.photographer_url || null,
        img.download_order,
      ],
    );
  }

  Logger.info(`✅ Guardadas ${images.length} referencias de imágenes en BD`);
}

export async function getTopicImages(topicId: string): Promise<DBTopicImage[]> {
  const db = getDatabase();
  const result = await db.query<DBTopicImage>(
    `SELECT * FROM topic_images WHERE topic_id = $1 ORDER BY download_order`,
    [topicId],
  );
  return result.rows;
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const db = getDatabase();
    await db.query("SELECT 1");
    Logger.success("Base de datos disponible");
    return true;
  } catch (error) {
    Logger.error("Error en health check de base de datos:", error);
    return false;
  }
}
