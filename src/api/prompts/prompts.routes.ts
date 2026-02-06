import { Router } from "express";

const router = Router();

// TODO: Implement prompts CRUD
router.get("/", (req, res) => res.json({ message: "Prompts list - TODO" }));
router.get("/:id", (req, res) => res.json({ message: "Prompt detail - TODO" }));
router.post("/", (req, res) => res.json({ message: "Create prompt - TODO" }));
router.put("/:id", (req, res) => res.json({ message: "Update prompt - TODO" }));
router.delete("/:id", (req, res) =>
  res.json({ message: "Delete prompt - TODO" }),
);

export default router;
