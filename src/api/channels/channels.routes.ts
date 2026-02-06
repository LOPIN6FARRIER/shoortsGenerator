import { Router } from "express";
import {
  getChannelsHandler,
  getChannelHandler,
  createChannelHandler,
  updateChannelHandler,
  deleteChannelHandler,
} from "./channels.handler.js";

const router = Router();

// List all channels
router.get("/", getChannelsHandler);

// Get single channel
router.get("/:id", getChannelHandler);

// Create channel
router.post("/", createChannelHandler);

// Update channel
router.put("/:id", updateChannelHandler);

// Delete channel
router.delete("/:id", deleteChannelHandler);

export default router;
