import { Router } from "express";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  assignTask,
  submitTaskFile,
  getTodayTasks,
  getUpcomingTasks,
  searchTasks,
  listAllTasks,
} from "../controllers/task.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkProjectAccess from "../middlewares/projectAccess.middleware.js";
import checkTaskAccess from "../middlewares/taskAccess.middleware.js";
import taskSubmissionUpload from "../middlewares/taskSubmission.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
} from "../validators/task.validator.js";

// Same pattern as project.routes.js: this router defines its own full
// paths since tasks are reachable both nested under a project and directly.
const router = Router();

router.use(verifyJWT);

// --- Project-scoped: create & list ---
router.post(
  "/projects/:projectId/tasks",
  checkProjectAccess(["owner", "admin"], "projectId"), // members can no longer create tasks
  validate(createTaskSchema),
  createTask
);
router.get(
  "/projects/:projectId/tasks",
  checkProjectAccess([], "projectId"), // any active member (including viewers) can view
  listTasks
);

// --- Global task views (defined BEFORE /tasks/:id so they aren't captured by it) ---
router.get("/tasks", listAllTasks);
router.get("/tasks/today", getTodayTasks);
router.get("/tasks/upcoming", getUpcomingTasks);
router.get("/tasks/search", searchTasks);

// --- Task-scoped: get/update/delete/assign ---
router.get("/tasks/:id", checkTaskAccess([]), getTask);
router.patch(
  "/tasks/:id",
  checkTaskAccess(["owner", "admin"]), // members can no longer edit task fields — see submission route below
  validate(updateTaskSchema),
  updateTask
);
router.delete("/tasks/:id", checkTaskAccess(["owner", "admin"]), deleteTask); // members can no longer delete tasks
router.patch(
  "/tasks/:id/assign",
  checkTaskAccess(["owner", "admin"]), // members can no longer reassign tasks
  validate(assignTaskSchema),
  assignTask
);
router.post(
  "/tasks/:id/submission",
  checkTaskAccess(["owner", "admin", "member"]), // controller further restricts members to their own assigned tasks
  taskSubmissionUpload.single("file"),
  submitTaskFile
);

export default router;
