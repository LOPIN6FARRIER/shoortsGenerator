import { Router, type Request, type Response } from "express";
import {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
} from "./groups.controller.js";
import {
  validateCreateGroupBody,
  validateUpdateGroupBody,
  validateIdParam,
} from "./groups.validator.js";

const router = Router();

/**
 * GET /api/groups
 * Obtiene todos los grupos con conteo de canales
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const result = await getGroups();
  res.status(result.statusCode || 200).json(result);
});

/**
 * GET /api/groups/:id
 * Obtiene un grupo específico
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const paramValidation = validateIdParam(req.params);
  if (!paramValidation.isValid) {
    res.status(400).json({
      success: false,
      message: "Invalid parameters",
      errors: paramValidation.errors,
    });
    return;
  }

  const result = await getGroup(req.params.id);
  res.status(result.statusCode || 200).json(result);
});

/**
 * POST /api/groups
 * Crea un nuevo grupo
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const validation = validateCreateGroupBody(req.body);
  if (!validation.isValid) {
    res.status(400).json({
      success: false,
      message: "Invalid request body",
      errors: validation.errors,
    });
    return;
  }

  const result = await createGroup(validation.data!);
  res.status(result.statusCode || 200).json(result);
});

/**
 * PUT /api/groups/:id
 * Actualiza un grupo
 */
router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  const paramValidation = validateIdParam(req.params);
  if (!paramValidation.isValid) {
    res.status(400).json({
      success: false,
      message: "Invalid parameters",
      errors: paramValidation.errors,
    });
    return;
  }

  const bodyValidation = validateUpdateGroupBody(req.body);
  if (!bodyValidation.isValid) {
    res.status(400).json({
      success: false,
      message: "Invalid request body",
      errors: bodyValidation.errors,
    });
    return;
  }

  const result = await updateGroup(req.params.id, bodyValidation.data!);
  res.status(result.statusCode || 200).json(result);
});

/**
 * DELETE /api/groups/:id
 * Elimina un grupo (solo si no tiene canales asignados)
 */
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const paramValidation = validateIdParam(req.params);
  if (!paramValidation.isValid) {
    res.status(400).json({
      success: false,
      message: "Invalid parameters",
      errors: paramValidation.errors,
    });
    return;
  }

  const result = await deleteGroup(req.params.id);
  res.status(result.statusCode || 200).json(result);
});

export default router;
