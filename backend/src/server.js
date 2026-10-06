import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import { connectDB } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import googleAuthRoutes from "./routes/googleAuthRoutes.js";

import { startMedicationReminderJob } from "./jobs/medicationReminderJob.js";
import { startEmailRetryJob } from "./jobs/emailRetryJob.js";

// Fail fast: a missing secret should stop the server at boot, not surface later as
// confusing 401/500 errors (e.g. jwt.sign throws "secretOrPrivateKey must have a value").
const missing = ["JWT_SECRET", "MONGODB_URI"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn("JWT_SECRET is shorter than 32 characters - use a long random string in production.");
}

const isProd = process.env.NODE_ENV === "production";
if (!process.env.CLIENT_URL) {
  if (isProd) {
    console.error("CLIENT_URL must be set in production (CORS would otherwise allow any origin).");
    process.exit(1);
  }
  console.warn("CLIENT_URL not set - CORS is open to all origins (OK for local dev only).");
}

const app = express();

// Render (and most hosts) put a reverse proxy in front of the app. Trust one hop so
// req.ip is the real client IP; otherwise every user shares the proxy's IP and the
// rate limiters below would throttle everyone together.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

// Basic protection against abuse/brute force
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use("/api", apiLimiter);

// Readiness check: also verifies the database. Point Render's health check here.
// readyState 1 = connected.
app.get("/api/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down" });
});

app.use("/api/auth", authRoutes);
app.use("/api/auth", googleAuthRoutes); // /api/auth/google/connect, /api/auth/google/callback
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startMedicationReminderJob();
    startEmailRetryJob();
  });
});