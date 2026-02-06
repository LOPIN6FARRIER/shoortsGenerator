import { k, kataxInfer } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Limit param schema
export const limitParamSchema = k.object({
  limit: k.number().optional().default(10),
});

export type LimitParam = kataxInfer<typeof limitParamSchema>;

// Validators
export function validateLimitParam(param: any): ValidationResult<LimitParam> {
  try {
    const data = limitParamSchema.parse(param);
    return { isValid: true, data };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [error.message],
    };
  }
}
