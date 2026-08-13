import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: function () {
        // Sirf tab password required hoga jab user Google se login na kar raha ho
        return !this.googleId;
      },
      minlength: 8,
      select: false, // never returned by default in queries
    },
    googleId: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: "",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // --- Email change flow ---
    pendingEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    emailChangeToken: {
      type: String,
      select: false,
    },
    emailChangeTokenExpires: {
      type: Date,
      select: false,
    },
    // --- Password reset flow ---
    resetPasswordOtp: {
      type: String,
      select: false,
    },
    resetPasswordOtpExpires: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    // --- Notification preferences (Settings > Notifications) ---
    notificationPreferences: {
      taskAssigned: { type: Boolean, default: true }, // naya task assign hone par
      dueDateReminder: { type: Boolean, default: true }, // task ki last date qareeb aane par
      taskUpdated: { type: Boolean, default: true }, // assigned task revise/update hone par
      budgetAlerts: { type: Boolean, default: true }, // budget/dedline qareeb aane par alerts
      generalNotifications: { type: Boolean, default: true }, // general app updates
    },
  },
  { timestamps: true }
);

// --- Middleware: hash password before saving, only if it changed and exists ---
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// --- Instance method: compare a plain password with the stored hash ---
userSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.password) return false;
  return bcrypt.compare(plainPassword, this.password);
};

// --- Instance method: generate a short-lived access token ---
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { userId: this._id, email: this.email },
    env.accessTokenSecret,
    { expiresIn: env.accessTokenExpiry }
  );
};

// --- Instance method: generate a long-lived refresh token ---
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ userId: this._id }, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenExpiry,
  });
};

const User = mongoose.model("User", userSchema);
export default User;