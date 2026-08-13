import mongoose from "mongoose";

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["invited", "active", "removed"],
      default: "active",
      // Note: this MVP adds members immediately (status "active") since
      // there's no accept-invite email flow yet. The "invited" status is
      // reserved for when that flow is built later.
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// A user can only have ONE membership record per workspace.
workspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });

const WorkspaceMember = mongoose.model("WorkspaceMember", workspaceMemberSchema);
export default WorkspaceMember;
