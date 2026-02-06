import { Router } from "express";
import { getVideosHandler, getVideoByIdHandler } from "./videos.handler.js";

const router = Router();

router.get("/", getVideosHandler);
router.get("/:id", getVideoByIdHandler);

export default router;
