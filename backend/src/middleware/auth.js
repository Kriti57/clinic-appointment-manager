import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";

// Verifies the JWT sent in the Authorization header and attaches the user to req.user
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authenticated. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    // Revoked? Tokens issued before the last "log out everywhere" carry an older version.
    // Tokens from before this feature have no `tv`, so treat missing as 0.
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

// Usage: restrictTo("admin", "doctor")
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    next();
  };
};