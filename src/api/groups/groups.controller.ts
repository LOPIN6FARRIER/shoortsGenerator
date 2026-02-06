import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";
import type { CreateGroupBody, UpdateGroupBody } from "./groups.validator.js";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupWithChannels extends Group {
  channels_count: number;
}

export async function getGroups(): Promise<
  ControllerResult<GroupWithChannels[]>
> {
  try {
    const pool = getPool();
    const result = await pool.query<GroupWithChannels>(
      `SELECT 
        g.*,
        COUNT(c.id) as channels_count
      FROM channel_groups g
      LEFT JOIN channels c ON c.group_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at DESC`,
    );

    return createSuccessResult("Groups retrieved successfully", result.rows);
  } catch (error: any) {
    return createErrorResult("Error retrieving groups", error.message, 500);
  }
}

export async function getGroup(id: string): Promise<ControllerResult<Group>> {
  try {
    const pool = getPool();
    const result = await pool.query<Group>(
      `SELECT * FROM channel_groups WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return createErrorResult("Group not found", undefined, 404);
    }

    return createSuccessResult("Group retrieved successfully", result.rows[0]);
  } catch (error: any) {
    return createErrorResult("Error retrieving group", error.message, 500);
  }
}

export async function createGroup(
  data: CreateGroupBody,
): Promise<ControllerResult<Group>> {
  try {
    const pool = getPool();

    const result = await pool.query<Group>(
      `INSERT INTO channel_groups (name, description, enabled)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.description || null, data.enabled ?? true],
    );

    return createSuccessResult("Group created successfully", result.rows[0]);
  } catch (error: any) {
    return createErrorResult("Error creating group", error.message, 500);
  }
}

export async function updateGroup(
  id: string,
  data: UpdateGroupBody,
): Promise<ControllerResult<Group>> {
  try {
    const pool = getPool();

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
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

    const result = await pool.query<Group>(
      `UPDATE channel_groups 
       SET ${fields.join(", ")} 
       WHERE id = $${paramIndex}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return createErrorResult("Group not found", undefined, 404);
    }

    return createSuccessResult("Group updated successfully", result.rows[0]);
  } catch (error: any) {
    return createErrorResult("Error updating group", error.message, 500);
  }
}

export async function deleteGroup(
  id: string,
): Promise<ControllerResult<{ success: boolean }>> {
  try {
    const pool = getPool();

    // Verificar si hay canales usando este grupo
    const channelCheck = await pool.query(
      `SELECT COUNT(*) as count FROM channels WHERE group_id = $1`,
      [id],
    );

    if (parseInt(channelCheck.rows[0].count) > 0) {
      return createErrorResult(
        "Cannot delete group with assigned channels",
        "Remove channels from this group first",
        400,
      );
    }

    const result = await pool.query(
      `DELETE FROM channel_groups WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) {
      return createErrorResult("Group not found", undefined, 404);
    }

    return createSuccessResult("Group deleted successfully", { success: true });
  } catch (error: any) {
    return createErrorResult("Error deleting group", error.message, 500);
  }
}
