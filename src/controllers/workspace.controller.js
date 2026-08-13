import Workspace from "../models/Workspace.js";
import WorkspaceMember from "../models/WorkspaceMember.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { generateUniqueSlug } from "../utils/slugify.js";
import { logActivity } from "../services/activity.service.js";
import { createNotification } from "../services/notification.service.js";

// POST /api/v1/workspaces
export const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const slug = await generateUniqueSlug(name);

  const workspace = await Workspace.create({
    name,
    description,
    slug,
    owner: req.user._id,
  });

  // The creator automatically becomes the "owner" member of their own workspace.
  await WorkspaceMember.create({
    workspace: workspace._id,
    user: req.user._id,
    role: "owner",
    status: "active",
    invitedBy: req.user._id,
  });

  await logActivity({
    workspace: workspace._id,
    actor: req.user._id,
    type: "workspace_created",
    message: `${req.user.name} created the workspace`,
  });

  res
    .status(201)
    .json(new ApiResponse(201, { workspace }, "Workspace created successfully"));
});

// GET /api/v1/workspaces  (workspaces the logged-in user belongs to)
export const listMyWorkspaces = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.find({
    user: req.user._id,
    status: "active",
  }).populate("workspace");

  const workspaces = memberships
    .filter((m) => m.workspace) // guard against orphaned memberships
    .map((m) => ({
      ...m.workspace.toObject(),
      myRole: m.role,
    }));

  res
    .status(200)
    .json(new ApiResponse(200, { workspaces }, "Workspaces fetched successfully"));
});

// GET /api/v1/workspaces/:workspaceId  (requires checkWorkspaceRole([]) middleware)
export const getWorkspace = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  res.status(200).json(
    new ApiResponse(
      200,
      { workspace, myRole: req.workspaceMember.role },
      "Workspace fetched successfully"
    )
  );
});

// PATCH /api/v1/workspaces/:workspaceId  (requires owner/admin)
export const updateWorkspace = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findByIdAndUpdate(
    req.params.workspaceId,
    req.body,
    { new: true, runValidators: true }
  );

  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, { workspace }, "Workspace updated successfully"));
});

// DELETE /api/v1/workspaces/:workspaceId  (requires owner)
export const deleteWorkspace = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  // Only the actual owner can delete — even an "admin" role shouldn't be
  // able to do this, so we check explicitly rather than relying only on
  // the role middleware (which was set to allow just "owner" anyway, but
  // this is a good example of defense-in-depth for a destructive action).
  if (String(workspace.owner) !== String(req.user._id)) {
    throw new ApiError(403, "Only the workspace owner can delete it");
  }

  await WorkspaceMember.deleteMany({ workspace: workspace._id });
  await workspace.deleteOne();

  // Note: in a later phase, we'll also cascade-delete this workspace's
  // projects, tasks, and comments here.

  res.status(200).json(new ApiResponse(200, null, "Workspace deleted successfully"));
});

// GET /api/v1/workspaces/:workspaceId/members  (any active member)
// Shows both active members AND pending invitations (owners/admins need to
// see who's been invited but hasn't accepted yet).
export const listMembers = asyncHandler(async (req, res) => {
  const members = await WorkspaceMember.find({
    workspace: req.params.workspaceId,
    status: { $ne: "removed" },
  }).populate("user", "name email avatar");

  res
    .status(200)
    .json(new ApiResponse(200, { members }, "Members fetched successfully"));
});

