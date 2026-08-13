import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import WorkspaceMember from "../models/WorkspaceMember.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { sendPasswordReset } from "../services/email.service.js";

// Cookie options for the refresh token cookie.
const refreshCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production", // HTTPS only in production
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches REFRESH_TOKEN_EXPIRY
};

// Helper: generate both tokens and persist the refresh token on the user
async function issueTokens(user) {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
}

// Strip password/refreshToken before sending user data to the frontend
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

// Compute the user's highest role across their active workspace memberships
// (owner > admin > member > viewer). Used so global pages like Settings can
// label the user with a single badge.
const ROLE_WEIGHT = { owner: 4, admin: 3, member: 2, viewer: 1 };

async function getHighestRole(userId) {
  const memberships = await WorkspaceMember.find({ user: userId, status: "active" }).select("role");
  let best = null;
  let bestWeight = 0;
  for (const m of memberships) {
    const w = ROLE_WEIGHT[m.role] || 0;
    if (w > bestWeight) {
      best = m.role;
      bestWeight = w;
    }
  }
  return best;
}

// POST /api/v1/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const user = await User.create({ name, email, password });
  const { accessToken, refreshToken } = await issueTokens(user);

  res
    .status(201)
    .cookie("refreshToken", refreshToken, refreshCookieOptions)
    .json(
      new ApiResponse(
        201,
        { user: { ...toSafeUser(user), role: null }, accessToken },
        "Account created successfully"
      )
    );
});

// POST /api/v1/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  const role = await getHighestRole(user._id);

  res
    .status(200)
    .cookie("refreshToken", refreshToken, refreshCookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: { ...toSafeUser(user), role }, accessToken },
        "Logged in successfully"
      )
    );
});

// GET /api/v1/auth/google/callback
export const googleCallback = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(400, "Google Authentication failed");
  }

  const { accessToken, refreshToken } = await issueTokens(req.user);
  const clientUrl = env.clientUrl || "http://localhost:3000";

  // Set httpOnly cookie for refresh token and redirect back to frontend with access token
  res
    .cookie("refreshToken", refreshToken, refreshCookieOptions)
    .redirect(`${clientUrl}/auth/google/success?token=${accessToken}`);
});

// POST /api/v1/auth/logout
export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });

  res
    .status(200)
    .clearCookie("refreshToken", refreshCookieOptions)
    .json(new ApiResponse(200, null, "Logged out successfully"));
});

// POST /api/v1/auth/refresh-token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "No refresh token provided. Please log in again.");
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, env.refreshTokenSecret);
  } catch (error) {
    throw new ApiError(401, "Refresh token is invalid or expired");
  }

  const user = await User.findById(decoded.userId).select("+refreshToken");
  if (!user || user.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, "Refresh token does not match. Please log in again.");
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  res
    .status(200)
    .cookie("refreshToken", refreshToken, refreshCookieOptions)
    .json(new ApiResponse(200, { accessToken }, "Access token refreshed"));
});

// GET /api/v1/auth/me (requires verifyJWT middleware)
export const getMe = asyncHandler(async (req, res) => {
  const role = await getHighestRole(req.user._id);
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: { ...toSafeUser(req.user), role } },
        "Current user fetched"
      )
    );
});

// POST /api/v1/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email }).select("+password");
  // Don't reveal whether the email exists — always respond the same way.
  if (!user || !user.password) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "If an account exists for that email, a verification code has been sent."
        )
      );
  }

  const otp = String(crypto.randomInt(100000, 1000000)); // 6-digit code
  user.resetPasswordOtp = crypto.createHash("sha256").update(otp).digest("hex");
  user.resetPasswordOtpExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  await sendPasswordReset({ to: user.email, otp });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "If an account exists for that email, a verification code has been sent."
      )
    );
});

// POST /api/v1/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const user = await User.findOne({
    email: email.toLowerCase(),
    resetPasswordOtp: hashedOtp,
    resetPasswordOtpExpires: { $gt: new Date() },
  }).select("+password");

  if (!user) {
    throw new ApiError(400, "The verification code is invalid or has expired");
  }

  user.password = password;
  user.resetPasswordOtp = undefined;
  user.resetPasswordOtpExpires = undefined;
  await user.save();

  res
    .status(200)
    .json(new ApiResponse(200, null, "Password reset successfully. Please log in."));
});