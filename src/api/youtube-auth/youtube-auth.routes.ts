import { Router, type Request, type Response } from "express";
import {
  generateAuthUrl,
  handleOAuthCallback,
  handleManualOAuthCode,
  checkAuthStatus,
  revokeAuth,
} from "./youtube-auth.controller.js";
import { sendResponse } from "../shared/api.utils.js";

const router = Router();

/**
 * GET /api/youtube-auth/:channelId/auth-url
 * Genera URL de autenticación OAuth2
 */
router.get(
  "/:channelId/auth-url",
  async (req: Request, res: Response): Promise<void> => {
    const result = await generateAuthUrl(req.params.channelId);
    res.status(result.statusCode || 200).json(result);
  },
);

/**
 * GET /api/youtube-auth/callback
 * Endpoint de callback para OAuth2
 */
router.get("/callback", async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query;

  if (!code || !state) {
    res.status(400).json({
      success: false,
      message: "Missing code or state parameter",
    });
    return;
  }

  const result = await handleOAuthCallback(code as string, state as string);

  if (result.success) {
    // Redirigir al frontend con éxito
    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:4200"}/channels?auth=success`,
    );
  } else {
    // Redirigir al frontend con error
    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:4200"}/channels?auth=error&message=${encodeURIComponent(result.message)}`,
    );
  }
});

/**
 * POST /api/youtube-auth/:channelId/manual-code
 * Procesa código OAuth manualmente sin callback redirect
 */
router.post(
  "/:channelId/manual-code",
  async (req: Request, res: Response): Promise<void> => {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        message: "Missing authorization code",
      });
      return;
    }

    const result = await handleManualOAuthCode(
      req.params.channelId,
      code as string,
    );
    res.status(result.statusCode || 200).json(result);
  },
);

/**
 * GET /api/youtube-auth/:channelId/status
 * Verifica si un canal está autenticado
 */
router.get(
  "/:channelId/status",
  async (req: Request, res: Response): Promise<void> => {
    const result = await checkAuthStatus(req.params.channelId);
    res.status(result.statusCode || 200).json(result);
  },
);

/**
 * DELETE /api/youtube-auth/:channelId
 * Revoca la autenticación de YouTube
 */
router.delete(
  "/:channelId",
  async (req: Request, res: Response): Promise<void> => {
    const result = await revokeAuth(req.params.channelId);
    res.status(result.statusCode || 200).json(result);
  },
);

export default router;
