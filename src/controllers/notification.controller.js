import Notification from "../models/Notification.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/v1/notifications
export const listNotifications = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);

  res
    .status(200)
    .json(new ApiResponse(200, { notifications, unreadCount }, "Notifications fetched"));
});

// PATCH /api/v1/notifications/:id/read
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  res.status(200).json(new ApiResponse(200, { notification }, "Marked as read"));
});

// PATCH /api/v1/notifications/read-all
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true }
  );

  res.status(200).json(new ApiResponse(200, null, "All notifications marked as read"));
});
