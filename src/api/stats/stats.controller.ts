import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";

export interface DashboardStats {
  totalChannels: number;
  totalVideos: number;
  totalExecutions: number;
  successRate: number;
  totalTokens: number;
  totalCostUSD: number;
  avgProcessingTime: number;
}

export interface RecentActivity {
  id: string;
  type: "execution" | "upload" | "error";
  title: string;
  timestamp: Date;
  status?: string;
}

export async function getDashboardStats(): Promise<
  ControllerResult<DashboardStats>
> {
  try {
    const pool = getPool();

    const statsQuery = `
    SELECT 
      (SELECT COUNT(DISTINCT language) FROM scripts) as total_channels,
      (SELECT COUNT(*) FROM videos) as total_videos,
      (SELECT COUNT(*) FROM pipeline_executions) as total_executions,
      (SELECT COUNT(*) FROM pipeline_executions WHERE status = 'completed') as completed_executions,
      (SELECT COALESCE(SUM(openai_tokens_total), 0) FROM resource_usage) as total_tokens,
      (SELECT COALESCE(SUM(openai_cost_usd), 0) FROM resource_usage) as total_cost,
      (SELECT COALESCE(AVG(processing_time_seconds), 0) FROM resource_usage) as avg_processing_time
  `;

    const result = await pool.query(statsQuery);
    const row = result.rows[0];

    const successRate =
      row.total_executions > 0
        ? Math.round((row.completed_executions / row.total_executions) * 100)
        : 0;

    const stats: DashboardStats = {
      totalChannels: parseInt(row.total_channels) || 2,
      totalVideos: parseInt(row.total_videos) || 0,
      totalExecutions: parseInt(row.total_executions) || 0,
      successRate,
      totalTokens: parseInt(row.total_tokens) || 0,
      totalCostUSD: parseFloat(row.total_cost) || 0,
      avgProcessingTime: Math.round(parseFloat(row.avg_processing_time) || 0),
    };

    return createSuccessResult("Stats retrieved successfully", stats);
  } catch (error: any) {
    return createErrorResult("Error fetching stats", error.message, 500);
  }
}

export async function getRecentActivity(
  limit: number = 10,
): Promise<ControllerResult<RecentActivity[]>> {
  try {
    const pool = getPool();

    const query = `
    (
      SELECT 
        id::text,
        'execution' as type,
        'Pipeline execution' as title,
        started_at as timestamp,
        status::text
      FROM pipeline_executions
      ORDER BY started_at DESC
      LIMIT $1
    )
    UNION ALL
    (
      SELECT 
        id::text,
        'upload' as type,
        title,
        uploaded_at as timestamp,
        privacy_status::text as status
      FROM youtube_uploads
      ORDER BY uploaded_at DESC
      LIMIT $1
    )
    UNION ALL
    (
      SELECT 
        id::text,
        'error' as type,
        error_message as title,
        occurred_at as timestamp,
        error_type as status
      FROM error_logs
      ORDER BY occurred_at DESC
      LIMIT $1
    )
    ORDER BY timestamp DESC
    LIMIT $1
  `;

    const result = await pool.query(query, [limit]);
    return createSuccessResult(
      "Recent activity retrieved successfully",
      result.rows,
    );
  } catch (error: any) {
    return createErrorResult(
      "Error fetching recent activity",
      error.message,
      500,
    );
  }
}
