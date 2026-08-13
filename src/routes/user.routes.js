import { Router } from "express";
import {
  updateProfile,
  updateAvatar,
  changePassword,
  requestEmailChange,
  verifyEmailChange,
  updateNotificationPreferences,
} from "../controllers/user.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import upload from "../middlewares/upload.middleware.js";
import {
  updateProfileSchema,
  changePasswordSchema,
  requestEmailChangeSchema,
} from "../validators/user.validator.js";

const router = Router();

// --- Public route (no login required — user may click the link from a fresh tab) ---
router.get("/verify-email-change/:token", verifyEmailChange);

// --- Everything below this line requires the user to be logged in ---
router.use(verifyJWT);

router.patch("/me", validate(updateProfileSchema), updateProfile);
router.patch("/me/avatar", upload.single("avatar"), updateAvatar);
router.patch("/me/password", validate(changePasswordSchema), changePassword);
router.post("/me/email", validate(requestEmailChangeSchema), requestEmailChange);
router.patch("/me/notification-preferences", updateNotificationPreferences);

export default router;
