// Wraps an async controller function so any error it throws is
// automatically passed to next(error) -> our error middleware.
// Without this, every controller would need its own try/catch block.
const asyncHandler = (requestHandler) => (req, res, next) => {
  Promise.resolve(requestHandler(req, res, next)).catch(next);
};

export default asyncHandler;
