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
  additionalTopicsToAvoid: Topic[] = [],
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
  let prompt = "";
  if (channelId) {
    const { getChannelPrompts } = await import("./database.js");
    const prompts = await getChannelPrompts(channelId, "topic");
    if (prompts.length > 0) {
      prompt = prompts[0].prompt_text;
      Logger.info(`📋 Usando prompt personalizado del canal`);
    }
  }

  // 🚫 EVITAR REPETICIÓN: Combinar topics de BD + topics ya generados en esta ejecución
  const recentTopics = await getRecentTopics(30);
  const allTopicsToAvoid = [...recentTopics, ...additionalTopicsToAvoid];

  if (allTopicsToAvoid.length > 0) {
    const topicsList = allTopicsToAvoid
      .map((t, i) => `${i + 1}. "${t.title}"`)
      .join("\n");

    const avoidRepetitionNote = `

🚫 AVOID REPETITION - Recently used topics (DO NOT generate similar topics):
${topicsList}

⚠️ Your new topic MUST be COMPLETELY DIFFERENT from all the topics listed above.
Generate a fresh, unique topic that hasn't been covered yet.
`;

    prompt = prompt + avoidRepetitionNote;
    Logger.info(
      `🔍 Evitando repetición de ${allTopicsToAvoid.length} topics (${recentTopics.length} de BD + ${additionalTopicsToAvoid.length} de esta ejecución)`,
    );
  }

  try {
    Logger.info("Generando topic con IA...");

    const provider = await getLLMClient();
    const client = provider.client as any;
    const model = getModel(provider);

    const temperature = provider.name === "ollama" ? 0.7 : 0.9;

    const requestOptions: any = {
      model: model,
      messages: [
        {
          role: "system",
          content:
            "You are a creative researcher specializing in fascinating micro-documentary topics. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: temperature,
      response_format: { type: "json_object" },
      frequency_penalty: 0.7,
      presence_penalty: 0.5,
    };

    const response = await client.chat.completions.create(requestOptions);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("La IA no devolvió contenido");
    }

    // 🔧 PARSING ROBUSTO: Puede devolver texto extra antes/después del JSON
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
