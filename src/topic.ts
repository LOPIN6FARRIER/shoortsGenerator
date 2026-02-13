import { CONFIG } from "./config.js";
import { Logger } from "./utils.js";
import { getLatestTopic, getRecentTopics } from "./database.js";
import { getLLMClient, getModel } from "./llm.js";

export interface Topic {
  id: string;
  title: string;
  description: string;
  imageKeywords: string; // Keywords para búsqueda de imágenes en Unsplash/Pexels
  videoKeywords: string; // Keywords para búsqueda de videos en Pexels
  timestamp: string;
  tokensUsed?: number;
}

function titleToKebabCase(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function generateTopic(
  language: "es" | "en" = "es",
  channelId?: string,
): Promise<Topic> {
  // 🔍 MODO DEBUGGING: Intentar reutilizar último topic de BD
  if (process.env.DEBUGGING === "true") {
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

  // Cargar prompt desde BD si se proporciona channelId
  let prompt = `You are a creative researcher.
Generate ONE original topic for a short micro-documentary.

Rules:
- It must be something most people never think about.
- It must be concrete (object, process, habit, small detail).
- Avoid famous people.
- Avoid generic trivia.
- Avoid clickbait.
- Calm, curious, thoughtful tone.

CRITICAL: Return ONLY valid JSON, nothing else. No explanations, no markdown, no extra text.

JSON format (create unique content, do NOT copy examples):
{
  "id": "your-topic-id-here",
  "title": "Your Unique Topic Title",
  "description": "Your detailed description of the topic",
  "imageKeywords": "2-3 simple search keywords in English (format examples: 'library books' or 'coffee shop' or 'parking lot' - but use keywords relevant to YOUR topic)",
  "videoKeywords": "2-3 action keywords in English for video search (format examples: 'workers painting' or 'people walking' - but use keywords relevant to YOUR topic)"
}

⚠️ IMPORTANT: The example keywords shown are FORMAT GUIDES only. Generate NEW keywords specific to your generated topic!`;

  if (channelId) {
    const { getChannelPrompts } = await import("./database.js");
    const prompts = await getChannelPrompts(channelId, "topic");
    if (prompts.length > 0) {
      prompt = prompts[0].prompt_text;
      Logger.info(`📋 Usando prompt personalizado del canal`);
    }
  }

  // 🚫 EVITAR REPETICIÓN: Obtener topics recientes para no duplicar
  const recentTopics = await getRecentTopics(20);
  if (recentTopics.length > 0) {
    const topicsList = recentTopics
      .map((t, i) => `${i + 1}. "${t.title}"`)
      .join("\n");
    
    const avoidRepetitionNote = `

🚫 AVOID REPETITION - Recently used topics (DO NOT generate similar topics):
${topicsList}

⚠️ Your new topic MUST be COMPLETELY DIFFERENT from all the topics listed above.
Generate a fresh, unique topic that hasn't been covered yet.
`;
    
    prompt = prompt + avoidRepetitionNote;
    Logger.info(`🔍 Evitando repetición de ${recentTopics.length} topics recientes`);
  }

  try {
    Logger.info("Generando topic con IA...");

    const provider = await getLLMClient();
    const client = provider.client;
    const model = getModel(provider);

    // 🎛️ Ajustar temperatura según provider
    // Ollama necesita temperatura más baja para seguir instrucciones JSON
    const temperature = provider.name === "ollama" ? 0.7 : 0.9;

    const response = await client.chat.completions.create({
      model: model,
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
      temperature: temperature,
      response_format: { type: "json_object" },
      frequency_penalty: 0.7, // Penalizar palabras repetidas (aumentado para evitar topics similares)
      presence_penalty: 0.5, // Penalizar temas repetidos (aumentado para mayor originalidad)
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("La IA no devolvió contenido");
    }

    // 🔧 PARSING ROBUSTO: Ollama puede devolver texto extra antes/después del JSON
    let parsed;
    try {
      // Intentar parsear directo primero
      parsed = JSON.parse(content);
    } catch {
      // Si falla, buscar JSON dentro del texto
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        Logger.error("❌ Respuesta no contiene JSON válido:");
        Logger.error(content.substring(0, 500));
        throw new Error("Respuesta no contiene JSON válido");
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    if (!parsed.title || !parsed.description) {
      throw new Error("La respuesta de la IA no contiene title o description");
    }

    // Capturar tokens consumidos
    const tokensUsed = response.usage?.total_tokens || 0;

    const topic: Topic = {
      id: titleToKebabCase(parsed.title),
      title: parsed.title,
      description: parsed.description,
      imageKeywords: parsed.imageKeywords || parsed.title, // Fallback al título si no hay keywords
      videoKeywords:
        parsed.videoKeywords || parsed.imageKeywords || parsed.title, // Fallback a imageKeywords o título
      timestamp: new Date().toISOString(),
      tokensUsed,
    };

    // 🔍 Verificar si el topic es muy similar a uno existente
    const { checkDuplicateTopic } = await import("./database.js");
    const isDuplicate = await checkDuplicateTopic(topic.title);
    if (isDuplicate) {
      Logger.warn(
        `⚠️ ADVERTENCIA: Topic similar ya existe en BD: "${topic.title}"`,
      );
      Logger.warn(
        "   Considera ajustar los prompts o aumentar frequency_penalty",
      );
    }

    Logger.success(`Topic generado: ${topic.title} (${tokensUsed} tokens)`);
    return topic;
  } catch (error) {
    Logger.error("Error generando topic con IA:", error);
    throw new Error(
      `Failed to generate topic: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
