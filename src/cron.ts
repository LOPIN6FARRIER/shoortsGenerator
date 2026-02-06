import { executePipelineFromDB } from "./pipeline-db.js";
import { Logger } from "./utils.js";
import { getActiveChannels, initDatabase } from "./database.js";
// import { CronJob } from "cron"; // No usado actualmente

/**
 * Evalúa si un cron schedule debe ejecutarse ahora
 */
function shouldExecute(cronSchedule: string): boolean {
  // Simplificado: siempre retornar false ya que no se usa CronJob
  // TODO: Implementar evaluación de cron sin dependencia externa
  return false;
  /* 
  try {
    const job = new CronJob(cronSchedule, () => {});
    const nextDate = job.nextDate();
    const now = new Date();

    // Si la próxima ejecución es dentro de los próximos 10 minutos, ejecutar
    const diff = nextDate.getTime() - now.getTime();
    return diff <= 10 * 60 * 1000; // 10 minutos en ms
  } catch (error) {
    Logger.error(`Error evaluando cron schedule: ${cronSchedule}`, error);
    return false;
  }
  */
}

/**
 * Procesa canales agrupados o individuales
 */
async function processChannels(): Promise<void> {
  await initDatabase();

  const channels = await getActiveChannels();
  Logger.info(`📋 ${channels.length} canales activos encontrados`);

  // Agrupar canales por group_id
  const groups = new Map<string | null, typeof channels>();

  for (const channel of channels) {
    const groupKey = channel.group_id || channel.id; // Si no tiene grupo, usa su propio ID
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(channel);
  }

  // Procesar cada grupo
  for (const [groupKey, groupChannels] of groups.entries()) {
    // Verificar si algún canal del grupo debe ejecutarse según su cron
    const shouldRun = groupChannels.some((ch) =>
      shouldExecute(ch.cron_schedule),
    );

    if (!shouldRun) {
      Logger.info(
        `⏭️  Saltando grupo ${groupChannels[0].group_name || groupChannels[0].name} - No es tiempo de ejecución`,
      );
      continue;
    }

    Logger.info(
      `▶️  Procesando grupo: ${groupChannels[0].group_name || groupChannels[0].name}`,
    );
    Logger.info(`   Canales: ${groupChannels.map((c) => c.name).join(", ")}`);

    try {
      // Si es un grupo (group_id no null), todos los canales generan el mismo contenido
      // Si no, es un canal individual
      if (groupChannels[0].group_id) {
        // Grupo: generar contenido una vez y distribuir a todos los idiomas
        await executePipelineFromDB(groupChannels);
      } else {
        // Canal individual: procesar solo ese canal
        await executePipelineFromDB([groupChannels[0]]);
      }

      Logger.success(`✅ Grupo procesado exitosamente`);
    } catch (error: any) {
      Logger.error(`❌ Error procesando grupo: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    await processChannels();
    process.exit(0);
  } catch (error: any) {
    Logger.error("ERROR FATAL EN EL CRON:", error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
