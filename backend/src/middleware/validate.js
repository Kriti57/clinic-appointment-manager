import { body, param, query, validationResult } from "express-validator";

// Runs after a rule chain: if any rule failed, stop with a 400 and a readable message.
export const handleValidation = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return res.status(400).json({ message: errors[0].message, errors });
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Real calendar date, not just the right shape ("2026-02-31" must fail)
const isRealDate = (value) => {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

// .isString() first on every field: rejects objects/arrays like {"$ne": null}
const email = body("email").isString().withMessage("Email must be text.").trim().toLowerCase().isEmail().withMessage("Enter a valid email address.");

export const validateRegister = [
  body("name").isString().withMessage("Name must be text.").trim().isLength({ min: 2, max: 60 }).withMessage("Name must be 2-60 characters."),
  email,
  // bcrypt only uses the first 72 bytes, so cap there
  body("password").isString().withMessage("Password must be text.").isLength({ min: 8, max: 72 }).withMessage("Password must be 8-72 characters."),
  body("phone").optional({ values: "falsy" }).isString().trim().matches(/^[0-9+\-\s()]{7,15}$/).withMessage("Enter a valid phone number."),
  handleValidation,
];

export const validateLogin = [
  email,
  body("password").isString().withMessage("Password must be text.").notEmpty().withMessage("Password is required."),
  handleValidation,
];

export const validateIdParam = [param("id").isMongoId().withMessage("Invalid ID."), handleValidation];

const slotFields = [
  body("doctorId").isMongoId().withMessage("Invalid doctor."),
  body("date").custom(isRealDate).withMessage("Date must be a real date in YYYY-MM-DD format."),
  body("slotTime").matches(TIME_RE).withMessage("Slot time must be HH:MM (24-hour)."),
];

export const validateHoldSlot = [...slotFields, handleValidation];

export const validateBooking = [
  ...slotFields,
  body("symptoms").isString().withMessage("Symptoms must be text.").trim().isLength({ min: 1, max: 1000 }).withMessage("Describe your symptoms (up to 1000 characters)."),
  body("holdId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid hold."),
  handleValidation,
];

export const validateVisitNotes = [
  param("id").isMongoId().withMessage("Invalid ID."),
  body("doctorNotes").isString().withMessage("Doctor notes must be text.").trim().isLength({ min: 1, max: 5000 }).withMessage("Doctor notes are required (up to 5000 characters)."),
  body("prescription").optional().isArray({ max: 30 }).withMessage("Prescription must be a list."),
  handleValidation,
];

export const validateCancel = [
  param("id").isMongoId().withMessage("Invalid ID."),
  body("reason").optional({ values: "falsy" }).isString().trim().isLength({ max: 300 }).withMessage("Reason must be under 300 characters."),
  handleValidation,
];

// ---------- Doctor routes ----------
const workingHoursRules = [
  body("workingHours").optional().isArray({ max: 14 }).withMessage("Working hours must be a list."),
  body("workingHours.*.dayOfWeek").isInt({ min: 0, max: 6 }).withMessage("dayOfWeek must be 0 (Sunday) to 6 (Saturday)."),
  body("workingHours.*.startTime").matches(TIME_RE).withMessage("Start time must be HH:MM."),
  body("workingHours.*.endTime")
    .matches(TIME_RE)
    .withMessage("End time must be HH:MM.")
    .custom((end, { req, path }) => {
      const i = path.match(/\[(\d+)\]/)[1];
      return end > req.body.workingHours[i].startTime;
    })
    .withMessage("End time must be after start time."),
];

// On create, specialisation is required; on update every field is optional (partial edits).
const doctorProfileRules = (requireSpecialisation) => [
  (requireSpecialisation ? body("specialisation") : body("specialisation").optional())
    .isString().withMessage("Specialisation must be text.").trim().isLength({ min: 2, max: 60 }).withMessage("Specialisation must be 2-60 characters."),
  body("slotDurationMinutes").optional().isInt({ min: 5, max: 240 }).withMessage("Slot duration must be 5-240 minutes."),
  body("bio").optional().isString().withMessage("Bio must be text.").isLength({ max: 1000 }).withMessage("Bio must be under 1000 characters."),
  ...workingHoursRules,
];

export const validateCreateDoctor = [
  body("name").isString().withMessage("Name must be text.").trim().isLength({ min: 2, max: 60 }).withMessage("Name must be 2-60 characters."),
  email,
  body("password").isString().withMessage("Password must be text.").isLength({ min: 8, max: 72 }).withMessage("Password must be 8-72 characters."),
  body("phone").optional({ values: "falsy" }).isString().trim().matches(/^[0-9+\-\s()]{7,15}$/).withMessage("Enter a valid phone number."),
  ...doctorProfileRules(true),
  handleValidation,
];

export const validateUpdateDoctor = [param("id").isMongoId().withMessage("Invalid ID."), ...doctorProfileRules(false), handleValidation];

export const validateLeaveDay = [
  param("id").isMongoId().withMessage("Invalid ID."),
  body("date").custom(isRealDate).withMessage("Date must be a real date in YYYY-MM-DD format."),
  body("reason").optional({ values: "falsy" }).isString().trim().isLength({ max: 200 }).withMessage("Reason must be under 200 characters."),
  handleValidation,
];

export const validateSlotsQuery = [
  param("id").isMongoId().withMessage("Invalid ID."),
  query("date").custom(isRealDate).withMessage("date query param must be a real date in YYYY-MM-DD format."),
  handleValidation,
];

export const validateDoctorSearch = [
  query("specialisation").optional().isString().withMessage("Specialisation must be text.").trim().isLength({ max: 60 }).withMessage("Search text is too long."),
  handleValidation,
];