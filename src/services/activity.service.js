import Activity from "../models/Activity.js";

// Call this from anywhere something noteworthy happens (task created,
// comment added, member joined, etc). It deliberately swallows its own
// errors — logging an activity should NEVER cause the main request
// (e.g. "create task") to fail just because the activity log had a hiccup.
export async function logActivity({
  workspace,
  project = null,
  task = null,
  actor,
  type,
  message,
  metadata = {},
}) {
  try {
    await Activity.create({ workspace, project, task, actor, type, message, metadata });
  } catch (error) {
    console.error("⚠️  Failed to log activity:", error.message);
  }
}
