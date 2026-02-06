import { k } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Schema for topics query parameters
export const topicsQuerySchema = k.object({
  limit: k.number().optional(),
  offset: k.number().optional(),
});

/**
 * Validate topics query parameters
 */
export function validateTopicsQuery(query: any): ValidationResult {
  try {
    // Convert string query params to numbers if they exist
    const parsedQuery = {
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    };

    const validatedQuery = topicsQuerySchema.parse(parsedQuery);
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
