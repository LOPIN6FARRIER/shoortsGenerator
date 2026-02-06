import express from "express";
import cors from "cors";
import router from "./api/routes.js";
import { errorMiddleware } from "./api/middleware/error.middleware.js";
import { requestLogger } from "./api/middleware/logger.middleware.js";

const app = express();

// CORS
app.use(
  cors({
    origin: process.env.DASHBOARD_URL || "http://localhost:4200",
    credentials: true,
  }),
);

// Handle preflight
app.options("*", cors());

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
app.get("/", (req: express.Request, res: express.Response) => {
  res.json({
    message: "YouTube Shorts Generator API",
    version: "1.0.0",
    endpoints: "/api",
    health: "/api/health",
  });
});

app.use("/api", router);

// Error handling
app.use(errorMiddleware);

export default app;
