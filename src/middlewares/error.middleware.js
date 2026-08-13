import ApiError from "../utils/ApiError.js";
import { env } from "../config/env.js";

// This MUST be the last middleware registered in app.js.
// Every error thrown anywhere (via asyncHandler or next(err)) ends up here.
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert known Mongoose/JS errors into our ApiError shape
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    error = new ApiError(statusCode, message, error.errors || []);
  }

  // Handle duplicate key errors from MongoDB (e.g., email already exists)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    error = new ApiError(409, `${field} already exists`);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    errors: error.errors,
    ...(env.nodeEnv === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
