import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    // Denormalized from project.workspace so we can check access and run
    // workspace-wide queries (e.g. dashboard stats later) without an
    // extra lookup through the project on every request.
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    labels: {
      type: [String],
      default: [],
    },
    dueDate: {
      type: Date,
      default: null,
    },
    // Used to keep a consistent card order within a column for drag-and-drop.
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Set to true once a "due date approaching" reminder notification has
    // been sent for this task, so the daily job doesn't re-notify people
    // every time it runs. Reset back to false whenever dueDate changes.
    dueDateReminderSent: {
      type: Boolean,
      default: false,
    },
    // The assignee's uploaded deliverable (PDF or ZIP) — how a member marks
    // their work as ready for the owner/admin to review, since members can
    // no longer change task status directly.
    submission: {
      fileUrl: { type: String, default: null },
      fileName: { type: String, default: null },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      uploadedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Fast "board" queries: all tasks in a project, grouped/sorted by status.
taskSchema.index({ project: 1, status: 1, order: 1 });
taskSchema.index({ assignees: 1 });

const Task = mongoose.model("Task", taskSchema);
export default Task;
