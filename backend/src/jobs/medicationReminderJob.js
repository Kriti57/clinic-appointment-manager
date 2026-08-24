import cron from "node-cron";
import Appointment from "../models/Appointment.js";
import { sendMedicationReminderEmail } from "../services/emailService.js";

// Runs every hour. For each completed appointment with an active prescription,
// checks whether "now" falls on a reminder slot based on frequencyPerDay, and
// sends a reminder if so. Simple even-spacing approach: frequency=2 -> ~12h apart, etc.
export const startMedicationReminderJob = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const activeAppointments = await Appointment.find({
        status: "completed",
        "prescription.0": { $exists: true },
      }).populate("patient");

      const now = new Date();
      const currentHour = now.getHours();

      for (const appt of activeAppointments) {
        const visitDate = new Date(appt.updatedAt);
        const daysSinceVisit = Math.floor((now - visitDate) / (1000 * 60 * 60 * 24));

        for (const med of appt.prescription) {
          if (daysSinceVisit >= med.durationDays) continue; // course finished

          const intervalHours = Math.floor(24 / med.frequencyPerDay);
          const isReminderHour = currentHour % intervalHours === 0;

          if (isReminderHour) {
            try {
              await sendMedicationReminderEmail(appt.patient, med.medicineName, med.dosage);
            } catch (e) {
              console.error(`Medication reminder failed for appointment ${appt._id}:`, e.message);
            }
          }
        }
      }
    } catch (err) {
      console.error("Medication reminder job failed:", err.message);
    }
  });

  console.log("Medication reminder job scheduled (hourly).");
};
