import { k } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Schema for pipeline execution ID parameter
export const pipelineIdSchema = k.object({
  id: k.string().minLength(1),
});

// Schema for pipeline query parameters
export const pipelineQuerySchema = k.object({
  limit: k.number().optional(),
  offset: k.number().optional(),
});

/**
 * Validate pipeline execution ID from route params
 */
export function validatePipelineId(params: any): ValidationResult {
  try {
    const validatedParams = pipelineIdSchema.parse(params);
    return { isValid: true, data: validatedParams };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [
        "Invalid pipeline execution ID",
      ],
    };
  }
}

/**
 * Validate pipeline query parameters
 */
export function validatePipelineQuery(query: any): ValidationResult {
  try {
    // Convert string query params to numbers if they exist
    const parsedQuery = {
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    };

    const validatedQuery = pipelineQuerySchema.parse(parsedQuery);
    return { isValid: true, data: validatedQuery };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [
        "Invalid query parameters",
      ],
    };
  }
}
