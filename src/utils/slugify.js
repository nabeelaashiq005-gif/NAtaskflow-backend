import crypto from "crypto";
import Workspace from "../models/Workspace.js";

function baseSlugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove anything that's not a letter/number/space/hyphen
    .replace(/\s+/g, "-") // spaces -> hyphens
    .replace(/-+/g, "-"); // collapse multiple hyphens
}

// Generates a slug like "acme-startup" and, if that's already taken,
// keeps adding a short random suffix until it finds a free one.
export async function generateUniqueSlug(name) {
  const base = baseSlugify(name) || "workspace";
  let slug = base;
  let attempt = 0;

  while (await Workspace.exists({ slug })) {
    attempt += 1;
    const suffix = crypto.randomBytes(3).toString("hex"); // e.g. "a1b2c3"
    slug = `${base}-${suffix}`;
    if (attempt > 5) break; // extremely unlikely, but avoid infinite loops
  }

  return slug;
}
