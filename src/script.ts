import OpenAI from "openai";
import { Topic } from "./topic.js";
import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
import { get } from "http";
import { getLattestScript, getLatestScriptByLanguage } from "./database.js";
import { getChannelConfig } from "./channels.config.js";

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
  const channelConfig = getChannelConfig(language);
  const languageName = language === "es" ? "español" : "inglés";

  // 🔥 PROMPT OPTIMIZADO PARA CONTENIDO VIRAL
  // Estructura de 3 actos + Hook agresivo + Call-to-curiosity
  const prompt = `Eres un guionista experto en YouTube Shorts virales. Crea un guion de micro-documental sobre:

📌 TEMA: ${topic.title}
📝 DESCRIPCIÓN: ${topic.description}
🌐 IDIOMA: ${languageName}

⏱️ DURACIÓN OBJETIVO: ${channelConfig.narrative.targetDuration} segundos (130-150 palabras)

🎯 ESTRUCTURA OBLIGATORIA (3 ACTOS):

[HOOK - ${channelConfig.narrative.hookDuration}s / 8-12 palabras]
Empieza con uno de estos ganchos:
${channelConfig.narrative.hookStyle.includes("mystery") ? "• MISTERIO: Una pregunta intrigante o afirmación que rompe expectativas" : ""}
${channelConfig.narrative.hookStyle.includes("invisible") ? "• INVISIBILIDAD: Algo cotidiano que nadie nota pero está ahí siempre" : ""}
${channelConfig.narrative.hookStyle.includes("injustice") ? "• INJUSTICIA: Una desigualdad o paradoja del día a día" : ""}

Ejemplos de hooks poderosos:
- "Este trabajo invisible mantiene funcionando tu ciudad."
- "Nadie sabe quién hace esto, pero todos lo usan."
- "Mientras tú pagas por esto, ellos lo hacen gratis."

[ACTO 1 - ${channelConfig.narrative.act1Duration}s]
• Presenta el contexto cotidiano
• Crea familiaridad con algo que todos conocen
• Usa detalles específicos (fechas, lugares, nombres)
• Frases cortas y directas (5-8 palabras por frase)

[ACTO 2 - ${channelConfig.narrative.act2Duration}s]
• EL GIRO: La revelación inesperada
• Datos sorprendentes que cambian la perspectiva
• El "aha moment" que engancha
• Mantén el ritmo rápido

[ACTO 3 - ${channelConfig.narrative.act3Duration}s]
• Resignifica el Acto 1 con la nueva información
• Cierre que genera reflexión
• CALL-TO-CURIOSITY: Termina con pregunta/reflexión que invite a comentar

🚫 PROHIBIDO:
- "Sabías que...", "Hoy te cuento...", "En este video..."
- Preguntas retóricas genéricas en el medio
- Pausas largas o texto descriptivo
- Listas numeradas o enumeraciones
- Transiciones obvias ("Pero eso no es todo...")

✅ OBLIGATORIO:
- Tono: ${channelConfig.narrative.emotionalTone}
- Ritmo: ${channelConfig.narrative.pacing === "fast" ? "Rápido, enérgico, sin pausas" : "Moderado pero dinámico"}
- Datos concretos y verificables
- Narrativa continua como si fuera una historia
- Línea final diseñada para generar comentarios

Devuelve SOLO el texto narrativo en ${languageName}, sin formato adicional.`;

  try {
    const completion = await client.chat.completions.create({
      model: CONFIG.openai.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8, // Mayor creatividad para hooks virales
      max_tokens: 450,
    });

    const narrative = completion.choices[0]?.message?.content?.trim();

    if (!narrative) {
      throw new Error("OpenAI no devolvió contenido");
    }

    const wordCount = narrative.split(/\s+/).length;
    const estimatedDuration = Math.ceil(
      (wordCount / (channelConfig.subtitles.wordsPerSecond * 60)) * 60,
    );

    // 🔥 TÍTULO OPTIMIZADO PARA CTR (Click-Through Rate)
    const titlePrompt = `Genera un título VIRAL para YouTube Shorts sobre este contenido en ${languageName}:

${narrative.slice(0, 200)}...

REQUISITOS ESTRICTOS:
- Máximo 50 caracteres (para que se vea completo en móvil)
- Usa palabras que generen curiosidad: "secreto", "nadie", "invisible", "oculto"
- NO uses: "¿Sabías que...?", "La verdad sobre...", "Descubre..."
- Formato directo y contundente
- Capitalización estratégica si aplica

Ejemplos buenos:
- "El trabajo más invisible de la ciudad"
- "Nadie sabe quién hace esto"
- "El secreto detrás de las líneas amarillas"

Devuelve SOLO el título, sin comillas ni formato adicional.`;

    const titleCompletion = await client.chat.completions.create({
      model: CONFIG.openai.model,
      messages: [{ role: "user", content: titlePrompt }],
      temperature: 0.9, // Alta creatividad para títulos virales
      max_tokens: 40,
    });

    const title =
      titleCompletion.choices[0]?.message?.content?.trim() ||
      `${topic.title}`.slice(0, 50);

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

  // 🔍 MODO DEBUGGING: Intentar reutilizar últimos scripts de BD por idioma
  if (process.env.DEBBUGING === "true") {
    Logger.info("🔍 DEBUGGING mode: Buscando últimos scripts en BD...");

    const [latestScriptES, latestScriptEN] = await Promise.all([
      getLatestScriptByLanguage("es"),
      getLatestScriptByLanguage("en"),
    ]);

    // Si ambos existen, reutilizarlos
    if (latestScriptES && latestScriptEN) {
      Logger.warn(
        `♻️  Reutilizando scripts existentes: ES="${latestScriptES.title}", EN="${latestScriptEN.title}"`,
      );
      latestScriptES.topic = topic;
      latestScriptEN.topic = topic;
      return {
        es: latestScriptES as Script,
        en: latestScriptEN as Script,
      };
    }

    // Si solo existe uno, generarlo todo nuevo para consistencia
    if (latestScriptES || latestScriptEN) {
      Logger.warn(
        "⚠️  Solo existe script en un idioma, generando ambos nuevos para consistencia...",
      );
    } else {
      Logger.info("📝 No hay scripts en BD, generando nuevos con IA...");
    }
    // Continuar con generación normal
  }

  const [es, en] = await Promise.all([
    generateScript(topic, "es"),
    generateScript(topic, "en"),
  ]);

  return { es, en };
}
