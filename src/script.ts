import OpenAI from "openai";
import { Topic } from "./topic.js";
import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
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
  // Estructura de 3 actos + Hook ultra-agresivo + Call-to-curiosity implícito
  const prompt = `Eres un guionista experto en YouTube Shorts virales. Crea un guion de micro-documental sobre:

📌 TEMA: ${topic.title}
📝 DESCRIPCIÓN: ${topic.description}
🌐 IDIOMA: ${languageName}

⏱️ DURACIÓN OBJETIVO: ${channelConfig.narrative.targetDuration} segundos (130-150 palabras)

🎯 ESTRUCTURA OBLIGATORIA (3 ACTOS):

[HOOK - ${channelConfig.narrative.hookDuration}s / MÁXIMO 12 PALABRAS]
EMPIEZA CON IMPACTO INMEDIATO:
${channelConfig.narrative.hookStyle.includes("mystery") ? "• MISTERIO: Afirmación que rompe expectativas sin preguntar" : ""}
${channelConfig.narrative.hookStyle.includes("invisible") ? "• INVISIBILIDAD: Revela algo oculto en lo cotidiano" : ""}
${channelConfig.narrative.hookStyle.includes("injustice") ? "• INJUSTICIA: Contraste impactante del día a día" : ""}

Ejemplos de hooks ultra-agresivos:
- "Este trabajo invisible mantiene tu ciudad funcionando."
- "Nadie ve quién hace esto cada noche."
- "Pagas por esto mientras otros lo tienen gratis."

[ACTO 1 - ${channelConfig.narrative.act1Duration}s]
• Presenta el contexto cotidiano con detalles concretos
• Crea familiaridad inmediata
• MÁXIMO 5-7 PALABRAS POR FRASE
• Usa números, fechas, nombres específicos

[ACTO 2 - ${channelConfig.narrative.act2Duration}s]
• EL GIRO: Revelación inesperada
• Datos que cambian la perspectiva por completo
• El "aha moment" viral
• MÁXIMO 5-7 PALABRAS POR FRASE
• Ritmo rápido sin pausas

[ACTO 3 - ${channelConfig.narrative.act3Duration}s]
• Resignifica todo con la nueva información
• Cierre poderoso que genera reflexión
• CALL-TO-CURIOSITY: Termina con reflexión implícita SIN SIGNOS DE PREGUNTA
• Ejemplo: "Ahora lo sabes" / "Míralo diferente desde hoy" / "Esto cambia todo"

🚫 PROHIBIDO:
- "Sabías que...", "Hoy te cuento...", "En este video..."
- Preguntas con signos de interrogación (? ¿)
- Pausas largas o transiciones obvias
- Listas numeradas
- Frases de más de 7 palabras

✅ OBLIGATORIO:
- Tono: ${channelConfig.narrative.emotionalTone}
- Ritmo: ${channelConfig.narrative.pacing === "fast" ? "Ultra-rápido, enérgico, directo" : "Dinámico sin pausas"}
- Datos concretos verificables
- Narrativa fluida como historia continua
- Cierre diseñado para comentarios (sin pregunta explícita)

Devuelve SOLO el texto narrativo en ${languageName}, sin formato adicional.`;

  try {
    const completion = await client.chat.completions.create({
      model: CONFIG.openai.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8, // Mayor creatividad para hooks virales
      max_tokens: 450,
    });

    // 🛡️ VALIDACIÓN ROBUSTA: Verificar respuesta antes de usar
    if (!completion.choices || completion.choices.length === 0) {
      throw new Error("OpenAI no devolvió opciones de completado");
    }

    const narrative = completion.choices[0]?.message?.content?.trim();

    if (!narrative) {
      throw new Error("OpenAI devolvió contenido vacío o null");
    }

    // 📊 EXTRACCIÓN INTERNA DE ESTRUCTURA (sin cambiar interface Script)
    // Hook: primeras 1-2 frases (≤12 palabras)
    // Body: actos 1, 2, 3 (núcleo del contenido)
    // CallToCuriosity: última frase (cierre viral)
    // NOTE: Actualmente no se almacenan por separado, pero el prompt ya estructura
    // 🔮 PUNTO DE EXTENSIÓN: A/B testing de hooks diferentes
    // 🔮 PUNTO DE EXTENSIÓN: Generar variantes de CTA para optimización

    const wordCount = narrative.split(/\s+/).length;
    // ✅ CORRECCIÓN: Cálculo simplificado de duración
    // palabras / palabrasPorSegundo = segundos totales
    const estimatedDuration = Math.ceil(
      wordCount / channelConfig.subtitles.wordsPerSecond,
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

    // 🛡️ VALIDACIÓN: Verificar respuesta de título o usar fallback
    if (!titleCompletion.choices || titleCompletion.choices.length === 0) {
      Logger.warn("OpenAI no devolvió título, usando fallback del topic");
    }

    const title =
      titleCompletion.choices[0]?.message?.content?.trim() ||
      `${topic.title}`.slice(0, 50);

    // 🔮 PUNTO DE EXTENSIÓN: Generación de subtítulos alternativos
    // Podría agregarse aquí lógica para A/B testing de diferentes estilos

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
