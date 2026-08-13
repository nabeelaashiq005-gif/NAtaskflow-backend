import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/dashboard", verifyJWT, getDashboard);

export default router;
