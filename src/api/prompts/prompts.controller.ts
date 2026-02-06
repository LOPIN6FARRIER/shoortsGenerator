import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";
import type {
  CreatePromptBody,
  UpdatePromptBody,
  PromptQueryParams,
} from "./prompts.validator.js";

export interface Prompt {
  id: string;
  channel_id: string;
  type: "topic" | "script" | "title" | "description";
  name: string;
  prompt_text: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPrompts(
  params: PromptQueryParams,
): Promise<ControllerResult<Prompt[]>> {
  try {
    const pool = getPool();
    const { channel_id, type, enabled } = params;

    let query = `SELECT * FROM prompts WHERE 1=1`;
    const values: any[] = [];
    let paramIndex = 1;

    if (channel_id) {
      query += ` AND channel_id = $${paramIndex++}`;
      values.push(channel_id);
    }

    if (type) {
      query += ` AND type = $${paramIndex++}`;
      values.push(type);
    }

    if (enabled !== undefined) {
      query += ` AND enabled = $${paramIndex++}`;
      values.push(enabled);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query<Prompt>(query, values);

    return createSuccessResult(
      "Prompts retrieved successfully",
      result.rows,
      200,
      result.rows.length,
    );
  } catch (error: any) {
    return createErrorResult("Error fetching prompts", error.message, 500);
  }
}

export async function getPrompt(id: string): Promise<ControllerResult<Prompt>> {
  try {
    const pool = getPool();
    const result = await pool.query<Prompt>(
      `SELECT * FROM prompts WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return createErrorResult("Prompt not found", undefined, 404);
    }

    return createSuccessResult("Prompt retrieved successfully", result.rows[0]);
  } catch (error: any) {
    return createErrorResult("Error fetching prompt", error.message, 500);
  }
}

export async function createPrompt(
  data: CreatePromptBody,
): Promise<ControllerResult<Prompt>> {
  try {
    const pool = getPool();
    const result = await pool.query<Prompt>(
      `INSERT INTO prompts (channel_id, type, name, prompt_text, enabled)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.channel_id,
        data.type,
        data.name,
        data.prompt_text,
        data.enabled !== false,
      ],
    );

    return createSuccessResult(
      "Prompt created successfully",
      result.rows[0],
      201,
    );
  } catch (error: any) {
    // Check for unique constraint violation
    if (error.code === "23505") {
      return createErrorResult(
        "A prompt with this type and name already exists for this channel",
        error.message,
        409,
      );
    }
    return createErrorResult("Error creating prompt", error.message, 500);
  }
}

export async function updatePrompt(
  id: string,
  data: UpdatePromptBody,
): Promise<ControllerResult<Prompt>> {
  try {
    const pool = getPool();

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }
    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.prompt_text !== undefined) {
      fields.push(`prompt_text = $${paramIndex++}`);
      values.push(data.prompt_text);
    }
    if (data.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      values.push(data.enabled);
    }

    if (fields.length === 0) {
      return createErrorResult("No fields to update", undefined, 400);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE prompts 
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query<Prompt>(query, values);

    if (result.rows.length === 0) {
      return createErrorResult("Prompt not found", undefined, 404);
    }

    return createSuccessResult("Prompt updated successfully", result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return createErrorResult(
        "A prompt with this type and name already exists for this channel",
        error.message,
        409,
      );
    }
    return createErrorResult("Error updating prompt", error.message, 500);
  }
}

export async function deletePrompt(
  id: string,
): Promise<ControllerResult<void>> {
  try {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM prompts WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return createErrorResult("Prompt not found", undefined, 404);
    }

    return createSuccessResult("Prompt deleted successfully");
  } catch (error: any) {
    return createErrorResult("Error deleting prompt", error.message, 500);
  }
}
