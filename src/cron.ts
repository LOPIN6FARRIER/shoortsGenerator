import { executePipeline } from "./pipeline.js";
import { Logger } from "./utils.js";

async function main(): Promise<void> {
  try {
    await executePipeline();
    process.exit(0);
  } catch (error: any) {
    Logger.error("ERROR FATAL EN EL PIPELINE:", error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
