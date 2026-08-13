import WorkspaceMember from "../models/WorkspaceMember.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Usage: checkWorkspaceRole(['owner', 'admin'])
// Pass an empty array (or omit) to allow ANY active member (any role).
//
// Reads the workspace id from req.params.workspaceId. Looks up the
// logged-in user's membership record for that workspace, and rejects
// the request if they're not an active member, or their role isn't
// in the allowed list. On success, attaches req.workspaceMember so
// controllers can use it (e.g. to know the caller's role).
const checkWorkspaceRole = (allowedRoles = []) =>
  asyncHandler(async (req, res, next) => {
    const workspaceId = req.params.workspaceId || req.params.id;

    const membership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
    });

    if (!membership || membership.status !== "active") {
      throw new ApiError(403, "You are not a member of this workspace");
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
      throw new ApiError(
        403,
        `This action requires one of these roles: ${allowedRoles.join(", ")}`
      );
    }

    req.workspaceMember = membership;
    next();
  });

export default checkWorkspaceRole;
