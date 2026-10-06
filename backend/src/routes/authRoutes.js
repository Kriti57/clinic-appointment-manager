import { Router } from "express";
import { register, login, getMe, logoutAll } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";
import { validateRegister, validateLogin } from "../middleware/validate.js";

const router = Router();

// Strict limiter for credential endpoints: 10 failed attempts per 15 min per IP.
// skipSuccessfulRequests means a user who logs in correctly doesn't burn their quota,
// so only guessing/brute-force attempts get blocked.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in 15 minutes." },
});

router.post("/register", authLimiter, validateRegister, register);
router.post("/login", authLimiter, validateLogin, login);
router.get("/me", protect, getMe);
router.post("/logout-all", protect, logoutAll);

export default router;