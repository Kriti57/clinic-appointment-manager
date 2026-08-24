import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

const seed = async () => {
  await connectDB();

  const existing = await User.findOne({ email: "admin@clinic.com" });
  if (existing) {
    console.log("Admin already exists.");
  } else {
    await User.create({
      name: "Clinic Admin",
      email: "admin@clinic.com",
      password: "admin123", // change after first login
      role: "admin",
    });
    console.log("Admin created: admin@clinic.com / admin123");
  }

  await mongoose.disconnect();
};

seed();
