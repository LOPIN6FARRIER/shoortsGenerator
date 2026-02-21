import OpenAI from "openai";
import { CONFIG } from "./config.js";
import { Logger } from "./utils.js";

type ProviderName = "ollama" | "openai";

interface LLMProvider {
  name: ProviderName;
  client: OpenAI;
  model: string;
}

// Cache por provider para manejar fallbacks
let lastFailedProvider: ProviderName | null = null;
let lastFailTime = 0;
const RETRY_FAILED_PROVIDER_AFTER = 5 * 60 * 1000; // Reintentar provider fallido después de 5 min

/**
 * 🔍 Detecta si Ollama está disponible en el sistema
 */
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const baseUrl = CONFIG.ollama.baseUrl.replace(/\/v1\/?$/, "");
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 🔍 Verifica si OpenAI está configurado
 */
function isOpenAIConfigured(): boolean {
  return !!CONFIG.openai.apiKey;
}

/**
 * 🤖 Obtiene el cliente LLM con sistema de fallback
 *
 * Orden de prioridad:
 * 1. Ollama (local, sin límites)
 * 2. OpenAI (de pago, fallback)
 */
export async function getLLMClient(): Promise<LLMProvider> {
  // Si el provider fallido ya pasó el tiempo de retry, reseteamos
  if (
    lastFailedProvider &&
    Date.now() - lastFailTime > RETRY_FAILED_PROVIDER_AFTER
  ) {
    Logger.info(
      `♻️  Reintentando provider ${lastFailedProvider} después de cooldown`,
    );
    lastFailedProvider = null;
  }

  // Intentar Ollama primero
  const ollamaAvailable = await isOllamaAvailable();
  if (
    ollamaAvailable &&
    CONFIG.ollama.enabled &&
    lastFailedProvider !== "ollama"
  ) {
    Logger.info(`🦙 Usando Ollama (${CONFIG.ollama.model}) - Local LLM`);
    return {
      name: "ollama",
      client: new OpenAI({
        baseURL: CONFIG.ollama.baseUrl,
        apiKey: "ollama",
      }),
      model: CONFIG.ollama.model,
    };
  }

  // Fallback: OpenAI
  if (isOpenAIConfigured()) {
    Logger.info(`🤖 Usando OpenAI (${CONFIG.openai.model}) - Fallback de pago`);
    return {
      name: "openai",
      client: new OpenAI({ apiKey: CONFIG.openai.apiKey }),
      model: CONFIG.openai.model,
    };
  }

  throw new Error(
    "❌ No hay ningún LLM disponible. Configura OPENAI_API_KEY o instala Ollama.",
  );
}

/**
 * 🎯 Obtiene el modelo del provider
 */
export function getModel(provider: LLMProvider): string {
  return provider.model;
}

/**
 * ❌ Marca un provider como fallido (para activar fallback)
 */
export function markProviderFailed(providerName: ProviderName): void {
  lastFailedProvider = providerName;
  lastFailTime = Date.now();
  Logger.warn(
    `⚠️  Provider ${providerName} marcado como fallido, usando fallback...`,
  );
}

/**
 * 🔄 Fuerza recarga del provider en la próxima llamada
 */
export function resetLLMCache(): void {
  lastFailedProvider = null;
  lastFailTime = 0;
  Logger.info("♻️  Cache de LLM reseteado");
}
