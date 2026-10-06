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
import {
  validateHoldSlot,
  validateBooking,
  validateVisitNotes,
  validateCancel,
  validateIdParam,
} from "../middleware/validate.js";

const router = Router();

router.use(protect); // every appointment route requires login

router.post("/hold", restrictTo("patient"), validateHoldSlot, holdSlot);
router.post("/", restrictTo("patient"), validateBooking, bookAppointment);
router.get("/", listMyAppointments);
router.get("/:id", validateIdParam, getAppointmentById);
router.put("/:id/notes", restrictTo("doctor"), validateVisitNotes, submitVisitNotes);
router.put("/:id/cancel", validateCancel, cancelAppointment);

export default router;