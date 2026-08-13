import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import { startDueDateReminderJob } from "./jobs/dueDateReminder.job.js";

connectDB().then(() => {
  app.listen(env.port, () => {
    console.log(`🚀 NATaskFlow API running on http://localhost:${env.port}`);
    startDueDateReminderJob();
  });
});
