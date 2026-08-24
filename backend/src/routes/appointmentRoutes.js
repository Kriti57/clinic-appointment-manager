import { Router } from "express";
import {
  holdSlot,
  bookAppointment,
  submitVisitNotes,
  cancelAppointment,
  listMyAppointments,
  getAppointmentById,
} from "../controllers/appointmentController.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = Router();

router.use(protect); // every appointment route requires login

router.post("/hold", restrictTo("patient"), holdSlot);
router.post("/", restrictTo("patient"), bookAppointment);
router.get("/", listMyAppointments);
router.get("/:id", getAppointmentById);
router.put("/:id/notes", restrictTo("doctor"), submitVisitNotes);
router.put("/:id/cancel", cancelAppointment);

export default router;
