import Task from "../models/Task.js";
import Comment from "../models/Comment.js";
import WorkspaceMember from "../models/WorkspaceMember.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.service.js";
import { createNotification } from "../services/notification.service.js";

// Checks that every id in `userIds` is an ACTIVE member of the given workspace.
// Used whenever assignees are set, so you can't assign a task to someone
// who isn't actually in the workspace.
async function assertValidAssignees(workspaceId, userIds) {
  if (!userIds || userIds.length === 0) return;
  const validMemberships = await WorkspaceMember.find({
    workspace: workspaceId,
    user: { $in: userIds },
    status: "active",
  });
  if (validMemberships.length !== userIds.length) {
    throw new ApiError(400, "One or more assignees are not active members of this workspace");
  }
}

// POST /api/v1/projects/:projectId/tasks  (requires checkProjectAccess(['owner','admin','member'], 'projectId'))
export const createTask = asyncHandler(async (req, res) => {
  const { title, description, priority, dueDate, assignees, labels } = req.body;
  const project = req.project;

  await assertValidAssignees(project.workspace, assignees);

  // New cards go to the bottom of the "To Do" column by default.
  const order = await Task.countDocuments({ project: project._id, status: "todo" });

  const task = await Task.create({
    project: project._id,
    workspace: project.workspace,
    title,
    description,
    priority,
    dueDate: dueDate || null,
    assignees,
    labels,
    status: "todo",
    order,
    createdBy: req.user._id,
  });

  await task.populate("assignees", "name email avatar");

  await logActivity({
    workspace: project.workspace,
    project: project._id,
    task: task._id,
    actor: req.user._id,
    type: "task_created",
    message: `${req.user.name} created task "${title}"`,
  });

  // Notify each assignee (except the creator, if they assigned themselves)
  for (const assigneeId of assignees) {
    if (String(assigneeId) === String(req.user._id)) continue;
    await createNotification({
      recipient: assigneeId,
      type: "task_assigned",
      message: `New task assigned to you — please complete it: "${title}"`,
      link: `/workspaces/${project.workspace}/projects/${project._id}`,
    });
  }

  res.status(201).json(new ApiResponse(201, { task }, "Task created successfully"));
});

// GET /api/v1/projects/:projectId/tasks?status=&priority=&assignee=
export const listTasks = asyncHandler(async (req, res) => {
  const { status, priority, assignee } = req.query;
  const filter = { project: req.project._id };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignee) filter.assignees = assignee;

  const tasks = await Task.find(filter)
    .populate("assignees", "name email avatar")
    .populate("createdBy", "name email avatar")
    .populate("submission.uploadedBy", "name email avatar")
    .sort({ status: 1, order: 1, createdAt: 1 });

  res.status(200).json(new ApiResponse(200, { tasks }, "Tasks fetched successfully"));
});

// GET /api/v1/tasks/:id  (requires checkTaskAccess([]))
export const getTask = asyncHandler(async (req, res) => {
  const task = await req.task.populate([
    { path: "assignees", select: "name email avatar" },
    { path: "createdBy", select: "name email avatar" },
    { path: "submission.uploadedBy", select: "name email avatar" },
    { path: "project", select: "name" },
    { path: "workspace", select: "name" },
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        task,
        canEdit: ["owner", "admin"].includes(req.workspaceMember.role),
        workspaceRole: req.workspaceMember.role,
      },
      "Task fetched successfully"
    )
  );
});

// GET /api/v1/tasks/today  — tasks due today across the user's active workspaces
export const getTodayTasks = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.find({
    user: req.user._id,
    status: "active",
  });
  const workspaceIds = memberships.map((m) => m.workspace);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const tasks =
    workspaceIds.length === 0
      ? []
      : await Task.find({
          workspace: { $in: workspaceIds },
          status: { $ne: "done" },
          dueDate: { $gte: start, $lt: end },
        })
          .populate("project", "name")
          .populate("workspace", "name")
          .populate("assignees", "name avatar")
          .sort({ dueDate: 1 });

  res.status(200).json(new ApiResponse(200, { tasks }));
});

