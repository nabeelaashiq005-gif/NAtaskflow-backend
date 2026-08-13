import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const dateField = z
  .string()
  .optional()
  .nullable()
  .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid due date");

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(150),
  description: z.string().trim().max(2000).optional().default(""),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  dueDate: dateField,
  assignees: z
    .array(z.string().regex(objectIdRegex, "Invalid assignee id"))
    .optional()
    .default([]),
  labels: z.array(z.string().trim().max(20)).max(5, "Maximum 5 labels").optional().default([]),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: dateField,
  labels: z.array(z.string().trim().max(20)).max(5, "Maximum 5 labels").optional(),
  order: z.number().optional(),
});

export const assignTaskSchema = z.object({
  assignees: z.array(z.string().regex(objectIdRegex, "Invalid assignee id")).default([]),
});
