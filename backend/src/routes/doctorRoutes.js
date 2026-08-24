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

const router = Router();

router.get("/", listDoctors); // public search
router.get("/:id", getDoctorById);
router.get("/:id/slots", getDoctorSlots);

router.post("/", protect, restrictTo("admin"), createDoctor);
router.put("/:id", protect, restrictTo("admin"), updateDoctor);
router.post("/:id/leave", protect, restrictTo("admin"), addLeaveDay);

export default router;
