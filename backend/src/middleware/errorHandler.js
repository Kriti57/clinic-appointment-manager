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

  res.status(err.statusCode || 500).json({
    message: err.message || "Something went wrong on the server.",
  });
};
