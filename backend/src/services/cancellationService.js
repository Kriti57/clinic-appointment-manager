import DoctorProfile from "../models/DoctorProfile.js";
import { sendCancellationEmail } from "./emailService.js";
import { deleteCalendarEvent } from "./calendarService.js";

// Single place for "cancel an appointment + tell people + clean up calendars".
// Used by both patient/doctor/admin cancellation and the admin "doctor on leave" flow.
// `status` is "cancelled" or "leave_cancelled". `appointment.patient` must be populated.
export const cancelAppointmentAndNotify = async (appointment, status, reason) => {
  appointment.status = status;
  appointment.cancelReason = reason;
  await appointment.save();

  try {
    await sendCancellationEmail(appointment);
    appointment.notifications.push({ type: "cancellation", recipient: "patient", status: "sent", attempts: 1, lastAttemptAt: new Date() });
  } catch (e) {
    console.error(`Cancellation email failed for appointment ${appointment._id}:`, e.message);
    appointment.notifications.push({ type: "cancellation", recipient: "patient", status: "failed", attempts: 1, lastAttemptAt: new Date() });
  }
  await appointment.save();

  try {
    if (appointment.googleEventId) await deleteCalendarEvent(appointment.patient, appointment.googleEventId);
    if (appointment.doctorGoogleEventId) {
      const doctorProfile = await DoctorProfile.findById(appointment.doctor).populate("user");
      if (doctorProfile?.user) await deleteCalendarEvent(doctorProfile.user, appointment.doctorGoogleEventId);
    }
  } catch (e) {
    console.error(`Calendar cleanup failed for appointment ${appointment._id}:`, e.message);
  }
};