import nodemailer from "nodemailer";

const getTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

const sendMail = async (to, subject, html) => {
  await getTransporter().sendMail({
    from: `"Clinic Appointments" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

export const sendBookingEmail = async (recipient, appointment, patientUser, doctorUser) => {
  if (recipient === "patient") {
    return sendMail(
      patientUser.email,
      "Appointment Confirmed",
      `<p>Hi ${patientUser.name},</p>
     <p>Your appointment with Dr. ${doctorUser.name} is confirmed for <b>${appointment.date} at ${appointment.slotTime}</b>.</p>
     <p>You'll receive a reminder closer to the date.</p>`
    );
  }
  return sendMail(
    doctorUser.email,
    "New Appointment Booked",
    `<p>Hi Dr. ${doctorUser.name},</p>
     <p>A new appointment has been booked by ${patientUser.name} on <b>${appointment.date} at ${appointment.slotTime}</b>.</p>
     <p>A pre-visit AI symptom summary will be attached to the appointment before the visit.</p>`
  );
};

export const sendCancellationEmail = async (appointment) => {
  await appointment.populate("patient");
  await sendMail(
    appointment.patient.email,
    "Appointment Cancelled",
    `<p>Hi ${appointment.patient.name},</p>
     <p>Your appointment on <b>${appointment.date} at ${appointment.slotTime}</b> has been cancelled.</p>
     <p>Reason: ${appointment.cancelReason || "Not specified"}</p>
     <p>Please book a new slot at your convenience.</p>`
  );
};

export const sendMedicationReminderEmail = async (patientUser, medicineName, dosage) => {
  await sendMail(
    patientUser.email,
    "Medication Reminder",
    `<p>Hi ${patientUser.name},</p>
     <p>Reminder to take your medication: <b>${medicineName}</b> (${dosage}).</p>`
  );
};

export const sendPostVisitEmail = async (appointment, patientUser) => {
  await sendMail(
    patientUser.email,
    "Your Visit Summary",
    `<p>Hi ${patientUser.name},</p>
     <p>Here is a summary of your recent visit:</p>
     <p>${appointment.postVisitSummary.text.replace(/\n/g, "<br/>")}</p>`
  );
};