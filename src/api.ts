import "dotenv/config";
import app from "./api-app.js";
import { Logger } from "./utils.js";
import { initDatabase, getPool } from "./database.js";

const PORT = process.env.API_PORT || 3001;

async function startAPI() {
  try {
    // Initialize database and test connection
    await initDatabase();
    const pool = getPool();
    await pool.query("SELECT NOW();");
    Logger.success("✅ Conexión a PostgreSQL establecida");

    app.listen(PORT, () => {
      Logger.success(`🚀 API corriendo en http://localhost:${PORT}`);
      Logger.info(
        `📊 Dashboard: ${process.env.DASHBOARD_URL || "http://localhost:4200"}`,
      );
    });
  } catch (error: any) {
    Logger.error("❌ Error iniciando API:", error.message);
    console.error(error);
    process.exit(1);
  }
}

startAPI();
