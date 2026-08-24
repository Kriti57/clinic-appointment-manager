import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import { signToken } from "../utils/jwt.js";

// Patients self-register. Doctors are created by admin (see doctorController).
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = await User.create({ name, email, password, phone, role: "patient" });
    const token = signToken(user._id, user.role);

    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = signToken(user._id, user.role);

    // If this user is a doctor, include their doctor profile id for convenience
    let doctorProfileId = null;
    if (user.role === "doctor") {
      const profile = await DoctorProfile.findOne({ user: user._id });
      doctorProfileId = profile?._id || null;
    }

    res.json({ token, user, doctorProfileId });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
};
