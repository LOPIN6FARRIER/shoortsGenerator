import { Topic } from "./topic.js";
import { Logger } from "./utils.js";
import { CONFIG } from "./config.js";
import { getLattestScript, getLatestScriptByLanguage } from "./database.js";
import { getChannelConfig } from "./channels.config.js";
import { getLLMClient, getModel } from "./llm.js";

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

export async function generateScript(
  topic: Topic,
  language: "es" | "en",
): Promise<Script> {
  Logger.info(`Generando guion con IA para: ${topic.id} (${language})`);

  const provider = await getLLMClient();
  const client = provider.client;
  const model = getModel(provider);
  const channelConfig = getChannelConfig(language);
  const languageName =
    language === "es" ? "español (Spanish)" : "inglés (English)";
  const languageInstruction =
    language === "es"
      ? "IMPORTANTE: Todo el contenido debe estar en ESPAÑOL. No uses palabras en inglés."
      : "IMPORTANT: All content must be in ENGLISH. Do not use Spanish words.";

  // 🔥 PROMPT OPTIMIZADO PARA CONTENIDO VIRAL
  // Estructura de 3 actos + Hook ultra-agresivo + Call-to-curiosity implícito
  const prompt = `You are an expert YouTube Shorts scriptwriter. Create a micro-documentary script about:

📌 TOPIC: ${topic.title}
📝 DESCRIPTION: ${topic.description}
🌐 LANGUAGE: ${languageName}

${languageInstruction}

⏱️ TARGET DURATION: ${channelConfig.narrative.targetDuration} seconds (130-150 words)

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
      model: model,
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
    const titlePrompt =
      language === "es"
        ? `Genera un título VIRAL para YouTube Shorts sobre este contenido EN ESPAÑOL:

${narrative.slice(0, 200)}...

IMPORTANTE: El título debe estar 100% EN ESPAÑOL. No uses palabras en inglés.

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

Devuelve SOLO el título en español, sin comillas ni formato adicional.`
        : `Generate a VIRAL title for YouTube Shorts about this content IN ENGLISH:

${narrative.slice(0, 200)}...

IMPORTANT: The title must be 100% IN ENGLISH. Do not use Spanish words.

STRICT REQUIREMENTS:
- Maximum 50 characters (to display fully on mobile)
- Use curiosity-triggering words: "secret", "nobody", "invisible", "hidden"
- DON'T use: "Did you know...?", "The truth about...", "Discover..."
- Direct and impactful format
- Strategic capitalization if applicable

Good examples:
- "The city's most invisible job"
- "Nobody knows who does this"
- "The secret behind yellow lines"

Return ONLY the title in English, without quotes or additional formatting.`;

    const titleCompletion = await client.chat.completions.create({
      model: model,
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

    // � DESCRIPCIÓN OPTIMIZADA PARA SEO Y ENGAGEMENT
    const descriptionPrompt =
      language === "es"
        ? `Genera una descripción para YouTube sobre este contenido EN ESPAÑOL:

${narrative.slice(0, 200)}...

IMPORTANTE: La descripción debe estar 100% EN ESPAÑOL. No uses palabras en inglés.

REQUISITOS:
- 2-3 oraciones cortas
- Incluye CTA sutil: "¿Qué opinas?" o "Comenta tu experiencia"
- Lenguaje cercano y conversacional
- Máximo 150 caracteres

Devuelve SOLO la descripción en español, sin comillas ni formato adicional.`
        : `Generate a YouTube description about this content IN ENGLISH:

${narrative.slice(0, 200)}...

IMPORTANT: The description must be 100% IN ENGLISH. Do not use Spanish words.

REQUIREMENTS:
- 2-3 short sentences
- Include subtle CTA: "What do you think?" or "Share your experience"
- Friendly and conversational language
- Maximum 150 characters

Return ONLY the description in English, without quotes or additional formatting.`;

    const descriptionCompletion = await client.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: descriptionPrompt }],
      temperature: 0.8,
      max_tokens: 80,
    });

    const description =
      descriptionCompletion.choices[0]?.message?.content?.trim() ||
      topic.description;

    // 🔮 PUNTO DE EXTENSIÓN: Generación de subtítulos alternativos
    // Podría agregarse aquí lógica para A/B testing de diferentes estilos

    // Capturar tokens consumidos (narrativa + título + descripción)
    const narrativeTokens = completion.usage?.total_tokens || 0;
    const titleTokens = titleCompletion.usage?.total_tokens || 0;
    const descriptionTokens = descriptionCompletion.usage?.total_tokens || 0;
    const tokensUsed = narrativeTokens + titleTokens + descriptionTokens;

    const script: Script = {
      language,
      topic,
      title,
      narrative,
      description,
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

/**
 * Genera script usando un prompt personalizado desde BD
 */
export async function generateScriptWithPrompt(
  topic: Topic,
  language: "es" | "en",
  customPrompt: string,
): Promise<Script> {
  Logger.info(`Generando script con prompt personalizado (${language})`);

  const provider = await getLLMClient();
  const client = provider.client;
  const model = getModel(provider);

  try {
    // Reemplazar variables en el prompt (todas las ocurrencias)
    Logger.info(`\n📋 GENERANDO SCRIPT PARA TOPIC:`);
    Logger.info(`   Title: "${topic.title}"`);
    Logger.info(`   Description: "${topic.description.substring(0, 150)}..."`);
    
    const prompt = customPrompt
      .replace(/\$\{topic\.title\}/g, topic.title)
      .replace(/\$\{topic\.description\}/g, topic.description);

    Logger.info(`\n📝 PROMPT DESPUÉS DE REEMPLAZAR VARIABLES:`);
    Logger.info(prompt.substring(0, 500) + "...\n");

    // Agregar instrucciones adicionales para JSON limpio (especialmente para Ollama)
    const enhancedPrompt = `${prompt}

─────────────────────────────────────────
⚠️ CRITICAL JSON FORMAT INSTRUCTIONS ⚠️
─────────────────────────────────────────

1. Return ONLY valid JSON - nothing before, nothing after
2. NO line breaks inside string values (use spaces or \\n escape sequence)
3. All strings must be on a SINGLE LINE
4. Use double quotes for strings, NO single quotes
5. No trailing commas in objects or arrays
6. All field names must match exactly as specified
7. Do NOT wrap in markdown code blocks like \`\`\`json
8. Do NOT add explanations or comments

VALID EXAMPLE:
{"title": "Short title", "narrative": "This is a long text that stays on one line even if it's very long", "description": "Description here"}

INVALID EXAMPLE (DO NOT DO THIS):
{
  "narrative": "This text breaks
  into multiple lines"
}

Return the JSON NOW:`;

    const completion = await client.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: enhancedPrompt }],
      temperature: 0.7, // Reducir temperatura para mayor consistencia
      max_tokens: 7000,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      throw new Error("No se recibió respuesta de la IA");
    }

    // Parsear JSON - Maneja bloques markdown y JSON plano
    let jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = response.match(/```\s*([\s\S]*?)\s*```/);
    }
    if (!jsonMatch) {
      jsonMatch = response.match(/\{[\s\S]*\}/);
    }

    if (!jsonMatch) {
      Logger.error("❌ Respuesta no contiene JSON:");
      Logger.error(response.substring(0, 500));
      throw new Error("Respuesta no contiene JSON válido");
    }

    // Limpiar caracteres de control del JSON
    let jsonString = jsonMatch[1] || jsonMatch[0];

    // 🔧 LIMPIEZA AGRESIVA: Normalizar saltos de línea dentro de strings
    jsonString = jsonString
      .trim()
      // Remover caracteres de control problemáticos
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Normalizar saltos de línea: convertir \r\n a \n
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError: any) {
      // Segundo intento: escapar saltos de línea dentro de strings
      Logger.warn(
        "⚠️ Primer intento falló, limpiando saltos de línea en strings...",
      );
      try {
        // Estrategia: reemplazar saltos de línea dentro de valores de string por espacios
        const cleanedJson = jsonString.replace(
          /"([^"\\]*(?:\\.[^"\\]*)*)"/g,
          (match, content) => {
            // Dentro de cada string, reemplazar saltos de línea por espacios
            const cleaned = content
              .replace(/\n/g, " ") // \n → espacio
              .replace(/\s+/g, " ") // múltiples espacios → uno
              .trim();
            return `"${cleaned}"`;
          },
        );
        parsed = JSON.parse(cleanedJson);
        Logger.success("✅ JSON parseado exitosamente después de limpieza");
      } catch (secondError: any) {
        Logger.error("❌ Error parseando JSON después de limpieza:");
        Logger.error("JSON problemático (primeros 1000 chars):");
        Logger.error(jsonString.substring(0, 1000));
        Logger.error(`\nError original: ${parseError.message}`);
        Logger.error(`Error después de limpieza: ${secondError.message}`);
        throw new Error(`JSON inválido: ${parseError.message}`);
      }
    }
    const narrative = parsed.narrative || parsed.script || "";
    const wordCount = narrative.split(/\s+/).length;
    const estimatedDuration =
      parsed.estimated_duration || Math.round(wordCount / 2.5);

    const script: Script = {
      language,
      topic,
      title: parsed.title || topic.title,
      narrative,
      description: parsed.description || topic.description,
      tags: parsed.tags || ["shorts"],
      estimatedDuration,
      tokensUsed: completion.usage?.total_tokens || 0,
    };

    Logger.success(
      `Script generado: "${script.title}" - ${wordCount} palabras, ~${estimatedDuration}s`,
    );
    Logger.info(`📝 Narrative preview: "${narrative.substring(0, 150)}..."`);
    return script;
  } catch (error: any) {
    Logger.error(
      "Error generando script con prompt personalizado:",
      error.message,
    );
    throw error;
  }
}

export async function generateBilingualScripts(
  topic: Topic,
): Promise<{ es: Script; en: Script }> {
  Logger.info("Generando scripts bilingües con IA...");

  // 🔍 MODO DEBUGGING: Intentar reutilizar últimos scripts de BD por idioma
  if (process.env.DEBUGGING === "true") {
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