// GET /api/v1/tasks/upcoming  — tasks due in the future across the user's workspaces
export const getUpcomingTasks = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.find({
    user: req.user._id,
    status: "active",
  });
  const workspaceIds = memberships.map((m) => m.workspace);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);

  const tasks =
    workspaceIds.length === 0
      ? []
      : await Task.find({
          workspace: { $in: workspaceIds },
          status: { $ne: "done" },
          dueDate: { $ne: null, $gte: start },
        })
          .populate("project", "name")
          .populate("workspace", "name")
          .populate("assignees", "name avatar")
          .sort({ dueDate: 1 })
          .limit(100);

  res.status(200).json(new ApiResponse(200, { tasks }));
});

// GET /api/v1/tasks  — every task across the user's active workspaces
export const listAllTasks = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.find({
    user: req.user._id,
    status: "active",
  });
  const workspaceIds = memberships.map((m) => m.workspace);

  const tasks =
    workspaceIds.length === 0
      ? []
      : await Task.find({ workspace: { $in: workspaceIds } })
          .populate("project", "name")
          .populate("workspace", "name")
          .populate("assignees", "name avatar")
          .sort({ dueDate: 1 });

  res.status(200).json(new ApiResponse(200, { tasks }, "Tasks fetched successfully"));
});

// GET /api/v1/tasks/search?q=  — full-text-ish search by title across user's workspaces
export const searchTasks = asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const memberships = await WorkspaceMember.find({
    user: req.user._id,
    status: "active",
  });
  const workspaceIds = memberships.map((m) => m.workspace);

  const tasks =
    !q || workspaceIds.length === 0
      ? []
      : await Task.find({
          workspace: { $in: workspaceIds },
          title: { $regex: q, $options: "i" },
        })
          .populate("project", "name")
          .populate("workspace", "name")
          .populate("assignees", "name avatar")
          .sort({ createdAt: -1 })
          .limit(50);

  res.status(200).json(new ApiResponse(200, { tasks }));
});

// PATCH /api/v1/tasks/:id  (requires checkTaskAccess(['owner','admin','member']))
// Handles general edits AND drag-and-drop status changes.
export const updateTask = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  const task = req.task;

  if ("dueDate" in updates) {
    updates.dueDate = updates.dueDate || null;
  }

  // If the due date changes, a previously-sent "due date approaching"
  // reminder is no longer accurate — allow the reminder job to send a
  // fresh one against the new date.
  if ("dueDate" in updates && String(updates.dueDate) !== String(task.dueDate)) {
    updates.dueDateReminderSent = false;
  }

  // Detect a "revision" — the assignee-facing details of the task changed
  // (not just a board-column drag, which is already covered by task_updated
  // activity above but shouldn't spam a notification every drag).
  const revisionFields = ["title", "description", "dueDate", "priority"];
  const isRevision = revisionFields.some(
    (field) =>
      field in updates &&
      String(updates[field] ?? "") !== String(task[field] ?? "")
  );

  // Track completion time automatically — this powers the dashboard's
  // "completed tasks" stat in a later phase.
  if (updates.status === "done" && task.status !== "done") {
    updates.completedAt = new Date();
  } else if (updates.status && updates.status !== "done") {
    updates.completedAt = null;
  }

  const updatedTask = await Task.findByIdAndUpdate(task._id, updates, {
    new: true,
    runValidators: true,
  }).populate("assignees", "name email avatar");

  if (updates.status === "done" && task.status !== "done") {
    await logActivity({
      workspace: task.workspace,
      project: task.project,
      task: task._id,
      actor: req.user._id,
      type: "task_completed",
      message: `${req.user.name} marked "${task.title}" as done`,
    });
  } else if (updates.status && updates.status !== task.status) {
    await logActivity({
      workspace: task.workspace,
      project: task.project,
      task: task._id,
      actor: req.user._id,
      type: "task_updated",
      message: `${req.user.name} moved "${task.title}" to ${updates.status.replace("_", " ")}`,
    });
  }

  // Notify assignees (except whoever made the edit) that the task details changed.
  if (isRevision) {
    for (const assigneeId of updatedTask.assignees) {
      if (String(assigneeId._id) === String(req.user._id)) continue;
      await createNotification({
        recipient: assigneeId._id,
        type: "task_updated",
        message: `${req.user.name} revised task "${updatedTask.title}" — please review it`,
        link: `/workspaces/${task.workspace}/projects/${task.project}`,
      });
    }
  }

  res.status(200).json(new ApiResponse(200, { task: updatedTask }, "Task updated successfully"));
});

