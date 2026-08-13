import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "workspace_created",
        "member_invited",
        "member_joined",
        "member_removed",
        "project_created",
        "project_updated",
        "project_deleted",
        "task_created",
        "task_updated",
        "task_assigned",
        "task_completed",
        "task_deleted",
        "comment_added",
      ],
    },
    // A pre-formatted, human-readable sentence — kept simple on purpose
    // rather than reconstructing sentences from `type` on the frontend.
    message: {
      type: String,
      required: true,
    },
    // Room for extra structured detail later (e.g. { oldStatus, newStatus })
    // without needing a schema migration.
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Fast "recent activity for this workspace" queries
activitySchema.index({ workspace: 1, createdAt: -1 });

const Activity = mongoose.model("Activity", activitySchema);
export default Activity;
