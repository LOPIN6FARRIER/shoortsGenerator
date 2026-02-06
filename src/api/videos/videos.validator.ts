import { k } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Schema for video ID parameter
export const videoIdSchema = k.object({
  id: k.string().minLength(1),
});

// Schema for video query parameters
export const videoQuerySchema = k.object({
  limit: k.number().optional(),
  offset: k.number().optional(),
  language: k.string().optional(),
});

/**
 * Validate video ID from route params
 */
export function validateVideoId(params: any): ValidationResult {
  try {
    const validatedParams = videoIdSchema.parse(params);
    return { isValid: true, data: validatedParams };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || ["Invalid video ID"],
    };
  }
}

/**
 * Validate video query parameters
 */
export function validateVideoQuery(query: any): ValidationResult {
  try {
    // Convert string query params to numbers if they exist
    const parsedQuery = {
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      language: query.language,
    };

    const validatedQuery = videoQuerySchema.parse(parsedQuery);
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
