import { Router } from "express";
import { getTopicsHandler } from "./topics.handler.js";

const router = Router();

router.get("/", getTopicsHandler);

export default router;
