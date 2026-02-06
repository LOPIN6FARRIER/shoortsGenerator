import { getPool } from "../../database.js";
import {
  createSuccessResult,
  createErrorResult,
  type ControllerResult,
} from "../shared/api.utils.js";

export interface AppConfig {
  key: string;
  value: string;
  description: string | null;
  updated_at: Date;
}

/**
 * Get all configuration items
 */
export async function getConfigs(): Promise<ControllerResult<AppConfig[]>> {
  try {
    const pool = getPool();

    const result = await pool.query<AppConfig>(
      `SELECT key, value, description, updated_at
       FROM app_config
       ORDER BY key ASC`,
    );

    return createSuccessResult("Configs retrieved successfully", result.rows);
  } catch (error: any) {
    return createErrorResult("Error fetching configs", error.message, 500);
  }
}

/**
 * Get a specific configuration value
 */
export async function getConfig(
  key: string,
): Promise<ControllerResult<AppConfig>> {
  try {
    const pool = getPool();

    const result = await pool.query<AppConfig>(
      "SELECT key, value, description, updated_at FROM app_config WHERE key = $1",
      [key],
    );

    if (result.rows.length === 0) {
      return createErrorResult("Configuration not found", undefined, 404);
    }

    return createSuccessResult("Config retrieved successfully", result.rows[0]);
  } catch (error: any) {
    return createErrorResult("Error fetching config", error.message, 500);
  }
}

/**
 * Create or update a configuration item
 */
export async function upsertConfig(data: {
  key: string;
  value: string;
  description?: string;
}): Promise<ControllerResult<AppConfig>> {
  try {
    const pool = getPool();

    const result = await pool.query<AppConfig>(
      `INSERT INTO app_config (key, value, description, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) 
       DO UPDATE SET 
         value = EXCLUDED.value,
         description = EXCLUDED.description,
         updated_at = NOW()
       RETURNING *`,
      [data.key, data.value, data.description || null],
    );

    return createSuccessResult(
      `Config ${data.key} saved successfully`,
      result.rows[0],
    );
  } catch (error: any) {
    return createErrorResult("Error saving config", error.message, 500);
  }
}

/**
 * Bulk update configuration items
 */
export async function bulkUpdateConfig(
  configs: Array<{
    key: string;
    value: string;
    description?: string;
  }>,
): Promise<ControllerResult<{ count: number }>> {
  try {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const config of configs) {
        await client.query(
          `INSERT INTO app_config (key, value, description, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (key) 
           DO UPDATE SET 
             value = EXCLUDED.value,
             description = EXCLUDED.description,
             updated_at = NOW()`,
          [config.key, config.value, config.description || null],
        );
      }

      await client.query("COMMIT");
      return createSuccessResult(
        `Bulk updated ${configs.length} config items`,
        { count: configs.length },
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    return createErrorResult("Error bulk updating configs", error.message, 500);
  }
}

/**
 * Delete a configuration item
 */
export async function deleteConfig(
  key: string,
): Promise<ControllerResult<null>> {
  try {
    const pool = getPool();

    const result = await pool.query(
      "DELETE FROM app_config WHERE key = $1 RETURNING *",
      [key],
    );

    if (result.rows.length === 0) {
      return createErrorResult("Configuration not found", undefined, 404);
    }

    return createSuccessResult("Configuration deleted successfully", null);
  } catch (error: any) {
    return createErrorResult("Error deleting config", error.message, 500);
  }
}
