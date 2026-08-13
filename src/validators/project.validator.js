import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().trim().max(500).optional().default(""),
  dueDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid due date"),
  memberIds: z
    .array(z.string().regex(objectIdRegex, "Invalid member id"))
    .optional()
    .default([]),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["active", "archived", "completed"]).optional(),
  dueDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid due date"),
});

export const assignMembersSchema = z.object({
  memberIds: z
    .array(z.string().regex(objectIdRegex, "Invalid member id"))
    .default([]),
});