// DELETE /api/v1/tasks/:id  (requires checkTaskAccess(['owner','admin','member']))
export const deleteTask = asyncHandler(async (req, res) => {
  await Comment.deleteMany({ task: req.task._id });
  await req.task.deleteOne();

  res.status(200).json(new ApiResponse(200, null, "Task deleted successfully"));
});

// POST /api/v1/tasks/:id/submission — the assignee uploads their finished
// work (PDF/ZIP) for the owner/admin to review. This is how a "member"
// signals a task is ready, since they can no longer change status directly.
export const submitTaskFile = asyncHandler(async (req, res) => {
  const task = req.task;

  const isAssignedToMe = task.assignees.some(
    (assigneeId) => String(assigneeId) === String(req.user._id)
  );
  if (!isAssignedToMe && req.workspaceMember.role !== "owner" && req.workspaceMember.role !== "admin") {
    throw new ApiError(403, "Only someone assigned to this task can submit work for it");
  }

  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }

  task.submission = {
    fileUrl: `/uploads/submissions/${req.file.filename}`,
    fileName: req.file.originalname,
    uploadedBy: req.user._id,
    uploadedAt: new Date(),
  };
  await task.save();
  await task.populate("submission.uploadedBy", "name avatar");

  if (String(task.createdBy) !== String(req.user._id)) {
    await createNotification({
      recipient: task.createdBy,
      type: "task_submitted",
      message: `${req.user.name} submitted work for "${task.title}"`,
      link: `/workspaces/${task.workspace}/projects/${task.project}`,
    });
  }

  res.status(200).json(new ApiResponse(200, { task }, "Submission uploaded"));
});

// PATCH /api/v1/tasks/:id/assign  (requires checkTaskAccess(['owner','admin']))
export const assignTask = asyncHandler(async (req, res) => {
  const { assignees } = req.body;
  const task = req.task;

  await assertValidAssignees(task.workspace, assignees);

  const previousAssigneeIds = task.assignees.map((id) => String(id));
  const newlyAddedIds = assignees.filter((id) => !previousAssigneeIds.includes(String(id)));

  task.assignees = assignees;
  await task.save();
  await task.populate("assignees", "name email avatar");

  if (assignees.length > 0) {
    const names = task.assignees.map((a) => a.name).join(", ");
    await logActivity({
      workspace: task.workspace,
      project: task.project,
      task: task._id,
      actor: req.user._id,
      type: "task_assigned",
      message: `${req.user.name} assigned "${task.title}" to ${names}`,
    });
  }

  // Only notify people who are NEWLY assigned — not everyone every time
  // the assignee list is saved (which would spam re-notifications).
  for (const assigneeId of newlyAddedIds) {
    if (String(assigneeId) === String(req.user._id)) continue;
    await createNotification({
      recipient: assigneeId,
      type: "task_assigned",
      message: `New task assigned to you — please complete it: "${task.title}"`,
      link: `/workspaces/${task.workspace}/projects/${task.project}`,
    });
  }

  res.status(200).json(new ApiResponse(200, { task }, "Assignees updated successfully"));
});
