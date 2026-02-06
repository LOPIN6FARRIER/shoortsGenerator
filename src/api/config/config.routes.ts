import { Router } from "express";
import {
  getConfigsHandler,
  getConfigHandler,
  upsertConfigHandler,
  bulkUpdateConfigHandler,
  deleteConfigHandler,
} from "./config.handler.js";

const router = Router();

// List all configs
router.get("/", getConfigsHandler);

// Get single config
router.get("/:key", getConfigHandler);

// Create/update config
router.post("/", upsertConfigHandler);

// Bulk update configs
router.post("/bulk", bulkUpdateConfigHandler);

// Delete config
router.delete("/:key", deleteConfigHandler);

export default router;
