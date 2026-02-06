import { Request, Response } from "express";
import { getPool } from "../../database.js";

export async function healthCheckHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Check database
    const pool = getPool();
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "API is healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Health check failed",
      error: error.message,
    });
  }
}
