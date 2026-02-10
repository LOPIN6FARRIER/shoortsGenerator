import "dotenv/config";
import cron from "node-cron";
import { CronExpressionParser } from "cron-parser";
import { executePipelineFromDB } from "./pipeline-db.js";
import { retryPendingUploads } from "./retry-uploads.js";
import { Logger } from "./utils.js";
import { initDatabase, getPool, getActiveChannels } from "./database.js";
import app from "./api-app.js";

// Exportar funciones principales para uso programático
export { executePipelineFromDB } from "./pipeline-db.js";
export { generateTopic } from "./topic.js";
export { generateScript, generateBilingualScripts } from "./script.js";
export { generateTTS, checkEdgeTTS } from "./tts.js";
export { generateShortsOptimizedSRT } from "./subtitles.js";
export { generateVideo, checkFFmpeg } from "./video.js";
export { uploadToYouTube, checkCredentials } from "./upload.js";
export { CONFIG } from "./config.js";
export { Logger } from "./utils.js";

/**
 * Evalúa si un cron schedule debe ejecutarse en este momento
 * Compara la última ejecución programada con la ventana de verificación (30 min)
 */
function shouldExecuteNow(cronSchedule: string): boolean {
  try {
    const interval = CronExpressionParser.parse(cronSchedule);
    const now = new Date();

    // Obtener la última vez que debió ejecutarse
    const prevRun = interval.prev().toDate();

    // Calcular cuánto tiempo pasó desde la última ejecución programada
    const timeSinceLastRun = now.getTime() - prevRun.getTime();

    // Si la última ejecución fue dentro de los últimos 30 minutos, ejecutar
    const THIRTY_MINUTES = 30 * 60 * 1000;
    return timeSinceLastRun >= 0 && timeSinceLastRun <= THIRTY_MINUTES;
  } catch (error) {
    Logger.error(`Error evaluando cron schedule: ${cronSchedule}`, error);
    return false;
  }
}

async function runPipeline(): Promise<void> {
  try {
    Logger.info("=== VERIFICANDO CANALES PROGRAMADOS ===");

    // Obtener TODOS los canales activos desde BD
    const allChannels = await getActiveChannels();

    if (allChannels.length === 0) {
      Logger.warn("No hay canales activos configurados");
      return;
    }

    let channelsToExecute = [];
    if (process.env.RUN_ONCE !== "true") {
      channelsToExecute = allChannels.filter((channel) => {
        const shouldRun = shouldExecuteNow(channel.cron_schedule);
        if (shouldRun) {
          Logger.info(
            `✅ ${channel.name}: programado para ejecutarse (${channel.cron_schedule})`,
          );
        } else {
          Logger.info(
            `⏭️  ${channel.name}: no corresponde ejecutar (${channel.cron_schedule})`,
          );
        }
        return shouldRun;
      });
    } else {
      Logger.info(
        "Modo ejecución única: ejecutando para todos los canales activos",
      );
      channelsToExecute = allChannels;
    }

    if (channelsToExecute.length === 0) {
      Logger.info("No hay canales programados para esta ventana de tiempo");
      return;
    }

    Logger.info(
      `\n🚀 Ejecutando pipeline para ${channelsToExecute.length} canal(es)`,
    );
    await executePipelineFromDB(channelsToExecute);
    Logger.success("Pipeline completado exitosamente");
  } catch (error: any) {
    Logger.error("ERROR FATAL EN EL PIPELINE:", error.message);
    console.error(error);
    throw error;
  }
}

// Configuración de cron (personalizable)
// Cron principal: verifica cada 10 minutos qué canales deben ejecutarse
// Cron de reintentos: cada 2 horas revisa videos fallidos y reintenta
// Cada canal tiene su propio cron_schedule en BD
// Ejemplos de cron por canal:
//   '0 10 * * *'    - Diario a las 10:00 AM
//   '0 */6 * * *'   - Cada 6 horas
//   '0 0 * * 0'     - Cada domingo a medianoche
//   '0 8,20 * * *'  - Diario a las 8:00 AM y 8:00 PM

const CRON_CHECK_INTERVAL = process.env.CRON_CHECK_INTERVAL || "*/30 * * * *"; // Cada 30 minutos
const CRON_RETRY_INTERVAL = process.env.CRON_RETRY_INTERVAL || "0 */2 * * *"; // Cada 2 horas
const API_PORT = process.env.API_PORT || 3000;

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
    });

    Logger.info("✅ Servidor iniciado correctamente");
  } catch (error: any) {
    Logger.error("❌ Error iniciando servidor:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Graceful shutdown handler
process.on("SIGTERM", async () => {
  Logger.info("SIGTERM recibido, cerrando aplicación...");
  const { closeDatabase } = await import("./database.js");
  await closeDatabase();
  process.exit(0);
});

process.on("SIGINT", async () => {
  Logger.info("SIGINT recibido, cerrando aplicación...");
  const { closeDatabase } = await import("./database.js");
  await closeDatabase();
  process.exit(0);
});

if (process.env.RUN_ONCE === "true") {
  Logger.info("Modo ejecución única al inicio");

  // Start server first
  startServer();

  // Ejecutar pipeline inmediatamente
  if (process.env.RUN_CRON === "true") {
    runPipeline()
      .then(() => {
        Logger.info("Primera ejecución completada");
        Logger.info(
          `Verificación de cron cada 10 minutos: ${CRON_CHECK_INTERVAL}`,
        );
        Logger.info("Esperando siguiente verificación...");
      })
      .catch((error) => {
        Logger.error("Error en primera ejecución:", error);
      });
  }

  // Después configurar cron normal
  if (process.env.RUN_CRON === "true") {
    // Cron principal: verificar canales cada 10 min
    cron.schedule(CRON_CHECK_INTERVAL, async () => {
      await runPipeline();
    });

    // Cron de reintentos: cada 2 horas
    cron.schedule(CRON_RETRY_INTERVAL, async () => {
      Logger.info("🔄 Ejecutando job de reintentos...");
      await retryPendingUploads();
    });

    Logger.info(
      `🔄 Job de reintentos configurado: cada 2 horas (${CRON_RETRY_INTERVAL})`,
    );
  }
} else {
  // Modo cron (ejecución programada)

  // Start server first
  await startServer();

  Logger.info(
    `📅 Verificación de canales cada 10 minutos: ${CRON_CHECK_INTERVAL}`,
  );
  Logger.info(
    "Cada canal se ejecuta según su propio cron_schedule configurado en BD",
  );

  if (process.env.RUN_CRON === "true") {
    // Cron principal: verificar canales cada 10 min
    cron.schedule(CRON_CHECK_INTERVAL, async () => {
      await runPipeline();
    });

    // Cron de reintentos: cada 2 horas
    cron.schedule(CRON_RETRY_INTERVAL, async () => {
      Logger.info("🔄 Ejecutando job de reintentos...");
      await retryPendingUploads();
    });

    Logger.info(
      `🔄 Job de reintentos configurado: cada 2 horas (${CRON_RETRY_INTERVAL})`,
    );
  }

  // Mantener el proceso vivo
  Logger.info("✅ Servidor activo - Presiona Ctrl+C para detener");
}
