// A custom Error class so we can attach an HTTP status code to any error
// we throw, and catch it consistently in one place (error.middleware.js).
class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
