import { generateShortsOptimizedSRT } from "./src/subtitles.js";
import { Logger } from "./src/utils.js";
import { join } from "path";
import { readdirSync, statSync, existsSync } from "fs";

/**
 * Prueba Whisper con un audio existente de output
 */
async function testWhisper() {
  try {
    Logger.info("=== TEST DE WHISPER CON AUDIO EXISTENTE ===\n");

    // Buscar archivos audio.mp3 en output
    const outputDir = join(process.cwd(), "output");
    const audioFiles: string[] = [];

    const findAudioFiles = (dir: string) => {
      const files = readdirSync(dir);
      for (const file of files) {
        const fullPath = join(dir, file);
        if (statSync(fullPath).isDirectory()) {
          findAudioFiles(fullPath);
        } else if (file === "audio.mp3") {
          audioFiles.push(fullPath);
        }
      }
    };

    findAudioFiles(outputDir);

    if (audioFiles.length === 0) {
      Logger.error("❌ No se encontraron archivos audio.mp3 en output/");
      process.exit(1);
    }

    // Usar el primer audio encontrado
    const audioPath = audioFiles[0];
    const audioDir = audioPath
      .replace("/audio.mp3", "")
      .replace("\\audio.mp3", "");

    Logger.info(`📁 Usando audio: ${audioPath}`);
    Logger.info(`📂 Directorio: ${audioDir}\n`);

    // Script de prueba
    const script = {
      language:
        audioPath.includes("/es/") || audioPath.includes("\\es\\")
          ? "es"
          : "en",
      title: "Test Whisper",
      narrative: "Transcripción con Whisper",
      description: "Test",
      tags: [],
      topic: {
        id: "test",
        title: "Test",
        description: "Test",
        imageKeywords: "test",
        timestamp: "",
      },
      estimatedDuration: 30,
    };

    Logger.info(`🌐 Idioma detectado: ${script.language}\n`);
    Logger.info("🎤 Transcribiendo con Whisper AI...\n");

    // Generar subtítulos con Whisper
    const srtPath = await generateShortsOptimizedSRT(
      script,
      audioPath,
      audioDir,
    );

    Logger.info("\n========================================");
    Logger.success("✅ WHISPER TEST COMPLETADO");
    Logger.info("========================================");
    Logger.info(`\n📄 Subtítulos: ${srtPath}`);
    Logger.info("Abre el archivo .srt para ver los timestamps precisos\n");
  } catch (error: any) {
    Logger.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testWhisper();
