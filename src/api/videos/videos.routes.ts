import { Router } from "express";

const router = Router();

// TODO: Implement videos list and stats
router.get("/", (req, res) => res.json({ message: "Videos list - TODO" }));
router.get("/stats", (req, res) => res.json({ message: "Stats - TODO" }));
router.get("/:id", (req, res) => res.json({ message: "Video detail - TODO" }));

export default router;
