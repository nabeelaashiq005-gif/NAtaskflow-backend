import { Router } from "express";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  assignMembers,
  listAllProjects,
} from "../controllers/project.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkWorkspaceRole from "../middlewares/role.middleware.js";
import checkProjectAccess from "../middlewares/projectAccess.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createProjectSchema,
  updateProjectSchema,
  assignMembersSchema,
} from "../validators/project.validator.js";

// This router defines its OWN full paths (rather than being mounted under
// a single prefix) because projects are reachable two ways:
//   /workspaces/:workspaceId/projects  (create/list within a workspace)
//   /projects/:id                       (operate on one specific project)
const router = Router();

router.use(verifyJWT);

// --- Workspace-scoped: create & list ---
router.post(
  "/workspaces/:workspaceId/projects",
  checkWorkspaceRole(["owner", "admin"]), // members can no longer create projects
  validate(createProjectSchema),
  createProject
);
router.get(
  "/workspaces/:workspaceId/projects",
  checkWorkspaceRole([]),
  listProjects
);

// --- Global project view (defined BEFORE /projects/:id so it isn't captured by it) ---
router.get("/projects", listAllProjects);

// --- Project-scoped: get/update/delete/assign ---
router.get("/projects/:id", checkProjectAccess([]), getProject);
router.patch(
  "/projects/:id",
  checkProjectAccess(["owner", "admin"]), // members can no longer edit project details
  validate(updateProjectSchema),
  updateProject
);
router.delete(
  "/projects/:id",
  checkProjectAccess(["owner", "admin"]),
  deleteProject
);
router.post(
  "/projects/:id/members",
  checkProjectAccess(["owner", "admin"]),
  validate(assignMembersSchema),
  assignMembers
);

export default router;
