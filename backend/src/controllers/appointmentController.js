import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import DoctorProfile from "../models/DoctorProfile.js";
import SlotHold from "../models/SlotHold.js";
import User from "../models/User.js";
import { generatePreVisitSummary, generatePostVisitSummary } from "../services/llmService.js";
import { sendBookingEmail, sendPostVisitEmail } from "../services/emailService.js";
import { createCalendarEvent } from "../services/calendarService.js";
import { cancelAppointmentAndNotify } from "../services/cancellationService.js";

// Ownership check (prevents IDOR): is this user a party to this appointment?
// - admin: always allowed
// - patient: only if they are the appointment's patient
// - doctor: only if the appointment's doctor profile belongs to them
// Works whether `patient` / `doctor` are populated documents or raw ObjectIds.
const canAccessAppointment = async (user, appointment) => {
  if (user.role === "admin") return true;

  if (user.role === "patient") {
    const patientId = appointment.patient?._id ?? appointment.patient;
    return String(patientId) === String(user._id);
  }

  if (user.role === "doctor") {
    const profile = await DoctorProfile.findOne({ user: user._id }).select("_id");
    if (!profile) return false;
    const doctorId = appointment.doctor?._id ?? appointment.doctor;
    return String(doctorId) === String(profile._id);
  }

  return false;
};

// STEP 1 of booking: patient selects a slot -> we place a short hold on it (5 min TTL)
// so it doesn't show as available to other patients while this one fills the symptom form.
export const holdSlot = async (req, res, next) => {
  try {
    const { doctorId, date, slotTime } = req.body;

    const alreadyBooked = await Appointment.findOne({
      doctor: doctorId,
      date,
      slotTime,
      status: { $in: ["confirmed", "completed"] },
    });
    if (alreadyBooked) return res.status(409).json({ message: "This slot is already booked." });

    const hold = await SlotHold.create({
      doctor: doctorId,
      date,
      slotTime,
      heldBy: req.user._id,
    });

    res.status(201).json({ holdId: hold._id, expiresInSeconds: 300 });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "This slot is currently held by another patient. Please pick another." });
    }
    next(err);
  }
};

// STEP 2 of booking: patient submits symptoms -> confirm the appointment.
// Wrapped in a transaction: check/remove hold + create appointment happen atomically.
// The unique index on Appointment is the final safety net against race conditions.
export const bookAppointment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { doctorId, date, slotTime, symptoms, holdId } = req.body;

    let createdAppointment;

    await session.withTransaction(async () => {
      // Release the hold (if it existed / hasn't expired) as part of the same transaction
      if (holdId) {
        await SlotHold.findOneAndDelete({ _id: holdId, heldBy: req.user._id }, { session });
      }

      const [appointment] = await Appointment.create(
        [
          {
            patient: req.user._id,
            doctor: doctorId,
            date,
            slotTime,
            symptoms: symptoms || "",
            status: "confirmed",
          },
        ],
        { session }
      );
      createdAppointment = appointment;
    });

    // --- Everything below is "best effort" - failures here must NOT undo the booking ---

    // Generate AI pre-visit summary (non-blocking for the response, but we await it here
    // for simplicity; a production system might queue this)
    try {
      const summary = await generatePreVisitSummary(symptoms || "No symptoms provided.");
      createdAppointment.preVisitSummary = {
        urgency: summary.urgency,
        chiefComplaint: summary.chiefComplaint,
        suggestedQuestions: summary.suggestedQuestions,
        generatedAt: new Date(),
        failed: summary.failed,
      };
      await createdAppointment.save();
    } catch (e) {
      console.error("Pre-visit summary generation failed entirely:", e.message);
    }

    const doctorProfile = await DoctorProfile.findById(doctorId).populate("user");
    const patientUser = await User.findById(req.user._id);

    // Email (best effort). One attempt and one record per recipient, so the retry job
    // re-sends only to whoever actually failed.
    for (const recipient of ["patient", "doctor"]) {
      let status = "sent";
      try {
        await sendBookingEmail(recipient, createdAppointment, patientUser, doctorProfile.user);
      } catch (e) {
        console.error(`Booking confirmation email to ${recipient} failed:`, e.message);
        status = "failed";
      }
      createdAppointment.notifications.push({
        type: "booking_confirmation",
        recipient,
        status,
        attempts: 1,
        lastAttemptAt: new Date(),
      });
    }
    await createdAppointment.save();

    // Google Calendar (best effort - null if user hasn't connected calendar)
    try {
      const patientEventId = await createCalendarEvent(patientUser, {
        summary: `Appointment with Dr. ${doctorProfile.user.name}`,
        description: `Specialisation: ${doctorProfile.specialisation}`,
        date,
        slotTime,
        durationMinutes: doctorProfile.slotDurationMinutes,
      });
      const doctorEventId = await createCalendarEvent(doctorProfile.user, {
        summary: `Appointment with ${patientUser.name}`,
        description: `Chief complaint: ${createdAppointment.preVisitSummary.chiefComplaint || "N/A"}`,
        date,
        slotTime,
        durationMinutes: doctorProfile.slotDurationMinutes,
      });
      createdAppointment.googleEventId = patientEventId;
      createdAppointment.doctorGoogleEventId = doctorEventId;
      await createdAppointment.save();
    } catch (e) {
      console.error("Calendar sync failed:", e.message);
    }

    res.status(201).json({ appointment: createdAppointment });
  } catch (err) {
    if (err.code === 11000 || err.errorLabels?.includes("TransientTransactionError")) {
      return res.status(409).json({ message: "This slot was just booked by someone else. Please choose another slot." });
    }
    next(err);
  } finally {
    session.endSession();
  }
};

