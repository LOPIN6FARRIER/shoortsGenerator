import { k, kataxInfer } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Validator schemas
export const promptTypeSchema = k.union([
  k.literal("topic"),
  k.literal("script"),
  k.literal("title"),
  k.literal("description"),
]);

export const createPromptSchema = k.object({
  channel_id: k.string(),
  type: promptTypeSchema,
  name: k.string(),
  prompt_text: k.string(),
  enabled: k.boolean().optional(),
});

export const updatePromptSchema = k.object({
  type: promptTypeSchema.optional(),
  name: k.string().optional(),
  prompt_text: k.string().optional(),
  enabled: k.boolean().optional(),
});

export const promptIdSchema = k.object({
  id: k.string(),
});

export const promptQuerySchema = k.object({
  channel_id: k.string().optional(),
  type: promptTypeSchema.optional(),
  enabled: k.boolean().optional(),
});

// Types
export type CreatePromptBody = {
  channel_id: string;
  type: "topic" | "script" | "title" | "description";
  name: string;
  prompt_text: string;
  enabled?: boolean;
};

export type UpdatePromptBody = {
  type?: "topic" | "script" | "title" | "description";
  name?: string;
  prompt_text?: string;
  enabled?: boolean;
};

export type PromptQueryParams = {
  channel_id?: string;
  type?: "topic" | "script" | "title" | "description";
  enabled?: boolean;
};

/**
 * Validate prompt ID from route params
 */
export function validatePromptId(params: any): ValidationResult {
  try {
    const validatedParams = promptIdSchema.parse(params);
    return { isValid: true, data: validatedParams };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || ["Invalid prompt ID"],
    };
  }
}

/**
 * Validate prompt query parameters
 */
export function validatePromptQuery(query: any): ValidationResult {
  try {
    // Convert string "true"/"false" to boolean
    const parsedQuery = {
      channel_id: query.channel_id,
      type: query.type,
      enabled:
        query.enabled !== undefined
          ? query.enabled === "true" || query.enabled === true
          : undefined,
    };

    const validatedQuery = promptQuerySchema.parse(parsedQuery);
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
 * Validate create prompt body
 */
export function validateCreatePrompt(body: any): ValidationResult {
  try {
    const validatedBody = createPromptSchema.parse(body);
    return { isValid: true, data: validatedBody };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [
        "Invalid prompt data",
      ],
    };
  }
}

/**
 * Validate update prompt body
 */
export function validateUpdatePrompt(body: any): ValidationResult {
  try {
    const validatedBody = updatePromptSchema.parse(body);
    return { isValid: true, data: validatedBody };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [
        "Invalid prompt data",
      ],
    };
  }
}
