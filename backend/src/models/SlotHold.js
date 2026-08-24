import mongoose from "mongoose";

// A SlotHold is created the moment a patient picks a slot and starts filling
// the symptom form. It reserves the slot for a few minutes so a second patient
// browsing at the same time doesn't see it as free. MongoDB's TTL index deletes
// it automatically if the patient abandons the flow - no cron job needed.
const slotHoldSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "DoctorProfile", required: true },
  date: { type: String, required: true },
  slotTime: { type: String, required: true },
  heldBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // TTL: 5 minutes
});

slotHoldSchema.index({ doctor: 1, date: 1, slotTime: 1 }, { unique: true });

export default mongoose.model("SlotHold", slotHoldSchema);
