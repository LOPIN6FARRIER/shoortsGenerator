import { k } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Schema for analytics query parameters
export const analyticsQuerySchema = k.object({
  limit: k.number().optional(),
  offset: k.number().optional(),
});

/**
 * Validate analytics query parameters
 */
export function validateAnalyticsQuery(query: any): ValidationResult {
  try {
    // Convert string query params to numbers if they exist
    const parsedQuery = {
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    };

    const validatedQuery = analyticsQuerySchema.parse(parsedQuery);
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

/**
 * Empty validator for summary endpoint (no parameters)
 */
export function validateEmpty(): ValidationResult {
  return { isValid: true, data: {} };
}
