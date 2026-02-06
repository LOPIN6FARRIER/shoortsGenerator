import { k, kataxInfer } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Config schema
export const configSchema = k.object({
  key: k.string().minLength(1),
  value: k.string(),
  description: k.string().optional(),
});

export type ConfigBody = kataxInfer<typeof configSchema>;

// Bulk update schema
export const bulkUpdateSchema = k.object({
  configs: k.array(configSchema),
});

export type BulkUpdateBody = kataxInfer<typeof bulkUpdateSchema>;

// Key param schema
export const keyParamSchema = k.object({
  key: k.string().minLength(1),
});

export type KeyParam = kataxInfer<typeof keyParamSchema>;

// Validators
export function validateConfigBody(body: any): ValidationResult<ConfigBody> {
  try {
    const data = configSchema.parse(body);
    return { isValid: true, data };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [error.message],
    };
  }
}

export function validateBulkUpdateBody(
  body: any,
): ValidationResult<BulkUpdateBody> {
  try {
    const data = bulkUpdateSchema.parse(body);
    return { isValid: true, data };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [error.message],
    };
  }
}

export function validateKeyParam(param: any): ValidationResult<KeyParam> {
  try {
    const data = keyParamSchema.parse(param);
    return { isValid: true, data };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [error.message],
    };
  }
}
