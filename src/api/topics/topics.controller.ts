import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";

export interface TopicRecord {
  id: string;
  executionId: string;
  title: string;
  description: string;
  imageKeywords: string;
  videoKeywords: string;
  openaiModel: string;
  openaiTokensUsed: number;
  createdAt: Date;
}

export async function getTopics(
  limit: number = 20,
  offset: number = 0,
): Promise<ControllerResult<TopicRecord[]>> {
  try {
    const pool = getPool();

    const countQuery = `SELECT COUNT(*) FROM topics`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    const query = `
    SELECT 
      id,
      execution_id as "executionId",
      title,
      description,
      image_keywords as "imageKeywords",
      video_keywords as "videoKeywords",
      openai_model as "openaiModel",
      openai_tokens_used as "openaiTokensUsed",
      created_at as "createdAt"
    FROM topics
    ORDER BY generated_at DESC, created_at DESC
    LIMIT $1 OFFSET $2
  `;

    const result = await pool.query(query, [limit, offset]);

    return createSuccessResult(
      "Topics retrieved successfully",
      result.rows,
      200,
      total,
    );
  } catch (error: any) {
    return createErrorResult("Failed to get topics", error.message);
  }
}
