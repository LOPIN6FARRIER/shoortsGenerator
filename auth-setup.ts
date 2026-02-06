import * as readline from "readline";
import { CONFIG } from "./src/config";
import { generateAuthUrl, saveCredentials } from "./src/upload";
import { Logger } from "./src/utils";

/**
 * Script de autenticación OAuth2 para YouTube
 * Ejecutar con: ts-node auth-setup.ts
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function authenticateChannel(language: "es" | "en") {
  const channelConfig = CONFIG.channels[language];
  const channelName = language === "es" ? "ESPAÑOL" : "INGLÉS";

  console.log(`\n${"=".repeat(60)}`);
  console.log(`   AUTENTICACIÓN CANAL ${channelName}`);
  console.log("=".repeat(60));

  Logger.info(`Configuración actual:`);
  console.log(
    `  - Client ID: ${channelConfig.youtubeClientId.slice(0, 20)}...`,
  );
  console.log(`  - Credentials Path: ${channelConfig.youtubeCredentialsPath}`);

  // Generar URL de autenticación
  const authUrl = generateAuthUrl(channelConfig);

  console.log(`\n1. Abre esta URL en tu navegador:\n`);
  console.log(`   ${authUrl}\n`);
  console.log(`2. Autoriza la aplicación`);
  console.log(`3. Copia el código de autorización de la URL`);
  console.log(
    `   (aparecerá en la barra de direcciones después de autorizar)\n`,
  );

  const code = await question("Pega el código de autorización aquí: ");

  if (!code) {
    Logger.error("No se proporcionó ningún código");
    return false;
  }

  try {
    await saveCredentials(code, channelConfig);
    Logger.success(`✅ Canal ${channelName} autenticado correctamente`);
    return true;
  } catch (error: any) {
    Logger.error(`Error autenticando canal ${channelName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║   CONFIGURACIÓN DE AUTENTICACIÓN YOUTUBE API          ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  Logger.info("Este script te ayudará a autenticar ambos canales de YouTube");
  Logger.info(
    "Asegúrate de tener las credenciales OAuth2 en tu archivo .env\n",
  );

  // Verificar configuración
  if (
    !CONFIG.channels.es.youtubeClientId ||
    !CONFIG.channels.en.youtubeClientId
  ) {
    Logger.error("\n❌ ERROR: Falta configuración en el archivo .env");
    Logger.info("Copia .env.example a .env y configura tus credenciales");
    process.exit(1);
  }

  // Autenticar canal español
  const esSuccess = await authenticateChannel("es");

  if (!esSuccess) {
    Logger.error("\nFalló la autenticación del canal español");
    rl.close();
    process.exit(1);
  }

  console.log("\n" + "-".repeat(60) + "\n");

  // Autenticar canal inglés
  const enSuccess = await authenticateChannel("en");

  if (!enSuccess) {
    Logger.error("\nFalló la autenticación del canal inglés");
    rl.close();
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  Logger.success("✅ AUTENTICACIÓN COMPLETADA EXITOSAMENTE");
  console.log("=".repeat(60));
  Logger.info("\nAmbos canales están listos para subir videos");
  Logger.info("Ejecuta: npm start\n");

  rl.close();
}

main().catch((error) => {
  Logger.error("Error fatal:", error);
  rl.close();
  process.exit(1);
});
