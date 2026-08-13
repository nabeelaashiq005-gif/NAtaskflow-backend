import { Router } from "express";
import {
  createWorkspace,
  listMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listMembers,
  inviteMember,
  removeMember,
  changeMemberRole,
  listPendingInvitations,
  acceptInvitation,
  declineInvitation,
} from "../controllers/workspace.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkWorkspaceRole from "../middlewares/role.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  changeMemberRoleSchema,
} from "../validators/workspace.validator.js";

const router = Router();

// Every workspace route requires login
router.use(verifyJWT);

router.post("/", validate(createWorkspaceSchema), createWorkspace);
router.get("/", listMyWorkspaces);

// IMPORTANT: this must come BEFORE "/:workspaceId" so Express doesn't try
// to treat "invitations" as a workspace id.
router.get("/invitations/pending", listPendingInvitations);

router.get("/:workspaceId", checkWorkspaceRole([]), getWorkspace);
router.patch(
  "/:workspaceId",
  checkWorkspaceRole(["owner", "admin"]),
  validate(updateWorkspaceSchema),
  updateWorkspace
);
router.delete("/:workspaceId", checkWorkspaceRole(["owner"]), deleteWorkspace);

// Accept/decline don't use checkWorkspaceRole because the user isn't an
// active member yet — that's exactly what these routes are for.
router.post("/:workspaceId/invitations/accept", acceptInvitation);
router.post("/:workspaceId/invitations/decline", declineInvitation);

router.get("/:workspaceId/members", checkWorkspaceRole([]), listMembers);
router.post(
  "/:workspaceId/members",
  checkWorkspaceRole(["owner", "admin"]),
  validate(inviteMemberSchema),
  inviteMember
);
router.delete(
  "/:workspaceId/members/:userId",
  checkWorkspaceRole(["owner", "admin"]),
  removeMember
);
router.patch(
  "/:workspaceId/members/:userId",
  checkWorkspaceRole(["owner"]),
  validate(changeMemberRoleSchema),
  changeMemberRole
);

export default router;
