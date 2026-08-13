import { Router } from "express";
import {
  addComment,
  listComments,
  updateComment,
  deleteComment,
} from "../controllers/comment.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkTaskAccess from "../middlewares/taskAccess.middleware.js";
import loadCommentWithAccess from "../middlewares/commentAccess.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { commentContentSchema } from "../validators/comment.validator.js";

const router = Router();

router.use(verifyJWT);

// --- Task-scoped: add & list ---
router.post(
  "/tasks/:taskId/comments",
  checkTaskAccess(["owner", "admin", "member"], "taskId"), // viewers can't comment
  validate(commentContentSchema),
  addComment
);
router.get(
  "/tasks/:taskId/comments",
  checkTaskAccess([], "taskId"), // viewers can read comments
  listComments
);

// --- Comment-scoped: edit & delete ---
router.patch(
  "/comments/:id",
  loadCommentWithAccess,
  validate(commentContentSchema),
  updateComment
);
router.delete("/comments/:id", loadCommentWithAccess, deleteComment);

export default router;
