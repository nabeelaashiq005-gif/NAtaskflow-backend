import fs from "fs";
import path from "path";
import crypto from "crypto";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendEmailChangeVerification } from "../services/email.service.js";

function toSafeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    pendingEmail: user.pendingEmail || null,
    avatar: user.avatar,
    isEmailVerified: user.isEmailVerified,
    googleId: user.googleId || null,
    notificationPreferences: user.notificationPreferences,
    createdAt: user.createdAt,
  };
}

// PATCH /api/v1/users/me
export const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name },
    { new: true, runValidators: true } // return the updated doc, re-run schema validation
  );

  res
    .status(200)
    .json(new ApiResponse(200, { user: toSafeUser(user) }, "Profile updated successfully"));
});

// PATCH /api/v1/users/me/avatar   (multipart/form-data, field name: "avatar")
export const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No image file was uploaded");
  }

  const user = await User.findById(req.user._id);

  // Delete the old avatar file from disk if one exists, so we don't
  // accumulate orphaned files every time someone changes their photo.
  if (user.avatar) {
    const oldPath = path.resolve("public", user.avatar.replace(/^\/+/, ""));
    fs.unlink(oldPath, () => {}); // fire-and-forget; ignore if it doesn't exist
  }

  // Store a relative path; the frontend prefixes it with the API's base URL.
  user.avatar = `/uploads/avatars/${req.file.filename}`;
  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new ApiResponse(200, { user: toSafeUser(user) }, "Avatar updated successfully"));
});

// PATCH /api/v1/users/me/password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = newPassword; // pre-save hook in User model will hash it
  await user.save();

  res.status(200).json(new ApiResponse(200, null, "Password changed successfully"));
});

// POST /api/v1/users/me/email   (step 1: request the change)
export const requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail, password } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password is incorrect");
  }

  if (newEmail === user.email) {
    throw new ApiError(400, "This is already your current email");
  }

  const emailTaken = await User.findOne({
    $or: [{ email: newEmail }, { pendingEmail: newEmail }],
  });
  if (emailTaken) {
    throw new ApiError(409, "That email is already in use");
  }

  // Generate a random token. We store a HASH of it in the database and
  // only ever send the raw token via the "email" link — this way, even
  // if the database is ever leaked, the raw tokens can't be reused.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.pendingEmail = newEmail;
  user.emailChangeToken = hashedToken;
  user.emailChangeTokenExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save({ validateBeforeSave: false });

  await sendEmailChangeVerification({ to: newEmail, token: rawToken });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: toSafeUser(user) },
        "Verification link sent. Check the backend terminal (dev mode) for the link."
      )
    );
});

// PATCH /api/v1/users/me/notification-preferences
// Body can include any subset of the notification preference keys (booleans).
export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const preferenceKeys = [
    "taskAssigned",
    "dueDateReminder",
    "taskUpdated",
    "budgetAlerts",
    "generalNotifications",
  ];

  const update = {};
  for (const key of preferenceKeys) {
    if (typeof req.body[key] === "boolean") {
      update[`notificationPreferences.${key}`] = req.body[key];
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: update },
    { new: true, runValidators: true }
  );

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { notificationPreferences: user.notificationPreferences },
        "Notification preferences updated"
      )
    );
});

// GET /api/v1/users/verify-email-change/:token   (step 2: confirm the change)
// Public route — no login required, since the person may click the link
// in a fresh browser/tab.
export const verifyEmailChange = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailChangeToken: hashedToken,
    emailChangeTokenExpires: { $gt: Date.now() },
  }).select("+emailChangeToken +emailChangeTokenExpires");

  if (!user) {
    throw new ApiError(400, "This verification link is invalid or has expired");
  }

  user.email = user.pendingEmail;
  user.pendingEmail = null;
  user.emailChangeToken = undefined;
  user.emailChangeTokenExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new ApiResponse(200, { email: user.email }, "Email updated successfully"));
});
