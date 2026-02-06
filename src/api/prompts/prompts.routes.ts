import { Router } from "express";
import {
  getPromptsHandler,
  getPromptHandler,
  createPromptHandler,
  updatePromptHandler,
  deletePromptHandler,
} from "./prompts.handler.js";

const router = Router();

router.get("/", getPromptsHandler);
router.get("/:id", getPromptHandler);
router.post("/", createPromptHandler);
router.put("/:id", updatePromptHandler);
router.delete("/:id", deletePromptHandler);

export default router;
