import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "task_assigned",
        "workspace_invited",
        "task_submitted",
        "task_updated", // assigned task ki details revise hui
        "due_date_reminder", // task ki last date qareeb hai
      ],
    },
    message: {
      type: String,
      required: true,
    },
    // A frontend route to navigate to when the notification is clicked,
    // e.g. "/invitations" or "/workspaces/:id/projects/:id".
    link: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Fast "my unread notifications, newest first" queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
