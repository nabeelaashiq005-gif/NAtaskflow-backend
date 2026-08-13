import Notification from "../models/Notification.js";
import User from "../models/User.js";

// Maps a notification "type" to the user preference key that controls it.
// Types not listed here (e.g. workspace_invited) are always sent — only
// the categories exposed in Settings > Notifications can be toggled off.
const PREFERENCE_KEY_BY_TYPE = {
  task_assigned: "taskAssigned",
  task_updated: "taskUpdated",
  due_date_reminder: "dueDateReminder",
};

// Call this whenever a user should be notified about something personal
// to them (assigned to a task, invited to a workspace, etc). Like
// logActivity, this swallows its own errors so a notification failure
// never breaks the main request.
export async function createNotification({ recipient, type, message, link = null }) {
  try {
    const preferenceKey = PREFERENCE_KEY_BY_TYPE[type];
    if (preferenceKey) {
      const recipientUser = await User.findById(recipient).select(
        "notificationPreferences"
      );
      // If the user (or the preference field itself) can't be found, default
      // to sending — only skip when the toggle is explicitly turned off.
      if (recipientUser?.notificationPreferences?.[preferenceKey] === false) {
        return;
      }
    }

    // Don't notify someone about their own action (e.g. assigning yourself)
    await Notification.create({ recipient, type, message, link });
  } catch (error) {
    console.error("⚠️  Failed to create notification:", error.message);
  }
}
