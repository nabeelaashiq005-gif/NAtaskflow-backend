import { z } from "zod";

export const commentContentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment is too long (max 2000 characters)"),
});
