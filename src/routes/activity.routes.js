import { Router } from "express";
import { listActivities } from "../controllers/activity.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkWorkspaceRole from "../middlewares/role.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/workspaces/:workspaceId/activities", checkWorkspaceRole(["owner", "admin"]), listActivities);

export default router;
