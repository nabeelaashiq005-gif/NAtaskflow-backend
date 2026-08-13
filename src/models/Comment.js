import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Comment cannot be empty"],
      trim: true,
      maxlength: 2000,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast "all comments for this task, oldest first" queries
commentSchema.index({ task: 1, createdAt: 1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
