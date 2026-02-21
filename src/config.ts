import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env") });

export interface ChannelConfig {
  language: "es" | "en";
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

  ollama: {
    enabled: process.env.OLLAMA_ENABLED !== "false", // Habilitado por defecto
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: process.env.OLLAMA_MODEL || "qwen2.5:14b",
  },
  unsplash: {
    accessKey: process.env.UNSPLASH_ACCESS_KEY || "",
  },

  pexels: {
    apiKey: process.env.PEXELS_API_KEY || "",
  },

  video: {
    width: Number(process.env.VIDEO_WIDTH || 1080),
    height: Number(process.env.VIDEO_HEIGHT || 1920),
    fps: Number(process.env.VIDEO_FPS || 30),
    useVideos: process.env.USE_PEXELS_VIDEOS === "true",
  },

  paths: {
    assets: join(process.cwd(), "assets"),
    output: join(process.cwd(), "output"),
    outputEs: join(process.cwd(), "output", "es"),
    outputEn: join(process.cwd(), "output", "en"),
    images: join(process.cwd(), "public", "images"), // Carpeta persistente para imágenes reutilizables
  },
};
