import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["patient", "doctor", "admin"], required: true, default: "patient" },
    phone: { type: String, trim: true },

    // Incremented to invalidate all previously issued JWTs for this user
    tokenVersion: { type: Number, default: 0 },

    // Google Calendar OAuth tokens (per-user, so each person's calendar is their own)
    googleTokens: {
      accessToken: { type: String, default: null },
      refreshToken: { type: String, default: null },
      expiryDate: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never send password hash back in API responses
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.googleTokens;
    delete ret.tokenVersion;
    return ret;
  },
});

export default mongoose.model("User", userSchema);