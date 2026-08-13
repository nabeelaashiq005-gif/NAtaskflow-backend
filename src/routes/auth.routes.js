import { Router } from "express";
import passport from "passport";
import {
  register,
  login,
  logout,
  refreshAccessToken,
  getMe,
  googleCallback,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";
import { env } from "../config/env.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", verifyJWT, logout);
router.post("/refresh-token", refreshAccessToken);
router.get("/me", verifyJWT, getMe);

// --- Password reset ---
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

// --- Google OAuth ---
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${env.clientUrl}/login?error=OAuthFailed` }),
  googleCallback
);

export default router;