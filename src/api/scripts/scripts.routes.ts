import { Router } from "express";
import { getScriptsHandler, getScriptByIdHandler } from "./scripts.handler.js";

const router = Router();

// GET /api/scripts - List all scripts with filters
router.get("/", getScriptsHandler);

// GET /api/scripts/:id - Get specific script
router.get("/:id", getScriptByIdHandler);

export default router;
