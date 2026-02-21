import { CronExpressionParser } from "cron-parser";
import "dotenv/config";
import { createServer } from "http";
import app from "./api-app.js";
import { getActiveChannels, getPool, initDatabase } from "./database.js";
import { executePipelineFromDB } from "./pipeline-db.js";
import { retryPendingUploads } from "./retry-uploads.js";
import { refreshAllChannelTokens } from "./upload.js";
import { Logger } from "./utils.js";
import {
  katax,
  CallbackTransport,
  registerVersionToRedis,
  startHeartbeat,
  registerProjectInRedis,
} from "katax-service-manager";

// Exportar funciones principales para uso programático
export { CONFIG } from "./config.js";
export { executePipelineFromDB } from "./pipeline-db.js";
export { generateScript } from "./script.js";
export { generateShortsOptimizedSRT } from "./subtitles.js";
export { generateTopic } from "./topic.js";
export { checkEdgeTTS, generateTTS } from "./tts.js";
export {
  checkCredentials,
  refreshAllChannelTokens,
  uploadToYouTube,
} from "./upload.js";
export { Logger } from "./utils.js";
export { checkFFmpeg, generateVideo } from "./video.js";

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
const APP_NAME = process.env.KATAX_APP_NAME || "video-generator";
const PRODUCTION_URL =
  process.env.PRODUCTION_URL || "https://api-youtube.vinicioesparza.dev";
const REDIS_TRANSPORT_NAME = "redis-stream";
const CRON_TOKEN_REFRESH = process.env.CRON_TOKEN_REFRESH || "0 */6 * * *";

let stopPresenceHeartbeat: (() => void) | null = null;

async function bootstrapKatax(): Promise<void> {
  if (katax.isInitialized) {
    return;
  }

  await katax.init({
    appName: APP_NAME,
    logger: {
      level:
        (process.env.LOG_LEVEL as
          | "trace"
          | "debug"
          | "info"
          | "warn"
          | "error"
          | "fatal"
          | undefined) || "info",
      prettyPrint: process.env.NODE_ENV !== "production",
      enableBroadcast: true,
    },
  });

  katax.logger.setAppName(APP_NAME);
}

async function setupRealtimeAndRegistry(
  httpServer: ReturnType<typeof createServer>,
): Promise<void> {
  const socket = await katax.socket({
    name: "main",
    httpServer,
    cors: { origin: "*" },
  });

  await katax.database({
    name: "cache",
    type: "redis",
    connection: process.env.REDIS_URL ?? {
      host: katax.env("REDIS_HOST", "127.0.0.1"),
      port: Number(katax.env("REDIS_PORT", "6379")),
      password: katax.env("REDIS_PASSWORD", ""),
      db: 0,
    },
    required: false,
  });

  try {
    const redisDb = katax.db("cache");
    const redisTransport = new CallbackTransport(async (log) => {
      const level = String((log as any).level ?? "info");
      const persist = (log as any).persist === true;
      if (level !== "error" && !persist) {
        return;
      }

      const { message, broadcast, room, ...metadata } = log;
      const app =
        (log as any).appName ??
        (metadata as any).appName ??
        (metadata as any).app ??
        APP_NAME;

      const fields: string[] = [
        "level",
        level,
        "msg",
        typeof message === "string" ? message : JSON.stringify(message),
        "app",
        String(app),
        "meta",
        JSON.stringify(metadata ?? {}),
        "timestamp",
        String(Date.now()),
      ];

      await redisDb.redis!("XADD", "katax:logs", "*", ...fields);
    }, REDIS_TRANSPORT_NAME);
    katax.logger.addTransport(redisTransport);

    await registerProjectInRedis(redisDb, {
      app: APP_NAME,
      version: katax.version,
      port: String(API_PORT),
      extra: {
        env: process.env.NODE_ENV ?? "unknown",
        url: PRODUCTION_URL,
      },
    });

    await registerVersionToRedis(redisDb, {
      app: APP_NAME,
      version: katax.version,
      port: String(API_PORT),
    });

    const heartbeat = startHeartbeat(
      redisDb,
      {
        app: APP_NAME,
        port: String(API_PORT),
        intervalMs: 10000,
        version: katax.version,
      },
      socket,
    );
    stopPresenceHeartbeat = () => heartbeat.stop();
  } catch (error) {
    Logger.warn("No se pudo inicializar Redis transport/registry", error);
  }
}

async function startServer() {
  try {
    await bootstrapKatax();

    // Initialize database
    await initDatabase();
    const pool = getPool();
    await pool.query("SELECT NOW();");
    Logger.success("✅ Conexión a PostgreSQL establecida");

    const httpServer = createServer(app);
    await setupRealtimeAndRegistry(httpServer);

    // Start API + WebSocket server (shared port)
    httpServer.listen(API_PORT, () => {
      Logger.success(`🚀 API corriendo en http://localhost:${API_PORT}`);
      Logger.success(`🔌 WebSocket corriendo en el mismo puerto: ${API_PORT}`);
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
  stopPresenceHeartbeat?.();
  if (katax.isInitialized) {
    katax.logger.removeTransport(REDIS_TRANSPORT_NAME);
  }
  const { closeDatabase } = await import("./database.js");
  await closeDatabase();
  process.exit(0);
});

process.on("SIGINT", async () => {
  Logger.info("SIGINT recibido, cerrando aplicación...");
  stopPresenceHeartbeat?.();
  if (katax.isInitialized) {
    katax.logger.removeTransport(REDIS_TRANSPORT_NAME);
  }
  const { closeDatabase } = await import("./database.js");
  await closeDatabase();
  process.exit(0);
});

// Start server first
await startServer();

Logger.info(
  `📅 Verificación de canales cada 10 minutos: ${CRON_CHECK_INTERVAL}`,
);
Logger.info(
  "Cada canal se ejecuta según su propio cron_schedule configurado en BD",
);

katax.cron({
  name: "pipeline-check",
  schedule: CRON_CHECK_INTERVAL,
  runOnInit: true,
  task: async () => {
    await runPipeline();
  },
});

katax.cron({
  name: "retry-uploads",
  schedule: CRON_RETRY_INTERVAL,
  runOnInit: true,
  task: async () => {
    Logger.info("🔄 Ejecutando job de reintentos...");
    await retryPendingUploads();
  },
});

katax.cron({
  name: "refresh-tokens",
  schedule: CRON_TOKEN_REFRESH,
  runOnInit: true,
  task: async () => {
    Logger.info("🔑 Ejecutando job de refresh de tokens YouTube...");
    await refreshAllChannelTokens();
  },
});

Logger.info(
  `🔄 Job de reintentos configurado: cada 2 horas (${CRON_RETRY_INTERVAL})`,
);
Logger.info(
  `🔑 Job de refresh de tokens configurado: cada 6 horas (${CRON_TOKEN_REFRESH})`,
);

// Mantener el proceso vivo
Logger.info("✅ Servidor activo - Presiona Ctrl+C para detener");
