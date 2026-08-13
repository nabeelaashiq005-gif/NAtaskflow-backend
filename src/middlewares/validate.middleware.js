import ApiError from "../utils/ApiError.js";

// Usage: router.post('/register', validate(registerSchema), controllerFn)
// Runs BEFORE the controller, rejects bad input early with a clear message.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message);
    return next(new ApiError(400, "Validation failed", messages));
  }

  req.body = result.data; // use the parsed/sanitized data
  next();
};

export default validate;
