import jwt from "jsonwebtoken";

// `tv` (token version) must match user.tokenVersion in the DB. Bumping the user's
// version revokes every token issued before it ("log out everywhere").
export const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, tv: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

// Pin the algorithm so a forged token can't pick a weaker one (e.g. "none").
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
};