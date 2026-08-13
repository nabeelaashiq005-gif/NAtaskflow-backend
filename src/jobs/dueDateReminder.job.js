import cron from "node-cron";
import Task from "../models/Task.js";
import { createNotification } from "../services/notification.service.js";

// Finds tasks whose due date is today (or already passed) and are not
// done yet, and sends a "due date" reminder to each assignee — once per
// task (dueDateReminderSent guards against repeat spam on every run).
async function sendDueDateReminders() {
  try {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const dueTasks = await Task.find({
      dueDate: { $ne: null, $lte: endOfToday },
      status: { $ne: "done" },
      dueDateReminderSent: false,
    }).populate("assignees", "_id");

    for (const task of dueTasks) {
      for (const assignee of task.assignees) {
        await createNotification({
          recipient: assignee._id,
          type: "due_date_reminder",
          message: `Aaj "${task.title}" ki last date hai`,
          link: `/workspaces/${task.workspace}/projects/${task.project}`,
        });
      }
      task.dueDateReminderSent = true;
      await task.save();
    }

    if (dueTasks.length > 0) {
      console.log(`⏰ Due-date reminders sent for ${dueTasks.length} task(s)`);
    }
  } catch (error) {
    console.error("⚠️  Due-date reminder job failed:", error.message);
  }
}

// Runs once every hour. Checking hourly (rather than once a day) means a
// task created with today's due date later in the day still gets caught
// the same day, without spamming — dueDateReminderSent stops repeats.
export function startDueDateReminderJob() {
  cron.schedule("0 * * * *", sendDueDateReminders);
  // Also run once at startup so reminders aren't delayed up to an hour
  // after the server (re)starts.
  sendDueDateReminders();
}
