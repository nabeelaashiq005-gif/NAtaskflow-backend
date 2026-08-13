import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().trim().max(300).optional().default(""),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50).optional(),
  description: z.string().trim().max(300).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Please provide a valid email"),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export const changeMemberRoleSchema = z.object({
  role: z.enum(["admin", "member", "viewer"], {
    errorMap: () => ({ message: "Role must be admin, member, or viewer" }),
  }),
});
