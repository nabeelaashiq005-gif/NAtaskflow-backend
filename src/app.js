import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import passport from "passport";
import "./config/passport.js"; // import to register the Google Strategy
import { env } from "./config/env.js";
import errorHandler from "./middlewares/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import projectRoutes from "./routes/project.routes.js";
import taskRoutes from "./routes/task.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

const allowedOrigins = [env.clientUrl, "http://localhost:3001", "http://localhost:3000"];

// --- Global middlewares ---
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true, // allow cookies to be sent cross-origin
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

// Initialize Passport for Google OAuth
app.use(passport.initialize());

// Serve uploaded avatar images at http://localhost:5000/uploads/avatars/<file>
// (serverless platforms like Vercel have a read-only filesystem — skip there)
const isServerless = process.env.VERCEL === "1";
if (!isServerless) {
  app.use("/uploads", express.static(path.resolve("public/uploads")));
}

// --- Health check (useful for confirming the server is alive) ---
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- API routes ---
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1", projectRoutes); // this router defines full paths itself (/workspaces/:id/projects and /projects/:id)
app.use("/api/v1", taskRoutes); // this router defines full paths itself (/projects/:id/tasks and /tasks/:id)
app.use("/api/v1", commentRoutes); // this router defines full paths itself (/tasks/:id/comments and /comments/:id)
app.use("/api/v1", activityRoutes); // this router defines full paths itself (/workspaces/:id/activities)
app.use("/api/v1", dashboardRoutes); // this router defines full paths itself (/dashboard)
app.use("/api/v1/notifications", notificationRoutes);

// --- 404 handler for unknown routes ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// --- Centralized error handler (must be last) ---
app.use(errorHandler);

export default app;







