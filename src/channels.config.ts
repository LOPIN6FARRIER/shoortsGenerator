/**
 * CONFIGURACIÓN DE IDENTIDAD Y OPTIMIZACIÓN POR CANAL
 *
 * Este archivo define la identidad visual, narrativa y técnica de cada canal.
 * Optimizado para máxima retención en YouTube Shorts.
 *
 * @author Sistema refactorizado para contenido viral
 * @date 2026-02-05
 */

export interface ChannelIdentity {
  // IDENTIDAD VISUAL
  visual: {
    primaryColor: string; // Color principal HEX (subtítulos, acentos)
    secondaryColor: string; // Color secundario
    fontFamily: string; // Tipografía consistente
    fontSize: number; // Tamaño base de fuente
    subtitleStyle: {
      fontWeight: string; // Bold, normal, etc.
      strokeColor: string; // Color del borde
      strokeWidth: number; // Grosor del borde
      shadowOpacity: number; // Sombra para legibilidad
      backgroundColor: string; // Fondo semi-transparente
      backgroundOpacity: number; // Opacidad del fondo
    };
    gradient: {
      color1: string; // Color 1 del gradiente de fallback
      color2: string; // Color 2 del gradiente
    };
  };

  // NARRATIVA Y CONTENIDO
  narrative: {
    targetDuration: number; // Duración objetivo en segundos (45-58)
    hookDuration: number; // Duración del hook inicial (1-2s)
    hookStyle: string[]; // Estilos de hook preferidos
    act1Duration: number; // Duración del acto 1 (~15-20s)
    act2Duration: number; // Duración del acto 2 (~20-25s)
    act3Duration: number; // Duración del acto 3 (~10-15s)
    pacing: "fast" | "medium"; // Ritmo general
    emotionalTone: string; // Tono emocional preferido
    callToAction: string; // Tipo de CTA preferido
  };

  // AUDIO
  audio: {
    voice: string; // Voz de Edge TTS
    voiceSpeed: number; // Velocidad 1.0 = normal, 1.1 = 10% más rápido
    voicePitch: string; // Pitch: +0Hz, +5Hz, etc.
    backgroundMusic: {
      enabled: boolean; // ¿Usar música de fondo?
      volume: number; // Volumen de música (0.0 - 1.0)
      fadeIn: number; // Fade in en segundos
      fadeOut: number; // Fade out en segundos
    };
  };

  // VIDEO
  video: {
    transitionDuration: number; // Duración de transiciones (segundos)
    imageDisplayTime: number; // Tiempo por imagen (2-3s)
    kenBurns: {
      enabled: boolean; // ¿Usar efecto Ken Burns?
      zoomIntensity: number; // Intensidad del zoom (1.0 - 1.2)
      direction: "in" | "out" | "alternate"; // Dirección del zoom
    };
    pan: {
      enabled: boolean; // ¿Usar pan vertical?
      speed: number; // Velocidad del pan (píxeles/segundo)
      direction: "up" | "down" | "alternate"; // Dirección
    };
  };

  // SUBTÍTULOS
  subtitles: {
    maxLines: number; // Máximo líneas simultáneas (2 recomendado)
    maxCharsPerLine: number; // Máximo caracteres por línea (20-25)
    wordsPerSecond: number; // Palabras por segundo objetivo (2.5-3)
    emphasizeKeywords: boolean; // ¿Enfatizar palabras clave?
    keywordIndicators: string[]; // Palabras que suelen ser clave
    position: "top" | "center" | "bottom"; // Posición en pantalla
    animationStyle: "none" | "fade" | "slide"; // Estilo de animación
  };
}

/**
 * CONFIGURACIÓN CANAL ESPAÑOL
 * Enfoque: Contenido educativo con tono cercano y sorpresa
 */
export const SPANISH_CHANNEL: ChannelIdentity = {
  visual: {
    primaryColor: "#FFD700", // Dorado vibrante
    secondaryColor: "#FF6B35", // Naranja energético
    fontFamily: "Montserrat", // Sans-serif moderna y legible
    fontSize: 42,                 // Optimizado para visibilidad sin cortes
    subtitleStyle: {
      fontWeight: "bold",
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOpacity: 0.8,
      backgroundColor: "#000000",
      backgroundOpacity: 0.5,
    },
    gradient: {
      color1: "#667eea", // Púrpura
      color2: "#764ba2", // Morado oscuro
    },
  },

  narrative: {
    targetDuration: 52, // 52 segundos óptimo
    hookDuration: 2, // Hook de 2 segundos
    hookStyle: [
      "mystery", // Misterio
      "injustice", // Injusticia cotidiana
      "invisible", // Lo invisible del día a día
    ],
    act1Duration: 18, // Contexto cotidiano
    act2Duration: 22, // El giro inesperado
    act3Duration: 12, // Resignificación
    pacing: "fast",
    emotionalTone: "curious-surprised",
    callToAction: "comment-question", // Pregunta para comentarios
  },

  audio: {
    voice: "es-MX-DaliaNeural",
    voiceSpeed: 1.08, // 8% más rápido para energía
    voicePitch: "+2Hz", // Ligeramente más agudo
    backgroundMusic: {
      enabled: false, // Deshabilitado por ahora (futuro)
      volume: 0.15, // 15% volumen
      fadeIn: 2,
      fadeOut: 3,
    },
  },

  video: {
    transitionDuration: 0.5, // Transiciones rápidas
    imageDisplayTime: 2.5, // 2.5s por imagen
    kenBurns: {
      enabled: true,
      zoomIntensity: 1.15, // Zoom del 15%
      direction: "alternate", // Alterna in/out
    },
    pan: {
      enabled: true,
      speed: 50, // 50 píxeles/segundo
      direction: "alternate", // Alterna up/down
    },
  },

  subtitles: {
    maxLines: 2,
    maxCharsPerLine: 18,          // Reducido para evitar cortes
    wordsPerSecond: 2.8, // Ritmo rápido
    emphasizeKeywords: true,
    keywordIndicators: [
      "secreto",
      "invisible",
      "nunca",
      "nadie",
      "siempre",
      "realmente",
      "verdad",
      "oculto",
      "descubre",
      "increíble",
    ],
    position: "center",
    animationStyle: "fade",
  },
};

