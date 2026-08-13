import Comment from "../models/Comment.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.service.js";

// POST /api/v1/tasks/:taskId/comments  (requires checkTaskAccess(['owner','admin','member'], 'taskId'))
export const addComment = asyncHandler(async (req, res) => {
  const comment = await Comment.create({
    task: req.task._id,
    author: req.user._id,
    content: req.body.content,
  });
  await comment.populate("author", "name email avatar");

  await logActivity({
    workspace: req.task.workspace,
    project: req.task.project,
    task: req.task._id,
    actor: req.user._id,
    type: "comment_added",
    message: `${req.user.name} commented on "${req.task.title}"`,
  });

  res.status(201).json(new ApiResponse(201, { comment }, "Comment added successfully"));
});

// GET /api/v1/tasks/:taskId/comments  (requires checkTaskAccess([], 'taskId') — viewers can read too)
export const listComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ task: req.task._id })
    .populate("author", "name email avatar")
    .sort({ createdAt: 1 });

  res.status(200).json(new ApiResponse(200, { comments }, "Comments fetched successfully"));
});

// PATCH /api/v1/comments/:id  (requires loadCommentWithAccess — author only)
export const updateComment = asyncHandler(async (req, res) => {
  if (String(req.comment.author) !== String(req.user._id)) {
    throw new ApiError(403, "You can only edit your own comments");
  }

  req.comment.content = req.body.content;
  req.comment.editedAt = new Date();
  await req.comment.save();
  await req.comment.populate("author", "name email avatar");

  res
    .status(200)
    .json(new ApiResponse(200, { comment: req.comment }, "Comment updated successfully"));
});

// DELETE /api/v1/comments/:id  (requires loadCommentWithAccess — author OR workspace owner/admin)
export const deleteComment = asyncHandler(async (req, res) => {
  const isAuthor = String(req.comment.author) === String(req.user._id);
  const isWorkspaceManager = ["owner", "admin"].includes(req.workspaceMember.role);

  if (!isAuthor && !isWorkspaceManager) {
    throw new ApiError(403, "You can only delete your own comments");
  }

  await req.comment.deleteOne();

  res.status(200).json(new ApiResponse(200, null, "Comment deleted successfully"));
});
