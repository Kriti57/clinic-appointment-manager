import cron from "node-cron";
import Appointment from "../models/Appointment.js";
import DoctorProfile from "../models/DoctorProfile.js";
import { sendBookingEmail, sendCancellationEmail } from "../services/emailService.js";

const MAX_ATTEMPTS = 3;

// Runs every 15 minutes. Finds notifications marked "failed" with fewer than
// MAX_ATTEMPTS tries and retries exactly that one (type + recipient), so nobody
// receives a duplicate. Keeps delivery reliable without the original request waiting.
export const startEmailRetryJob = () => {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const appointments = await Appointment.find({
        notifications: { $elemMatch: { status: "failed", attempts: { $lt: MAX_ATTEMPTS } } },
      }).populate("patient");

      for (const appt of appointments) {
        for (const notif of appt.notifications) {
          if (notif.status !== "failed" || notif.attempts >= MAX_ATTEMPTS) continue;

          try {
            if (notif.type === "booking_confirmation") {
              const doctorProfile = await DoctorProfile.findById(appt.doctor).populate("user");
              await sendBookingEmail(notif.recipient, appt, appt.patient, doctorProfile.user);
            } else if (notif.type === "cancellation") {
              await sendCancellationEmail(appt);
            }
            notif.status = "sent";
          } catch (e) {
            console.error(`Retry failed (${notif.type} -> ${notif.recipient}) for appointment ${appt._id}:`, e.message);
          }
          notif.attempts += 1;
          notif.lastAttemptAt = new Date();
        }

        await appt.save();
      }
    } catch (err) {
      console.error("Email retry job failed:", err.message);
    }
  });

  console.log("Email retry job scheduled (every 15 min).");
};