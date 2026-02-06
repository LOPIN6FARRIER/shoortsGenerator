import { k, kataxInfer } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Group schema
export const groupSchema = k.object({
  name: k.string().minLength(1).maxLength(100),
  description: k.string().optional(),
  enabled: k.boolean().optional().default(true),
});

export type CreateGroupBody = kataxInfer<typeof groupSchema>;

export const updateGroupSchema = groupSchema.partial();
export type UpdateGroupBody = kataxInfer<typeof updateGroupSchema>;

export const idParamSchema = k.object({
  id: k.string().minLength(1),
});

export type IdParam = kataxInfer<typeof idParamSchema>;

// Validators
export function validateCreateGroupBody(
  body: any,
): ValidationResult<CreateGroupBody> {
  try {
    const data = groupSchema.parse(body);
    return { isValid: true, data };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [error.message],
    };
  }
}

export function validateUpdateGroupBody(
  body: any,
): ValidationResult<UpdateGroupBody> {
  try {
    const data = updateGroupSchema.parse(body);
    return { isValid: true, data };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [error.message],
    };
  }
}

export function validateIdParam(params: any): ValidationResult<IdParam> {
  try {
    const data = idParamSchema.parse(params);
    return { isValid: true, data };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [error.message],
    };
  }
}
