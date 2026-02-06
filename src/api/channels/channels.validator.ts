import { k, kataxInfer } from "katax-core";
import type { ValidationResult } from "../shared/api.utils.js";

// Channel schema
export const channelSchema = k.object({
  language: k.string().minLength(2).maxLength(5).default("es"), // "es", "en", "fr", etc.
  name: k.string().minLength(1),
  voice: k.string().minLength(1).default("es-MX-DaliaNeural"), // "es-MX-DaliaNeural"
  voiceRate: k.string().optional().default("+8%"),
  voicePitch: k.string().optional().default("+2Hz"),
  groupId: k.string().optional().nullable(),
  youtubeClientId: k.string().optional(),
  youtubeClientSecret: k.string().optional(),
  youtubeRedirectUri: k.string().optional(),
  youtubeCredentialsPath: k.string().optional(),
  youtubeAccessToken: k.string().optional(),
  youtubeRefreshToken: k.string().optional(),
  youtubeTokenExpiry: k.number().optional(),
  youtubeRefreshTokenExpiresIn: k.number().optional(),
  youtubeTokenType: k.string().optional(),
  youtubeScope: k.string().optional(),
  enabled: k.boolean().optional().default(true),
  cronSchedule: k.string().optional().default("0 0,8,16 * * *"),

  // Visual config
  subtitleColor: k.string().optional().default("#00D7FF"),
  subtitleOutlineColor: k.string().optional().default("#000000"),
  fontSize: k.number().optional().default(22),
  maxCharsPerLine: k.number().optional().default(16),

  // Video config
  videoWidth: k.number().optional().default(1080),
  videoHeight: k.number().optional().default(1920),
  videoFps: k.number().optional().default(30),
  videoMaxDuration: k.number().optional().default(60),
  usePexelsVideos: k.boolean().optional().default(false),
});

export type CreateChannelBody = kataxInfer<typeof channelSchema>;

export const updateChannelSchema = channelSchema.partial();
export type UpdateChannelBody = kataxInfer<typeof updateChannelSchema>;

export const idParamSchema = k.object({
  id: k.string().minLength(1),
});

export type IdParam = kataxInfer<typeof idParamSchema>;

// Validators
export function validateCreateChannelBody(
  body: any,
): ValidationResult<CreateChannelBody> {
  try {
    const data = channelSchema.parse(body);
    return { isValid: true, data };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => e.message) || [error.message],
    };
  }
}

export function validateUpdateChannelBody(
  body: any,
): ValidationResult<UpdateChannelBody> {
  try {
    const data = updateChannelSchema.parse(body);
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
