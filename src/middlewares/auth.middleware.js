import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Protects any route it's attached to. Reads the access token from the
// "Authorization: Bearer <token>" header, verifies it, and attaches
// the logged-in user to req.user so later code can use it.
const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    throw new ApiError(401, "Not authenticated. No token provided.");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.accessTokenSecret);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired access token");
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new ApiError(401, "User belonging to this token no longer exists");
  }

  req.user = user;
  next();
});

export default verifyJWT;
