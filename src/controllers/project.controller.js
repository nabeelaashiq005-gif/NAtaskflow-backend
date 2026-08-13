import Project from "../models/Project.js";
import WorkspaceMember from "../models/WorkspaceMember.js";
import Task from "../models/Task.js";
import Comment from "../models/Comment.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.service.js";

// POST /api/v1/workspaces/:workspaceId/projects  (requires checkWorkspaceRole(['owner','admin']))
export const createProject = asyncHandler(async (req, res) => {
  const { name, description, dueDate, memberIds } = req.body;
  const { workspaceId } = req.params;

  // Every proposed member must be an ACTIVE member of the workspace.
  if (memberIds.length > 0) {
    const validMemberships = await WorkspaceMember.find({
      workspace: workspaceId,
      user: { $in: memberIds },
      status: "active",
    });
    if (validMemberships.length !== memberIds.length) {
      throw new ApiError(
        400,
        "One or more selected users are not active members of this workspace"
      );
    }
  }

  // Creator is always included, plus whoever else was selected (no duplicates).
  const members = Array.from(new Set([String(req.user._id), ...memberIds.map(String)]));

  const project = await Project.create({
    workspace: workspaceId,
    name,
    description,
    dueDate: dueDate || null,
    createdBy: req.user._id,
    members,
  });
  await project.populate("members", "name email avatar");

  await logActivity({
    workspace: workspaceId,
    project: project._id,
    actor: req.user._id,
    type: "project_created",
    message: `${req.user.name} created project "${name}"`,
  });

  res
    .status(201)
    .json(new ApiResponse(201, { project }, "Project created successfully"));
});

// GET /api/v1/workspaces/:workspaceId/projects  (requires checkWorkspaceRole([]))
export const listProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({ workspace: req.params.workspaceId })
    .populate("members", "name email avatar")
    .sort({ createdAt: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, { projects }, "Projects fetched successfully"));
});

// GET /api/v1/projects  — every project across the user's active workspaces
export const listAllProjects = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.find({
    user: req.user._id,
    status: "active",
  });
  const workspaceIds = memberships.map((m) => m.workspace);

  const projects =
    workspaceIds.length === 0
      ? []
      : await Project.find({ workspace: { $in: workspaceIds } })
          .populate("workspace", "name")
          .populate("members", "name email avatar")
          .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, { projects }, "Projects fetched successfully"));
});

// GET /api/v1/projects/:id  (requires checkProjectAccess([]))
export const getProject = asyncHandler(async (req, res) => {
  const project = await req.project.populate("members", "name email avatar");

  res.status(200).json(
    new ApiResponse(
      200,
      { project, myWorkspaceRole: req.workspaceMember.role },
      "Project fetched successfully"
    )
  );
});

// PATCH /api/v1/projects/:id  (requires checkProjectAccess(['owner','admin','member']))
export const updateProject = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if ("dueDate" in updates) {
    updates.dueDate = updates.dueDate || null;
  }

  const project = await Project.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate("members", "name email avatar");

  res
    .status(200)
    .json(new ApiResponse(200, { project }, "Project updated successfully"));
});

// DELETE /api/v1/projects/:id  (requires checkProjectAccess(['owner','admin']))
export const deleteProject = asyncHandler(async (req, res) => {
  const project = req.project;

  // Cascade-delete everything that belongs to this project so we don't
  // leave orphaned tasks/comments behind.
  const tasksInProject = await Task.find({ project: project._id }).select("_id");
  const taskIds = tasksInProject.map((t) => t._id);
  await Comment.deleteMany({ task: { $in: taskIds } });
  await Task.deleteMany({ project: project._id });
  await project.deleteOne();

  await logActivity({
    workspace: project.workspace,
    actor: req.user._id,
    type: "project_deleted",
    message: `${req.user.name} deleted project "${project.name}"`,
  });

  res.status(200).json(new ApiResponse(200, null, "Project deleted successfully"));
});

// POST /api/v1/projects/:id/members  (requires checkProjectAccess(['owner','admin']))
// Replaces the project's member list with the given set of user ids.
export const assignMembers = asyncHandler(async (req, res) => {
  const { memberIds } = req.body;
  const project = req.project;

  // Every proposed member must be an ACTIVE member of the parent workspace —
  // you can't assign someone to a project in a workspace they don't belong to.
  const validMemberships = await WorkspaceMember.find({
    workspace: project.workspace,
    user: { $in: memberIds },
    status: "active",
  });

  if (validMemberships.length !== memberIds.length) {
    throw new ApiError(
      400,
      "One or more selected users are not active members of this workspace"
    );
  }

  project.members = memberIds;
  await project.save();
  await project.populate("members", "name email avatar");

  res
    .status(200)
    .json(new ApiResponse(200, { project }, "Project members updated successfully"));
});
