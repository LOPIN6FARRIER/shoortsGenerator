import OpenAI from "openai";
import { CONFIG } from "./config.js";
import { Logger } from "./utils.js";
import { getLatestTopic } from "./database.js";

export interface Topic {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  tokensUsed?: number;
}

const openai = new OpenAI({
  apiKey: CONFIG.openai.apiKey,
});

function titleToKebabCase(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function generateTopic(): Promise<Topic> {
  // 🔍 MODO DEBUGGING: Intentar reutilizar último topic de BD
  if (process.env.DEBBUGING === "true") {
    Logger.info("🔍 DEBUGGING mode: Buscando último topic en BD...");
    let topic = await getLatestTopic();
    if (topic) {
      Logger.warn("♻️  Reutilizando topic existente de BD: " + topic.title);
      return topic;
    }
    Logger.info("📝 No hay topics en BD, generando uno nuevo...");
    // Si no hay topic en BD, continuar con generación normal
  }

  if (!CONFIG.openai.apiKey) {
    throw new Error(
      "OPENAI_API_KEY no configurada en las variables de entorno",
    );
  }

  const prompt = `You are a creative researcher.
Generate ONE original topic for a short micro-documentary.

Rules:
- It must be something most people never think about.
- It must be concrete (object, process, habit, small detail).
- Avoid famous people.
- Avoid generic trivia.
- Avoid clickbait.
- Calm, curious, thoughtful tone.

Return ONLY valid JSON with:
{
  "id": string,
  "title": string,
  "description": string
}`;

  try {
    Logger.info("Generando topic con IA...");

    const response = await openai.chat.completions.create({
      model: CONFIG.openai.model,
      messages: [
        {
          role: "system",
          content:
            "You are a creative researcher specializing in fascinating micro-documentary topics.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("La IA no devolvió contenido");
    }

    const parsed = JSON.parse(content);

    if (!parsed.title || !parsed.description) {
      throw new Error("La respuesta de la IA no contiene title o description");
    }

    // Capturar tokens consumidos
    const tokensUsed = response.usage?.total_tokens || 0;

    const topic: Topic = {
      id: titleToKebabCase(parsed.title),
      title: parsed.title,
      description: parsed.description,
      timestamp: new Date().toISOString(),
      tokensUsed,
    };

    Logger.success(`Topic generado: ${topic.title} (${tokensUsed} tokens)`);
    return topic;
  } catch (error) {
    Logger.error("Error generando topic con IA:", error);
    throw new Error(
      `Failed to generate topic: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
