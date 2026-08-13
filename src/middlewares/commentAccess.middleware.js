import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import WorkspaceMember from "../models/WorkspaceMember.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Loads the comment, finds its parent task (to know the workspace), and
// checks the logged-in user is still an active member of that workspace.
// Attaches req.comment, req.task, req.workspaceMember.
//
// This does NOT check whether the user is the comment's author — that's
// intentionally left to the controller, since "edit" requires being the
// author, but "delete" allows the author OR a workspace admin/owner.
const loadCommentWithAccess = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const task = await Task.findById(comment.task);
  if (!task) {
    throw new ApiError(404, "The task this comment belongs to no longer exists");
  }

  const membership = await WorkspaceMember.findOne({
    workspace: task.workspace,
    user: req.user._id,
  });

  if (!membership || membership.status !== "active") {
    throw new ApiError(403, "You are not a member of this comment's workspace");
  }

  req.comment = comment;
  req.task = task;
  req.workspaceMember = membership;
  next();
});

export default loadCommentWithAccess;
