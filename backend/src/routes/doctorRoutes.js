import { Router } from "express";
import {
  createDoctor,
  updateDoctor,
  addLeaveDay,
  listDoctors,
  getDoctorById,
  getDoctorSlots,
} from "../controllers/doctorController.js";
import { protect, restrictTo } from "../middleware/auth.js";
import {
  validateCreateDoctor,
  validateUpdateDoctor,
  validateLeaveDay,
  validateSlotsQuery,
  validateDoctorSearch,
  validateIdParam,
} from "../middleware/validate.js";

const router = Router();

router.get("/", validateDoctorSearch, listDoctors); // public search
router.get("/:id", validateIdParam, getDoctorById);
router.get("/:id/slots", validateSlotsQuery, getDoctorSlots);

router.post("/", protect, restrictTo("admin"), validateCreateDoctor, createDoctor);
router.put("/:id", protect, restrictTo("admin"), validateUpdateDoctor, updateDoctor);
router.post("/:id/leave", protect, restrictTo("admin"), validateLeaveDay, addLeaveDay);

export default router;