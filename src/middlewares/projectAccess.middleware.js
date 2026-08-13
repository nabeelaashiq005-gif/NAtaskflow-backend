import Project from "../models/Project.js";
import WorkspaceMember from "../models/WorkspaceMember.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Usage: checkProjectAccess(['owner', 'admin'])
// Usage with a custom param name: checkProjectAccess([], 'projectId')
// Pass an empty array to allow ANY active member of the project's workspace.
//
// Reads the project id from req.params[paramName] (defaults to "id"),
// loads the project, then checks the logged-in user's membership in that
// project's PARENT workspace (projects don't have their own roles — access
// is inherited from the workspace). Attaches req.project and
// req.workspaceMember for later use.
const checkProjectAccess = (allowedRoles = [], paramName = "id") =>
  asyncHandler(async (req, res, next) => {
    const project = await Project.findById(req.params[paramName]);
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    const membership = await WorkspaceMember.findOne({
      workspace: project.workspace,
      user: req.user._id,
    });

    if (!membership || membership.status !== "active") {
      throw new ApiError(403, "You are not a member of this project's workspace");
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
      throw new ApiError(
        403,
        `This action requires one of these workspace roles: ${allowedRoles.join(", ")}`
      );
    }

    req.project = project;
    req.workspaceMember = membership;
    next();
  });

export default checkProjectAccess;
