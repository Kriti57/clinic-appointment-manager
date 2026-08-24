import { useEffect, useState } from "react";
import api from "../api/axios";

export default function PatientDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [specialisation, setSpecialisation] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [holdId, setHoldId] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState("");
  const [booking, setBooking] = useState(false);

  const loadDoctors = async () => {
    const { data } = await api.get("/doctors", { params: specialisation ? { specialisation } : {} });
    setDoctors(data.doctors);
  };

  const loadAppointments = async () => {
    const { data } = await api.get("/appointments");
    setAppointments(data.appointments);
  };

  useEffect(() => {
    loadDoctors();
    loadAppointments();
  }, []);

  const loadSlots = async (doctor, selectedDate) => {
    setSelectedDoctor(doctor);
    setDate(selectedDate);
    setSelectedSlot(null);
    setHoldId(null);
    if (!selectedDate) return setSlots([]);
    const { data } = await api.get(`/doctors/${doctor._id}/slots`, { params: { date: selectedDate } });
    setSlots(data.slots);
  };

  const pickSlot = async (slot) => {
    setMessage("");
    try {
      const { data } = await api.post("/appointments/hold", {
        doctorId: selectedDoctor._id,
        date,
        slotTime: slot,
      });
      setSelectedSlot(slot);
      setHoldId(data.holdId);
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not hold slot.");
      loadSlots(selectedDoctor, date); // refresh in case it was taken
    }
  };

  const confirmBooking = async (e) => {
    e.preventDefault();
    setBooking(true);
    setMessage("");
    try {
      await api.post("/appointments", {
        doctorId: selectedDoctor._id,
        date,
        slotTime: selectedSlot,
        symptoms,
        holdId,
      });
      setMessage("Appointment booked! Confirmation emails have been sent.");
      setSelectedDoctor(null);
      setSelectedSlot(null);
      setSymptoms("");
      loadAppointments();
    } catch (err) {
      setMessage(err.response?.data?.message || "Booking failed.");
    } finally {
      setBooking(false);
    }
  };

  const cancelAppointment = async (id) => {
    if (!confirm("Cancel this appointment?")) return;
    await api.put(`/appointments/${id}/cancel`, { reason: "Cancelled by patient" });
    loadAppointments();
  };

  return (
    <div className="container">
      <h1>Patient Dashboard</h1>

      <div className="card">
        <h2>Find a doctor</h2>
        <div className="form-group">
          <label>Search by specialisation</label>
          <input
            value={specialisation}
            onChange={(e) => setSpecialisation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadDoctors()}
            placeholder="e.g. Cardiology"
          />
        </div>
        <button className="btn" onClick={loadDoctors}>Search</button>

        <div style={{ marginTop: 16 }}>
          {doctors.map((doc) => (
            <div key={doc._id} className="card" style={{ background: "#fafbfc" }}>
              <h3>Dr. {doc.user?.name}</h3>
              <p className="muted">{doc.specialisation} · {doc.slotDurationMinutes} min slots</p>
              <div className="form-group" style={{ maxWidth: 220 }}>
                <label>Choose a date</label>
                <input
                  type="date"
                  onChange={(e) => loadSlots(doc, e.target.value)}
                />
              </div>
              {selectedDoctor?._id === doc._id && date && (
                <div className="slot-grid">
                  {slots.length === 0 && <p className="muted">No slots available this date.</p>}
                  {slots.map((s) => (
                    <button
                      key={s}
                      className={`slot-btn ${selectedSlot === s ? "selected" : ""}`}
                      onClick={() => pickSlot(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {selectedDoctor?._id === doc._id && selectedSlot && (
                <form onSubmit={confirmBooking} style={{ marginTop: 14 }}>
                  <div className="form-group">
                    <label>Describe your symptoms</label>
                    <textarea
                      rows={3}
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      placeholder="e.g. Persistent cough for 5 days, mild fever..."
                      required
                    />
                  </div>
                  <button className="btn" disabled={booking}>
                    {booking ? "Booking..." : `Confirm ${date} at ${selectedSlot}`}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
        {message && <p className="muted">{message}</p>}
      </div>

      <div className="card">
        <h2>My Appointments</h2>
        {appointments.length === 0 && <p className="muted">No appointments yet.</p>}
        {appointments.map((appt) => (
          <div key={appt._id} className="card" style={{ background: "#fafbfc" }}>
            <p>
              <b>Dr. {appt.doctor?.user?.name}</b> ({appt.doctor?.specialisation}) —{" "}
              {appt.date} at {appt.slotTime}{" "}
              <span className="badge status">{appt.status}</span>
              {appt.preVisitSummary?.urgency && (
                <span className={`badge ${appt.preVisitSummary.urgency}`} style={{ marginLeft: 6 }}>
                  {appt.preVisitSummary.urgency} urgency
                </span>
              )}
            </p>
            {appt.postVisitSummary?.text && (
              <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                <b>Visit summary:</b>
                <p className="muted">{appt.postVisitSummary.text}</p>
              </div>
            )}
            {["pending", "confirmed"].includes(appt.status) && (
              <button className="btn danger" onClick={() => cancelAppointment(appt._id)}>Cancel</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
