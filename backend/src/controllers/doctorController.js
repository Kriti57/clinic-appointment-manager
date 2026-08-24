import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Appointment from "../models/Appointment.js";
import { getAvailableSlots } from "../services/slotService.js";
import { sendCancellationEmail } from "../services/emailService.js";
import { deleteCalendarEvent } from "../services/calendarService.js";

// ADMIN: create a doctor (creates both the User login and the DoctorProfile)
export const createDoctor = async (req, res, next) => {
  try {
    const { name, email, password, phone, specialisation, slotDurationMinutes, workingHours, bio } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already in use." });

    const user = await User.create({ name, email, password, phone, role: "doctor" });
    const profile = await DoctorProfile.create({
      user: user._id,
      specialisation,
      slotDurationMinutes: slotDurationMinutes || 30,
      workingHours: workingHours || [],
      bio: bio || "",
    });

    res.status(201).json({ user, profile });
  } catch (err) {
    next(err);
  }
};

// ADMIN: update doctor profile (specialisation, hours, slot duration)
export const updateDoctor = async (req, res, next) => {
  try {
    const { specialisation, slotDurationMinutes, workingHours, bio } = req.body;
    const profile = await DoctorProfile.findByIdAndUpdate(
      req.params.id,
      { specialisation, slotDurationMinutes, workingHours, bio },
      { new: true, runValidators: true }
    );
    if (!profile) return res.status(404).json({ message: "Doctor profile not found." });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
};

// ADMIN: add a leave day. Notifies + cancels any existing bookings on that date.
export const addLeaveDay = async (req, res, next) => {
  try {
    const { date, reason } = req.body;
    const profile = await DoctorProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Doctor profile not found." });

    const alreadyOnLeave = profile.leaveDays.some((l) => l.date === date);
    if (!alreadyOnLeave) {
      profile.leaveDays.push({ date, reason: reason || "" });
      await profile.save();
    }

    // Find affected appointments on that date and notify patients
    const affected = await Appointment.find({
      doctor: profile._id,
      date,
      status: { $in: ["pending", "confirmed"] },
    }).populate("patient");

    for (const appt of affected) {
      appt.status = "leave_cancelled";
      appt.cancelReason = `Doctor is on leave: ${reason || "unavailable"}`;
      await appt.save();

      // Best-effort: don't let a notification failure block the leave update
      try {
        await sendCancellationEmail(appt);
      } catch (e) {
        console.error("Failed to send leave-cancellation email:", e.message);
      }
      try {
        if (appt.googleEventId) await deleteCalendarEvent(appt.patient, appt.googleEventId);
      } catch (e) {
        console.error("Failed to delete patient calendar event:", e.message);
      }
    }

    res.json({ profile, affectedAppointments: affected.length });
  } catch (err) {
    next(err);
  }
};

// PUBLIC/PATIENT: list & search doctors by specialisation
export const listDoctors = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.specialisation) {
      filter.specialisation = { $regex: req.query.specialisation, $options: "i" };
    }
    const profiles = await DoctorProfile.find(filter).populate("user", "name email phone");
    res.json({ doctors: profiles });
  } catch (err) {
    next(err);
  }
};

export const getDoctorById = async (req, res, next) => {
  try {
    const profile = await DoctorProfile.findById(req.params.id).populate("user", "name email phone");
    if (!profile) return res.status(404).json({ message: "Doctor not found." });
    res.json({ doctor: profile });
  } catch (err) {
    next(err);
  }
};

// PATIENT: get available slots for a doctor on a given date
export const getDoctorSlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date query param (YYYY-MM-DD) is required." });

    const profile = await DoctorProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Doctor not found." });

    const slots = await getAvailableSlots(profile, date);
    res.json({ date, slots });
  } catch (err) {
    next(err);
  }
};
