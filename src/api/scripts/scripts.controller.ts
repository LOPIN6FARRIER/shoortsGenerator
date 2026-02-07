import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";

export interface ScriptRecord {
  id: string;
  topicId: string;
  topicTitle: string;
  language: string;
  title: string;
  narrative: string;
  description: string;
  tags: string[];
  estimatedDuration: number;
  openaiModel: string;
  openaiTokensUsed: number;
  createdAt: Date;
}

export async function getScripts(
  limit: number = 20,
  offset: number = 0,
  language?: string,
): Promise<ControllerResult<ScriptRecord[]>> {
  try {
    const pool = getPool();

    // Build dynamic WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (language) {
      conditions.push(`s.language = $${paramIndex}`);
      params.push(language);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const countQuery = `SELECT COUNT(*) FROM scripts s ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Main query
    const query = `
      SELECT 
        s.id,
        s.topic_id as "topicId",
        t.title as "topicTitle",
        s.language,
        s.title,
        s.narrative,
        s.description,
        s.tags,
        s.estimated_duration as "estimatedDuration",
        s.openai_model as "openaiModel",
        s.openai_tokens_used as "openaiTokensUsed",
        s.created_at as "createdAt"
      FROM scripts s
      LEFT JOIN topics t ON s.topic_id = t.id
      ${whereClause}
      ORDER BY s.generated_at DESC, s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await pool.query(query, params);

    return createSuccessResult(
      "Scripts retrieved successfully",
      result.rows,
      200,
      total,
    );
  } catch (error: any) {
    return createErrorResult("Failed to get scripts", error.message);
  }
}

export async function getScriptById(
  id: string,
): Promise<ControllerResult<ScriptRecord>> {
  try {
    const pool = getPool();

    const query = `
      SELECT 
        s.id,
        s.topic_id as "topicId",
        t.title as "topicTitle",
        s.language,
        s.title,
        s.narrative,
        s.description,
        s.tags,
        s.estimated_duration as "estimatedDuration",
        s.openai_model as "openaiModel",
        s.openai_tokens_used as "openaiTokensUsed",
        s.created_at as "createdAt"
      FROM scripts s
      LEFT JOIN topics t ON s.topic_id = t.id
      WHERE s.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return createErrorResult("Script not found", `Script with id ${id} not found`, 404);
    }

    return createSuccessResult(
      "Script retrieved successfully",
      result.rows[0],
      200,
    );
  } catch (error: any) {
    return createErrorResult("Failed to get script", error.message);
  }
}
