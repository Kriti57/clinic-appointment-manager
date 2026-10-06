import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

// Admin credentials come from the environment so no password lives in the repo.
//   ADMIN_EMAIL    (optional, default admin@clinic.com)
//   ADMIN_PASSWORD (required, 8+ characters)
const seed = async () => {
  const email = (process.env.ADMIN_EMAIL || "admin@clinic.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    console.error("Set ADMIN_PASSWORD (8+ characters) in your environment before running the seed.");
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin ${email} already exists.`);
  } else {
    await User.create({ name: "Clinic Admin", email, password, role: "admin" });
    console.log(`Admin created: ${email}`);
  }

  await mongoose.disconnect();
};

seed();