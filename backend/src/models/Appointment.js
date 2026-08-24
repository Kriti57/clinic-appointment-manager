import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "DoctorProfile", required: true },

    date: { type: String, required: true }, // "YYYY-MM-DD"
    slotTime: { type: String, required: true }, // "09:30" - start time of the slot

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "leave_cancelled"],
      default: "confirmed",
    },

    // --- Pre-visit ---
    symptoms: { type: String, default: "" },
    preVisitSummary: {
      urgency: { type: String, enum: ["Low", "Medium", "High", null], default: null },
      chiefComplaint: { type: String, default: "" },
      suggestedQuestions: { type: [String], default: [] },
      generatedAt: { type: Date, default: null },
      failed: { type: Boolean, default: false }, // true if LLM call failed and we fell back
    },

    // --- Post-visit ---
    doctorNotes: { type: String, default: "" },
    prescription: [
      {
        medicineName: String,
        dosage: String,
        frequencyPerDay: Number, // used to schedule reminders
        durationDays: Number,
        instructions: String,
      },
    ],
    postVisitSummary: {
      text: { type: String, default: "" },
      generatedAt: { type: Date, default: null },
      failed: { type: Boolean, default: false },
    },

    // --- Calendar sync ---
    googleEventId: { type: String, default: null }, // patient's calendar event
    doctorGoogleEventId: { type: String, default: null }, // doctor's calendar event

    // --- Notification tracking (for retry logic) ---
    notifications: [
      {
        type: { type: String, enum: ["booking_confirmation", "reminder", "cancellation", "medication_reminder"] },
        recipient: { type: String, enum: ["patient", "doctor"] },
        status: { type: String, enum: ["sent", "failed", "pending"], default: "pending" },
        attempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, default: null },
      },
    ],

    cancelReason: { type: String, default: "" },
  },
  { timestamps: true }
);

// THE critical index: makes it physically impossible for two confirmed appointments
// to exist for the same doctor+date+slot at the database level, regardless of
// application-level race conditions. Partial filter so cancelled slots free up.
appointmentSchema.index(
  { doctor: 1, date: 1, slotTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "confirmed", "completed"] } },
  }
);

appointmentSchema.index({ patient: 1, date: 1 });

export default mongoose.model("Appointment", appointmentSchema);
