import cron from "node-cron";
import Appointment from "../models/Appointment.js";
import { sendBookingConfirmationEmails, sendCancellationEmail } from "../services/emailService.js";
import DoctorProfile from "../models/DoctorProfile.js";

const MAX_ATTEMPTS = 3;

// Runs every 15 minutes. Finds notifications marked "failed" with fewer than
// MAX_ATTEMPTS tries, and retries them. Keeps notification delivery reliable
// without needing the original request to hang around waiting for retries.
export const startEmailRetryJob = () => {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const appointments = await Appointment.find({
        "notifications.status": "failed",
      }).populate("patient");

      for (const appt of appointments) {
        let changed = false;

        for (const notif of appt.notifications) {
          if (notif.status !== "failed" || notif.attempts >= MAX_ATTEMPTS) continue;

          try {
            if (notif.type === "booking_confirmation") {
              const doctorProfile = await DoctorProfile.findById(appt.doctor).populate("user");
              await sendBookingConfirmationEmails(appt, appt.patient, doctorProfile.user);
            } else if (notif.type === "cancellation") {
              await sendCancellationEmail(appt);
            }
            notif.status = "sent";
          } catch (e) {
            console.error(`Retry failed for notification on appointment ${appt._id}:`, e.message);
          }
          notif.attempts += 1;
          notif.lastAttemptAt = new Date();
          changed = true;
        }

        if (changed) await appt.save();
      }
    } catch (err) {
      console.error("Email retry job failed:", err.message);
    }
  });

  console.log("Email retry job scheduled (every 15 min).");
};
