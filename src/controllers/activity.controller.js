import Activity from "../models/Activity.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/v1/workspaces/:workspaceId/activities?page=1&limit=20
// (requires checkWorkspaceRole([]) — any active member can view)
export const listActivities = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50); // cap at 50 per page
  const skip = (page - 1) * limit;

  const [activities, total] = await Promise.all([
    Activity.find({ workspace: req.params.workspaceId })
      .populate("actor", "name avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Activity.countDocuments({ workspace: req.params.workspaceId }),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        activities,
        pagination: { page, limit, total, hasMore: skip + activities.length < total },
      },
      "Activity feed fetched successfully"
    )
  );
});
