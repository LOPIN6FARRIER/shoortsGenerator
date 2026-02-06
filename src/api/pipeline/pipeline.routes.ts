import { Router } from "express";
import {
  getPipelineExecutionsHandler,
  getPipelineExecutionByIdHandler,
} from "./pipeline.handler.js";

const router = Router();

router.get("/", getPipelineExecutionsHandler);
router.get("/:id", getPipelineExecutionByIdHandler);

export default router;
