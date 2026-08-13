import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
});

export const requestEmailChangeSchema = z.object({
  newEmail: z.string().trim().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required to confirm this change"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(/[A-Z]/, "New password must contain an uppercase letter")
      .regex(/[0-9]/, "New password must contain a number")
      .regex(/[^A-Za-z0-9]/, "New password must contain a special character"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });
