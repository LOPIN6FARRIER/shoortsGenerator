import OpenAI from "openai";
import { Topic } from "./topic.js";
import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
import { get } from "http";
import { getLattestScript } from "./database.js";

export interface Script {
  language: string;
  topic: Topic;
  title: string;
  narrative: string;
  description: string;
  tags: string[];
  estimatedDuration: number;
  tokensUsed?: number;
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!CONFIG.openai.apiKey) {
    throw new Error("OPENAI_API_KEY no configurada en .env");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: CONFIG.openai.apiKey });
  }

  return openaiClient;
}

export async function generateScript(
  topic: Topic,
  language: "es" | "en",
): Promise<Script> {
  Logger.info(`Generando guion con IA para: ${topic.id} (${language})`);

  const client = getOpenAIClient();
  const languageName = language === "es" ? "español" : "inglés";

  const prompt = `Escribe un guion narrativo de 45-60 segundos para un YouTube Short sobre: ${topic.title} - ${topic.description}

Idioma: ${languageName}
Tono: Curioso, educativo, conversacional
Estilo: Narrativa continua (NO listas ni enumeraciones)
Requisitos:
- 120-160 palabras
- Datos específicos (fechas, nombres, lugares)
- Sin intros genéricas ("Sabías que...", "Hoy te cuento...")
- Sin preguntas al espectador
- Historia con inicio, desarrollo y cierre

Devuelve SOLO el texto narrativo, sin formato adicional.`;

  try {
    const completion = await client.chat.completions.create({
      model: CONFIG.openai.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });

    const narrative = completion.choices[0]?.message?.content?.trim();

    if (!narrative) {
      throw new Error("OpenAI no devolvió contenido");
    }

    const wordCount = narrative.split(/\s+/).length;
    const estimatedDuration = Math.ceil((wordCount / 150) * 60);

    const titlePrompt = `Genera un título corto y atractivo (máximo 60 caracteres) para este video en ${languageName}: ${narrative.slice(0, 200)}...
Devuelve SOLO el título, sin comillas ni formato adicional.`;

    const titleCompletion = await client.chat.completions.create({
      model: CONFIG.openai.model,
      messages: [{ role: "user", content: titlePrompt }],
      temperature: 0.7,
      max_tokens: 50,
    });

    const title =
      titleCompletion.choices[0]?.message?.content?.trim() ||
      `${topic.title}: La Historia Oculta`;

    // Capturar tokens consumidos (narrativa + título)
    const narrativeTokens = completion.usage?.total_tokens || 0;
    const titleTokens = titleCompletion.usage?.total_tokens || 0;
    const tokensUsed = narrativeTokens + titleTokens;

    const script: Script = {
      language,
      topic,
      title,
      narrative,
      description: topic.description,
      tags: ["shorts", "historia", "curiosidades", "inventos", topic.id],
      estimatedDuration,
      tokensUsed,
    };

    Logger.success(
      `Guion IA generado: ${title} (~${estimatedDuration}s, ${wordCount} palabras, ${tokensUsed} tokens)`,
    );
    return script;
  } catch (error: any) {
    Logger.error("Error generando guion con OpenAI:", error.message);
    throw new Error(`Error en generación de guion: ${error.message}`);
  }
}

export async function generateBilingualScripts(
  topic: Topic,
): Promise<{ es: Script; en: Script }> {
  Logger.info("Generando scripts bilingües con IA...");

  if (process.env.DEBBUGING === "true") {
    const latestScript = await getLattestScript();
    if (latestScript) {
      return { es: latestScript as Script, en: latestScript as Script };
    }
  }

  const [es, en] = await Promise.all([
    generateScript(topic, "es"),
    generateScript(topic, "en"),
  ]);

  return { es, en };
}
