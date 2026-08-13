import WorkspaceMember from "../models/WorkspaceMember.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/v1/dashboard
// Aggregated stats across every workspace the logged-in user belongs to.
export const getDashboard = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.find({
    user: req.user._id,
    status: "active",
  });

  const workspaceIds = memberships.map((m) => m.workspace);
  // Only show the activity feed for workspaces where this user is owner/admin
  // — matches the same restriction applied to the per-workspace activity feed.
  const managerWorkspaceIds = memberships
    .filter((m) => m.role === "owner" || m.role === "admin")
    .map((m) => m.workspace);

  if (workspaceIds.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, {
        totalWorkspaces: 0,
        totalProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        myTasks: { total: 0, completed: 0, pending: 0, overdue: 0 },
        myActiveTasks: [],
        tasksAssignedByMe: [],
        recentActivity: [],
      })
    );
  }

  const now = new Date();

  const [
    totalProjects,
    totalTasks,
    completedTasks,
    overdueTasks,
    myTotalTasks,
    myCompletedTasks,
    myOverdueTasks,
    myActiveTasks,
    tasksAssignedByMe,
    recentActivity,
  ] = await Promise.all([
    Project.countDocuments({ workspace: { $in: workspaceIds } }),
    Task.countDocuments({ workspace: { $in: workspaceIds } }),
    Task.countDocuments({ workspace: { $in: workspaceIds }, status: "done" }),
    Task.countDocuments({
      workspace: { $in: workspaceIds },
      status: { $ne: "done" },
      dueDate: { $ne: null, $lt: now },
    }),
    Task.countDocuments({ workspace: { $in: workspaceIds }, assignees: req.user._id }),
    Task.countDocuments({
      workspace: { $in: workspaceIds },
      assignees: req.user._id,
      status: "done",
    }),
    Task.countDocuments({
      workspace: { $in: workspaceIds },
      assignees: req.user._id,
      status: { $ne: "done" },
      dueDate: { $ne: null, $lt: now },
    }),
    // Actual task list for the "Active Tasks" dashboard section — tasks
    // assigned to this user that aren't done yet, soonest due date first.
    Task.find({
      workspace: { $in: workspaceIds },
      assignees: req.user._id,
      status: { $ne: "done" },
    })
      .sort({ dueDate: 1 })
      .limit(6)
      .populate("project", "name"),
    // Tasks this user has created/assigned to others — only relevant for
    // owners/admins tracking what they've delegated. Restricted to
    // workspaces they manage, same as the activity feed below.
    managerWorkspaceIds.length > 0
      ? Task.find({
          workspace: { $in: managerWorkspaceIds },
          createdBy: req.user._id,
          status: { $ne: "done" },
        })
          .sort({ dueDate: 1 })
          .limit(6)
          .populate("project", "name")
          .populate("assignees", "name avatar")
      : [],
    managerWorkspaceIds.length > 0
      ? Activity.find({ workspace: { $in: managerWorkspaceIds } })
          .populate("actor", "name avatar")
          .populate("workspace", "name")
          .sort({ createdAt: -1 })
          .limit(10)
      : [],
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      totalWorkspaces: workspaceIds.length,
      totalProjects,
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks,
      overdueTasks,
      myTasks: {
        total: myTotalTasks,
        completed: myCompletedTasks,
        pending: myTotalTasks - myCompletedTasks,
        overdue: myOverdueTasks,
      },
      myActiveTasks,
      tasksAssignedByMe,
      recentActivity,
    })
  );
});