// POST /api/v1/workspaces/:workspaceId/members  (requires owner/admin)
// Creates a PENDING invitation — the invited user must accept it before
// they become an active member (see acceptInvitation below).
export const inviteMember = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const { workspaceId } = req.params;

  const userToInvite = await User.findOne({ email });
  if (!userToInvite) {
    throw new ApiError(
      404,
      "No account found with this email. Ask them to register on NATaskFlow first, then invite them again."
    );
  }

  if (String(userToInvite._id) === String(req.user._id)) {
    throw new ApiError(400, "You can't invite yourself");
  }

  const existingMembership = await WorkspaceMember.findOne({
    workspace: workspaceId,
    user: userToInvite._id,
  });

  const workspace = await Workspace.findById(workspaceId).select("name");

  if (existingMembership) {
    if (existingMembership.status === "active") {
      throw new ApiError(409, "This user is already a member of the workspace");
    }
    if (existingMembership.status === "invited") {
      throw new ApiError(409, "This user already has a pending invitation");
    }
    // They were removed before — send a fresh invitation instead of
    // creating a duplicate record (the unique index would reject that anyway).
    existingMembership.status = "invited";
    existingMembership.role = role;
    existingMembership.invitedBy = req.user._id;
    await existingMembership.save();

    await createNotification({
      recipient: userToInvite._id,
      type: "workspace_invited",
      message: `${req.user.name} invited you to join "${workspace.name}"`,
      link: "/invitations",
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { member: existingMembership }, "Invitation sent"));
  }

  const member = await WorkspaceMember.create({
    workspace: workspaceId,
    user: userToInvite._id,
    role,
    status: "invited",
    invitedBy: req.user._id,
  });

  await logActivity({
    workspace: workspaceId,
    actor: req.user._id,
    type: "member_invited",
    message: `${req.user.name} invited ${userToInvite.name} as ${role}`,
  });

  await createNotification({
    recipient: userToInvite._id,
    type: "workspace_invited",
    message: `${req.user.name} invited you to join "${workspace.name}"`,
    link: "/invitations",
  });

  res.status(201).json(new ApiResponse(201, { member }, "Invitation sent"));
});

// GET /api/v1/workspaces/invitations/pending
// Lists workspace invitations waiting for the logged-in user's response.
export const listPendingInvitations = asyncHandler(async (req, res) => {
  const invitations = await WorkspaceMember.find({
    user: req.user._id,
    status: "invited",
  })
    .populate("workspace", "name description")
    .populate("invitedBy", "name email");

  res
    .status(200)
    .json(new ApiResponse(200, { invitations }, "Pending invitations fetched"));
});

// POST /api/v1/workspaces/:workspaceId/invitations/accept
export const acceptInvitation = asyncHandler(async (req, res) => {
  const membership = await WorkspaceMember.findOneAndUpdate(
    { workspace: req.params.workspaceId, user: req.user._id, status: "invited" },
    { status: "active", joinedAt: new Date() },
    { new: true }
  );

  if (!membership) {
    throw new ApiError(404, "No pending invitation found for this workspace");
  }

  await logActivity({
    workspace: req.params.workspaceId,
    actor: req.user._id,
    type: "member_joined",
    message: `${req.user.name} joined the workspace`,
  });

  res
    .status(200)
    .json(new ApiResponse(200, { member: membership }, "Invitation accepted"));
});

// POST /api/v1/workspaces/:workspaceId/invitations/decline
export const declineInvitation = asyncHandler(async (req, res) => {
  const membership = await WorkspaceMember.findOneAndDelete({
    workspace: req.params.workspaceId,
    user: req.user._id,
    status: "invited",
  });

  if (!membership) {
    throw new ApiError(404, "No pending invitation found for this workspace");
  }

  res.status(200).json(new ApiResponse(200, null, "Invitation declined"));
});

// DELETE /api/v1/workspaces/:workspaceId/members/:userId  (requires owner/admin)
export const removeMember = asyncHandler(async (req, res) => {
  const { workspaceId, userId } = req.params;

  const workspace = await Workspace.findById(workspaceId);
  if (String(workspace.owner) === String(userId)) {
    throw new ApiError(400, "The workspace owner cannot be removed");
  }

  const membership = await WorkspaceMember.findOneAndUpdate(
    { workspace: workspaceId, user: userId },
    { status: "removed" },
    { new: true }
  );

  if (!membership) {
    throw new ApiError(404, "This user is not a member of the workspace");
  }

  res.status(200).json(new ApiResponse(200, null, "Member removed successfully"));
});

// PATCH /api/v1/workspaces/:workspaceId/members/:userId  (requires owner)
export const changeMemberRole = asyncHandler(async (req, res) => {
  const { workspaceId, userId } = req.params;
  const { role } = req.body;

  const workspace = await Workspace.findById(workspaceId);
  if (String(workspace.owner) === String(userId)) {
    throw new ApiError(400, "The workspace owner's role cannot be changed here");
  }

  const membership = await WorkspaceMember.findOneAndUpdate(
    { workspace: workspaceId, user: userId, status: "active" },
    { role },
    { new: true }
  );

  if (!membership) {
    throw new ApiError(404, "This user is not an active member of the workspace");
  }

  res
    .status(200)
    .json(new ApiResponse(200, { member: membership }, "Member role updated successfully"));
});