// DOCTOR: submit post-visit notes + prescription -> generates patient-friendly AI summary
export const submitVisitNotes = async (req, res, next) => {
  try {
    const { doctorNotes, prescription } = req.body;
    const appointment = await Appointment.findById(req.params.id).populate("patient");
    if (!appointment) return res.status(404).json({ message: "Appointment not found." });
    if (!(await canAccessAppointment(req.user, appointment))) {
      return res.status(403).json({ message: "You do not have access to this appointment." });
    }

    appointment.doctorNotes = doctorNotes;
    appointment.prescription = prescription || [];
    appointment.status = "completed";

    const summary = await generatePostVisitSummary(doctorNotes, prescription);
    appointment.postVisitSummary = {
      text: summary.text,
      generatedAt: new Date(),
      failed: summary.failed,
    };

    await appointment.save();

    // Best effort - a failed email here should not undo the saved notes/summary
    try {
      await sendPostVisitEmail(appointment, appointment.patient);
    } catch (e) {
      console.error("Post-visit summary email failed:", e.message);
    }

    res.json({ appointment });
  } catch (err) {
    next(err);
  }
};

// Cancel an appointment(by patient or doctor/admin)
export const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id).populate("patient");
    if (!appointment) return res.status(404).json({ message: "Appointment not found." });
    if (!(await canAccessAppointment(req.user, appointment))) {
      return res.status(403).json({ message: "You do not have access to this appointment." });
    }

    if (appointment.status !== "confirmed") {
      return res.status(409).json({ message: `This appointment is already ${appointment.status.replace("_", " ")}.` });
    }

    await cancelAppointmentAndNotify(appointment, "cancelled", req.body.reason || "Cancelled by user");

    res.json({ appointment });
  } catch (err) {
    next(err);
  }
};

export const listMyAppointments = async (req, res, next) => {
  try {
    const filter =
      req.user.role === "patient"
        ? { patient: req.user._id }
        : req.user.role === "doctor"
        ? { doctor: await DoctorProfile.findOne({ user: req.user._id }).distinct("_id") }
        : {};

    const appointments = await Appointment.find(filter)
      .populate("patient", "name email")
      .populate({ path: "doctor", populate: { path: "user", select: "name email" } })
      .sort({ date: -1 });

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
};

export const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("patient", "name email")
      .populate({ path: "doctor", populate: { path: "user", select: "name email" } });
    if (!appointment) return res.status(404).json({ message: "Appointment not found." });
    if (!(await canAccessAppointment(req.user, appointment))) {
      return res.status(403).json({ message: "You do not have access to this appointment." });
    }
    res.json({ appointment });
  } catch (err) {
    next(err);
  }
};