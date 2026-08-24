import Appointment from "../models/Appointment.js";
import SlotHold from "../models/SlotHold.js";

// Converts "HH:MM" to minutes since midnight, for easy arithmetic
const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toTimeString = (mins) => {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
};

/**
 * Generates every possible slot for a doctor on a given date based on their
 * working hours + slot duration, then removes:
 *   - slots that fall on a leave day
 *   - slots already booked (confirmed/pending/completed appointments)
 *   - slots currently on hold by another patient
 */
export const getAvailableSlots = async (doctorProfile, dateStr) => {
  const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();

  const isOnLeave = doctorProfile.leaveDays.some((l) => l.date === dateStr);
  if (isOnLeave) return [];

  const daySchedule = doctorProfile.workingHours.find((wh) => wh.dayOfWeek === dayOfWeek);
  if (!daySchedule) return []; // doctor doesn't work this day of week

  const start = toMinutes(daySchedule.startTime);
  const end = toMinutes(daySchedule.endTime);
  const duration = doctorProfile.slotDurationMinutes;

  const allSlots = [];
  for (let t = start; t + duration <= end; t += duration) {
    allSlots.push(toTimeString(t));
  }

  const [booked, held] = await Promise.all([
    Appointment.find({
      doctor: doctorProfile._id,
      date: dateStr,
      status: { $in: ["pending", "confirmed", "completed"] },
    }).distinct("slotTime"),
    SlotHold.find({ doctor: doctorProfile._id, date: dateStr }).distinct("slotTime"),
  ]);

  const unavailable = new Set([...booked, ...held]);
  return allSlots.filter((s) => !unavailable.has(s));
};
