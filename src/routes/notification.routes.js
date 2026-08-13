import { Router } from "express";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notification.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/", listNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);

export default router;
