import mongoose from "mongoose";

const workingHourSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday ... 6 = Saturday
    startTime: { type: String, required: true }, // "09:00"
    endTime: { type: String, required: true }, // "17:00"
  },
  { _id: false }
);

const doctorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    specialisation: { type: String, required: true, trim: true },
    slotDurationMinutes: { type: Number, required: true, default: 30 },
    workingHours: { type: [workingHourSchema], default: [] },

    // Specific dates the doctor is unavailable (holidays, leave)
    leaveDays: [
      {
        date: { type: String, required: true }, // "YYYY-MM-DD"
        reason: { type: String, default: "" },
      },
    ],

    bio: { type: String, default: "" },
  },
  { timestamps: true }
);

doctorProfileSchema.index({ specialisation: 1 });

export default mongoose.model("DoctorProfile", doctorProfileSchema);
