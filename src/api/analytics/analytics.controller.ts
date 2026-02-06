import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";

export interface AnalyticsRecord {
  id: string;
  uploadId: string;
  views: number;
  likes: number;
  comments: number;
  watchTimeHours: number;
  ctrPercent: number;
  avgViewDurationSeconds: number;
  recordedAt: Date;
  videoTitle?: string;
  channel?: string;
  language?: string;
}

export async function getAnalytics(
  limit: number = 50,
  offset: number = 0,
): Promise<ControllerResult<AnalyticsRecord[]>> {
  try {
    const pool = getPool();

    const countQuery = `SELECT COUNT(*) FROM youtube_analytics`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    const query = `
    SELECT 
      a.id,
      a.upload_id as "uploadId",
      a.views,
      a.likes,
      a.comments,
      a.watch_time_hours as "watchTimeHours",
      a.ctr_percent as "ctrPercent",
      a.avg_view_duration_seconds as "avgViewDurationSeconds",
      a.fetched_at as "recordedAt",
      u.title as "videoTitle",
      COALESCE(c.name, u.channel::text) as channel,
      v.language
    FROM youtube_analytics a
    INNER JOIN youtube_uploads u ON a.upload_id = u.id
    INNER JOIN videos v ON u.video_id = v.id
    LEFT JOIN channels c ON v.language::text = c.language
    ORDER BY a.fetched_at DESC
    LIMIT $1 OFFSET $2
  `;

    const result = await pool.query(query, [limit, offset]);

    return createSuccessResult(
      "Analytics retrieved successfully",
      result.rows,
      200,
      total,
    );
  } catch (error: any) {
    return createErrorResult("Failed to get analytics", error.message);
  }
}

export async function getAnalyticsSummary(): Promise<
  ControllerResult<{
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalWatchTimeHours: number;
    avgCtrPercent: number;
    topVideos: Array<{
      title: string;
      views: number;
      likes: number;
      channel: string;
    }>;
  }>
> {
  try {
    const pool = getPool();

    const summaryQuery = `
    SELECT 
      COALESCE(SUM(a.views), 0) as total_views,
      COALESCE(SUM(a.likes), 0) as total_likes,
      COALESCE(SUM(a.comments), 0) as total_comments,
      COALESCE(SUM(a.watch_time_hours), 0) as total_watch_time,
      COALESCE(AVG(a.ctr_percent), 0) as avg_ctr
    FROM youtube_analytics a
    INNER JOIN (
      SELECT upload_id, MAX(fetched_at) as max_date
      FROM youtube_analytics
      GROUP BY upload_id
    ) latest ON a.upload_id = latest.upload_id AND a.fetched_at = latest.max_date
  `;

    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0];

    const topVideosQuery = `
    SELECT 
      u.title,
      a.views,
      a.likes,
      COALESCE(c.name, u.channel::text) as channel
    FROM youtube_analytics a
    INNER JOIN youtube_uploads u ON a.upload_id = u.id
    INNER JOIN videos v ON u.video_id = v.id
    LEFT JOIN channels c ON v.language::text = c.language
    INNER JOIN (
      SELECT upload_id, MAX(fetched_at) as max_date
      FROM youtube_analytics
      GROUP BY upload_id
    ) latest ON a.upload_id = latest.upload_id AND a.fetched_at = latest.max_date
    ORDER BY a.views DESC
    LIMIT 5
  `;

    const topVideosResult = await pool.query(topVideosQuery);

    const result = {
      totalViews: parseInt(summary.total_views) || 0,
      totalLikes: parseInt(summary.total_likes) || 0,
      totalComments: parseInt(summary.total_comments) || 0,
      totalWatchTimeHours: parseFloat(summary.total_watch_time) || 0,
      avgCtrPercent: parseFloat(summary.avg_ctr) || 0,
      topVideos: topVideosResult.rows,
    };

    return createSuccessResult(
      "Analytics summary retrieved successfully",
      result,
    );
  } catch (error: any) {
    return createErrorResult("Failed to get analytics summary", error.message);
  }
}
