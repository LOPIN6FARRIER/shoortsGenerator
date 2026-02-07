import { k } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Schema for scripts query parameters
export const scriptsQuerySchema = k.object({
  limit: k.number().optional(),
  offset: k.number().optional(),
  language: k.string().optional(),
});

// Schema for script ID
export const scriptIdSchema = k.object({
  id: k.string(),
});

/**
 * Validate scripts query parameters
 */
export function validateScriptsQuery(query: any): ValidationResult {
  try {
    // Convert string query params to numbers if they exist
    const parsedQuery: any = {};
    
    if (query.limit) {
      parsedQuery.limit = parseInt(query.limit);
    }
    if (query.offset) {
      parsedQuery.offset = parseInt(query.offset);
    }
    if (query.language) {
      parsedQuery.language = query.language;
    }

    const validatedQuery = scriptsQuerySchema.parse(parsedQuery);
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
 * Validate script ID
 */
export function validateScriptId(params: any): ValidationResult {
  try {
    const validatedParams = scriptIdSchema.parse(params);
    return { isValid: true, data: validatedParams };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [
        "Invalid script ID",
      ],
    };
  }
}
