import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env") });

export interface ChannelConfig {
  language: string;
  voice: string;
  youtubeClientId: string;
  youtubeClientSecret: string;
  youtubeRedirectUri: string;
  youtubeCredentialsPath: string;
}

export const CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4",
  },

  channels: {
    es: {
      language: "es",
      voice: process.env.ES_VOICE || "es-MX-DaliaNeural",
      youtubeClientId: process.env.ES_YOUTUBE_CLIENT_ID || "",
      youtubeClientSecret: process.env.ES_YOUTUBE_CLIENT_SECRET || "",
      youtubeRedirectUri:
        process.env.ES_YOUTUBE_REDIRECT_URI ||
        "http://localhost:3000/oauth2callback",
      youtubeCredentialsPath:
        process.env.ES_YOUTUBE_CREDENTIALS_PATH || "./credentials-es.json",
    } as ChannelConfig,
    en: {
      language: "en",
      voice: process.env.EN_VOICE || "en-US-JennyNeural",
      youtubeClientId: process.env.EN_YOUTUBE_CLIENT_ID || "",
      youtubeClientSecret: process.env.EN_YOUTUBE_CLIENT_SECRET || "",
      youtubeRedirectUri:
        process.env.EN_YOUTUBE_REDIRECT_URI ||
        "http://localhost:3000/oauth2callback",
      youtubeCredentialsPath:
        process.env.EN_YOUTUBE_CREDENTIALS_PATH || "./credentials-en.json",
    } as ChannelConfig,
  },

  video: {
    width: parseInt(process.env.VIDEO_WIDTH || "1080"),
    height: parseInt(process.env.VIDEO_HEIGHT || "1920"),
    fps: parseInt(process.env.VIDEO_FPS || "30"),
    maxDuration: parseInt(process.env.VIDEO_DURATION || "60"),
  },

  unsplash: {
    accessKey: process.env.UNSPLASH_ACCESS_KEY || "",
  },

  pexels: {
    apiKey: process.env.PEXELS_API_KEY || "",
  },

  paths: {
    assets: join(process.cwd(), "assets"),
    output: join(process.cwd(), "output"),
    outputEs: join(process.cwd(), "output", "es"),
    outputEn: join(process.cwd(), "output", "en"),
  },
};
