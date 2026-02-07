import OpenAI from "openai";
import { CONFIG } from "./config.js";
import { Logger } from "./utils.js";

interface LLMProvider {
  name: "ollama" | "openai";
  client: OpenAI;
}

let cachedProvider: LLMProvider | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 60000; // Re-verificar cada 60 segundos

/**
 * 🔍 Detecta si Ollama está disponible en el sistema
 */
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Timeout 2s

    const response = await fetch(`${CONFIG.ollama.baseUrl}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 🤖 Obtiene el cliente LLM apropiado (Ollama o OpenAI)
 * 
 * Orden de prioridad:
 * 1. Ollama (si está disponible localmente)
 * 2. OpenAI (fallback)
 */
export async function getLLMClient(): Promise<LLMProvider> {
  const now = Date.now();

  // Usar caché si es reciente
  if (cachedProvider && now - lastCheckTime < CACHE_DURATION) {
    return cachedProvider;
  }

  // Verificar disponibilidad de Ollama
  const ollamaAvailable = await isOllamaAvailable();

  if (ollamaAvailable && CONFIG.ollama.enabled) {
    Logger.info(`🦙 Usando Ollama (${CONFIG.ollama.model}) - Local LLM`);
    
    cachedProvider = {
      name: "ollama",
      client: new OpenAI({
        baseURL: CONFIG.ollama.baseUrl,
        apiKey: "ollama", // Ollama no requiere API key real
      }),
    };
  } else {
    if (!CONFIG.openai.apiKey) {
      throw new Error(
        "❌ Ni Ollama ni OpenAI están disponibles. Configura OPENAI_API_KEY o instala Ollama."
      );
    }

    Logger.info(`🤖 Usando OpenAI (${CONFIG.openai.model})`);
    
    cachedProvider = {
      name: "openai",
      client: new OpenAI({ apiKey: CONFIG.openai.apiKey }),
    };
  }

  lastCheckTime = now;
  return cachedProvider;
}

/**
 * 🎯 Obtiene el modelo apropiado según el provider
 */
export function getModel(provider: LLMProvider): string {
  return provider.name === "ollama" ? CONFIG.ollama.model : CONFIG.openai.model;
}

/**
 * 🔄 Fuerza recarga del provider en la próxima llamada
 */
export function resetLLMCache(): void {
  cachedProvider = null;
  lastCheckTime = 0;
  Logger.info("♻️  Cache de LLM reseteado");
}
