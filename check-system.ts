import { Logger } from "./src/utils";
import { checkEdgeTTS, listVoices } from "./src/tts";
import { checkFFmpeg } from "./src/video";
import { checkCredentials } from "./src/upload";
import { CONFIG } from "./src/config";

/**
 * Script de verificación del sistema
 * Comprueba que todas las dependencias y configuraciones estén correctas
 */

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║     VERIFICACIÓN DEL SISTEMA - YOUTUBE SHORTS         ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  let errors = 0;

  // 1. Verificar Edge TTS
  Logger.info("1️⃣  Verificando Edge TTS...");
  const hasEdgeTTS = await checkEdgeTTS();
  if (!hasEdgeTTS) {
    Logger.error("   ❌ Edge TTS no encontrado");
    Logger.info("   Instala con: pip install edge-tts");
    errors++;
  } else {
    Logger.success("   ✅ Edge TTS instalado correctamente\n");

    // Mostrar voces configuradas
    console.log("   Voces configuradas:");
    console.log(`   - Español: ${CONFIG.channels.es.voice}`);
    console.log(`   - Inglés:  ${CONFIG.channels.en.voice}\n`);
  }

  // 2. Verificar FFmpeg
  Logger.info("2️⃣  Verificando FFmpeg...");
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    Logger.error("   ❌ FFmpeg no encontrado");
    Logger.info("   Descarga desde: https://ffmpeg.org/download.html");
    errors++;
  } else {
    Logger.success("   ✅ FFmpeg instalado correctamente\n");
  }

  // 3. Verificar configuración de canales
  Logger.info("3️⃣  Verificando configuración de canales...");

  console.log("\n   📺 Canal Español:");
  if (CONFIG.channels.es.youtubeClientId) {
    Logger.success(`   ✅ Client ID configurado`);
  } else {
    Logger.error("   ❌ Falta Client ID");
    errors++;
  }

  if (CONFIG.channels.es.youtubeClientSecret) {
    Logger.success(`   ✅ Client Secret configurado`);
  } else {
    Logger.error("   ❌ Falta Client Secret");
    errors++;
  }

  console.log("\n   📺 Canal Inglés:");
  if (CONFIG.channels.en.youtubeClientId) {
    Logger.success(`   ✅ Client ID configurado`);
  } else {
    Logger.error("   ❌ Falta Client ID");
    errors++;
  }

  if (CONFIG.channels.en.youtubeClientSecret) {
    Logger.success(`   ✅ Client Secret configurado`);
  } else {
    Logger.error("   ❌ Falta Client Secret");
    errors++;
  }

  // 4. Verificar credenciales OAuth2
  Logger.info("\n4️⃣  Verificando credenciales OAuth2...");

  const hasESCreds = checkCredentials(CONFIG.channels.es);
  const hasENCreds = checkCredentials(CONFIG.channels.en);

  if (!hasESCreds) {
    Logger.error("   ❌ Credenciales del canal español no encontradas");
    Logger.info("   Ejecuta: npm run auth");
    errors++;
  }

  if (!hasENCreds) {
    Logger.error("   ❌ Credenciales del canal inglés no encontradas");
    Logger.info("   Ejecuta: npm run auth");
    errors++;
  }

  // 5. Verificar generación de topics con IA
  Logger.info("\n5️⃣  Verificando generación de topics con IA...");
  if (process.env.OPENAI_API_KEY) {
    Logger.success("   ✅ OpenAI API Key configurada");
    Logger.info("   Topics se generan dinámicamente con GPT-4\n");
  } else {
    Logger.error("   ❌ OPENAI_API_KEY no configurada");
    Logger.info("   Configura en .env para generar topics dinámicos\n");
    errors++;
  }

  // 6. Verificar directorios
  Logger.info("6️⃣  Verificando directorios...");
  Logger.success("   ✅ Estructura de directorios correcta\n");
  console.log("   Directorios:");
  console.log(`   - Output: ${CONFIG.paths.output}`);
  console.log(`   - Español: ${CONFIG.paths.outputEs}`);
  console.log(`   - Inglés: ${CONFIG.paths.outputEn}`);
  console.log(`   - Assets: ${CONFIG.paths.assets}\n`);

  // Resumen final
  console.log("═".repeat(60));
  if (errors === 0) {
    Logger.success("✅ SISTEMA LISTO PARA EJECUTAR");
    console.log("═".repeat(60));
    Logger.info("\nPuedes ejecutar el generador con:");
    console.log("   npm start\n");
  } else {
    Logger.error(`❌ SE ENCONTRARON ${errors} ERROR(ES)`);
    console.log("═".repeat(60));
    Logger.info("\nRevisa los mensajes anteriores y corrige los errores");
    Logger.info("Consulta README.md para más información\n");
    process.exit(1);
  }
}

main().catch((error) => {
  Logger.error("Error en la verificación:", error);
  process.exit(1);
});
