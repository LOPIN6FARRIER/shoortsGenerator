import { Router } from "express";

const router = Router();

// TODO: Implement config CRUD
router.get("/", (req, res) => res.json({ message: "Config list - TODO" }));
router.put("/:key", (req, res) =>
  res.json({ message: "Update config - TODO" }),
);

export default router;
