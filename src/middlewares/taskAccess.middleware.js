import Task from "../models/Task.js";
import WorkspaceMember from "../models/WorkspaceMember.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Usage: checkTaskAccess(['owner', 'admin', 'member'])
// Usage with a custom param name: checkTaskAccess([], 'taskId')
// Pass an empty array to allow ANY active member of the task's workspace.
//
// Reads the task id from req.params[paramName] (defaults to "id"), loads
// the task, then checks the logged-in user's membership in that task's
// workspace (tasks inherit access from the workspace, same pattern as
// projects). Attaches req.task and req.workspaceMember for later use.
const checkTaskAccess = (allowedRoles = [], paramName = "id") =>
  asyncHandler(async (req, res, next) => {
    const task = await Task.findById(req.params[paramName]);
    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    const membership = await WorkspaceMember.findOne({
      workspace: task.workspace,
      user: req.user._id,
    });

    if (!membership || membership.status !== "active") {
      throw new ApiError(403, "You are not a member of this task's workspace");
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
      throw new ApiError(
        403,
        `This action requires one of these workspace roles: ${allowedRoles.join(", ")}`
      );
    }

    req.task = task;
    req.workspaceMember = membership;
    next();
  });

export default checkTaskAccess;
