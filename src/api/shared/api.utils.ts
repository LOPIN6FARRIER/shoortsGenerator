import { Request, Response } from "express";
import { Logger } from "../../utils.js";

export interface ControllerResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  total?: number; // For paginated responses
  error?: string;
  statusCode?: number;
}

export function createSuccessResult<T>(
  message: string,
  data?: T,
  statusCode = 200,
  total?: number,
): ControllerResult<T> {
  return {
    success: true,
    message,
    statusCode,
    data,
    ...(total !== undefined && { total }),
  };
}

export function createErrorResult(
  message: string,
  error?: string,
  statusCode = 400,
): ControllerResult {
  return { success: false, message, error, statusCode };
}

export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors?: string[];
}

export async function sendResponse<V, D>(
  req: Request,
  res: Response,
  validator: () => Promise<ValidationResult<V>> | ValidationResult<V>,
  controller: (validData: V) => Promise<ControllerResult<D>>,
): Promise<void> {
  try {
    // 1. Validate
    const validation = await validator();
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
      return;
    }

    // 2. Execute controller
    const result = await controller(validation.data!);

    // 3. Send response
    res.status(result.statusCode || 200).json(result);
  } catch (error: any) {
    Logger.error("Error in sendResponse:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
