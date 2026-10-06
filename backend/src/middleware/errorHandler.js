export const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Mongo duplicate key error (e.g. double-booking attempt hitting the unique index)
  if (err.code === 11000) {
    return res.status(409).json({
      message: "This slot was just booked by someone else. Please choose another slot.",
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  // Don't leak internals (stack hints, DB errors) on server faults in production.
  const status = err.statusCode || 500;
  const message =
    status >= 500 && process.env.NODE_ENV === "production"
      ? "Something went wrong on the server."
      : err.message || "Something went wrong on the server.";
  res.status(status).json({ message });
};