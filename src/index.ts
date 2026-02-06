import "dotenv/config";
import cron from "node-cron";
import { executePipeline } from "./pipeline.js";
import { Logger } from "./utils.js";
import { initDatabase, getPool } from "./database.js";
import app from "./api-app.js";

// Exportar funciones principales para uso programático
export { executePipeline } from "./pipeline.js";
export { generateTopic } from "./topic.js";
export { generateScript, generateBilingualScripts } from "./script.js";
export { generateTTS, checkEdgeTTS } from "./tts.js";
export { generateShortsOptimizedSRT } from "./subtitles.js";
export { generateVideo, checkFFmpeg } from "./video.js";
export { uploadToYouTube, checkCredentials } from "./upload.js";
export { CONFIG } from "./config.js";
export { Logger } from "./utils.js";

async function runPipeline(): Promise<void> {
  try {
    Logger.info("=== INICIANDO GENERACIÓN DE YOUTUBE SHORTS ===");
    await executePipeline();
    Logger.success("Pipeline completado exitosamente");
  } catch (error: any) {
    Logger.error("ERROR FATAL EN EL PIPELINE:", error.message);
    console.error(error);
    throw error;
  }
}

// Configuración de cron (personalizable)
// Por defecto: Ejecutar todos los días a las 10:00 AM
// Formato: segundo minuto hora día mes día-semana
// Ejemplos:
//   '0 10 * * *'    - Diario a las 10:00 AM
//   '0 */6 * * *'   - Cada 6 horas
//   '0 0 * * 0'     - Cada domingo a medianoche
//   '0 8,20 * * *'  - Diario a las 8:00 AM y 8:00 PM

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 10 * * *";
const API_PORT = process.env.API_PORT || 3001;

async function startServer() {
  try {
    // Initialize database
    initDatabase();
    const pool = getPool();
    await pool.query("SELECT NOW();");
    Logger.success("✅ Conexión a PostgreSQL establecida");

    // Start API server
    app.listen(API_PORT, () => {
      Logger.success(`🚀 API corriendo en http://localhost:${API_PORT}`);
      Logger.info(
        `📊 Dashboard: ${process.env.DASHBOARD_URL || "http://localhost:4200"}`,
      );
    });

    Logger.info("✅ Servidor iniciado correctamente");
  } catch (error: any) {
    Logger.error("❌ Error iniciando servidor:", error.message);
    console.error(error);
    process.exit(1);
  }
}

if (process.env.RUN_ONCE === "true") {
  // Ejecutar una sola vez (útil para testing o ejecución manual)
  Logger.info("Modo ejecución única");

  // Start server first
  await startServer();

  // Then run pipeline once
  runPipeline()
    .then(() => {
      Logger.info("Pipeline completado, servidor API sigue activo");
    })
    .catch((error) => {
      Logger.error("Error en pipeline:", error);
    });
} else {
  // Modo cron (ejecución programada)

  // Start server first
  await startServer();

  Logger.info(`📅 Cron configurado: ${CRON_SCHEDULE}`);
  Logger.info(
    "El generador está esperando la siguiente ejecución programada...",
  );

  if (process.env.RUNN_CRON === "true") {
    cron.schedule(CRON_SCHEDULE, async () => {
      await runPipeline();
    });
  }

  // Mantener el proceso vivo
  Logger.info("✅ Servidor activo - Presiona Ctrl+C para detener");
}