/**
 * CONFIGURACIÓN CANAL INGLÉS
 * Enfoque: Contenido educativo con tono profesional y intriga
 */
export const ENGLISH_CHANNEL: ChannelIdentity = {
  visual: {
    primaryColor: "#00D9FF", // Cyan brillante
    secondaryColor: "#7B2FFF", // Púrpura vibrante
    fontFamily: "Montserrat",
    fontSize: 42,                 // Optimizado para visibilidad sin cortes
    subtitleStyle: {
      fontWeight: "bold",
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOpacity: 0.8,
      backgroundColor: "#000000",
      backgroundOpacity: 0.5,
    },
    gradient: {
      color1: "#f093fb", // Rosa
      color2: "#f5576c", // Rojo coral
    },
  },

  narrative: {
    targetDuration: 50, // 50 segundos óptimo
    hookDuration: 1.5, // Hook de 1.5 segundos
    hookStyle: ["mystery", "invisible", "surprise"],
    act1Duration: 17,
    act2Duration: 21,
    act3Duration: 12,
    pacing: "fast",
    emotionalTone: "intrigued-informed",
    callToAction: "comment-opinion",
  },

  audio: {
    voice: "en-US-JennyNeural",
    voiceSpeed: 1.1, // 10% más rápido
    voicePitch: "+0Hz", // Natural
    backgroundMusic: {
      enabled: false,
      volume: 0.12,
      fadeIn: 2,
      fadeOut: 3,
    },
  },

  video: {
    transitionDuration: 0.5,
    imageDisplayTime: 2.5,
    kenBurns: {
      enabled: true,
      zoomIntensity: 1.15,
      direction: "alternate",
    },
    pan: {
      enabled: true,
      speed: 50,
      direction: "alternate",
    },
  },

  subtitles: {
    maxLines: 2,
    maxCharsPerLine: 16,          // Reducido para evitar cortes
    wordsPerSecond: 3.0, // Ritmo más rápido en inglés
    emphasizeKeywords: true,
    keywordIndicators: [
      "secret",
      "invisible",
      "never",
      "nobody",
      "always",
      "actually",
      "truth",
      "hidden",
      "discover",
      "incredible",
    ],
    position: "center",
    animationStyle: "fade",
  },
};

/**
 * Obtener configuración por idioma
 */
export function getChannelConfig(language: "es" | "en"): ChannelIdentity {
  return language === "es" ? SPANISH_CHANNEL : ENGLISH_CHANNEL;
}

/**
 * GUÍA DE OPTIMIZACIÓN PARA CONTENIDO VIRAL
 *
 * 🎯 HOOKS EFECTIVOS (1-2 segundos):
 * - Misterio: "¿Sabías que existe un trabajo que nadie conoce?"
 * - Invisibilidad: "Esto pasa todos los días y nunca lo notas."
 * - Sorpresa: "Lo que estás a punto de ver cambiará tu forma de ver..."
 * - Injusticia: "Mientras tú pagas por esto, ellos lo hacen gratis."
 *
 * 🎬 ESTRUCTURA DE 3 ACTOS:
 * - Acto 1 (35%): Establece lo cotidiano, crea familiaridad
 * - Acto 2 (40%): El giro, la revelación, el "aha moment"
 * - Acto 3 (25%): Resignifica el acto 1 con nueva perspectiva
 *
 * 💬 CALLS-TO-CURIOSITY:
 * - "¿Qué opinas de esto?"
 * - "¿Lo sabías?"
 * - "Cuéntame tu experiencia en los comentarios"
 * - "¿Crees que es justo?"
 *
 * ⚡ PACING PARA SHORTS:
 * - Cambio visual cada 2-3 segundos
 * - Frases cortas (4-8 palabras)
 * - Sin pausas largas (>0.5s)
 * - Palabras clave enfatizadas
 *
 * 🎨 IDENTIDAD VISUAL:
 * - Color consistente = reconocimiento de marca
 * - Tipografía legible = retención
 * - Movimiento constante = engagement
 * - Subtítulos optimizados = accesibilidad + retención
 */
