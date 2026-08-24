import { useEffect, useState } from "react";
import api from "../api/axios";

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [openNotesId, setOpenNotesId] = useState(null);
  const [notes, setNotes] = useState("");
  const [prescription, setPrescription] = useState([
    { medicineName: "", dosage: "", frequencyPerDay: 1, durationDays: 5, instructions: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const loadAppointments = async () => {
    const { data } = await api.get("/appointments");
    setAppointments(data.appointments);
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const updateMed = (index, field, value) => {
    const updated = [...prescription];
    updated[index][field] = value;
    setPrescription(updated);
  };

  const addMed = () =>
    setPrescription([...prescription, { medicineName: "", dosage: "", frequencyPerDay: 1, durationDays: 5, instructions: "" }]);

  const submitNotes = async (id) => {
    setSaving(true);
    try {
      await api.put(`/appointments/${id}/notes`, { doctorNotes: notes, prescription });
      setOpenNotesId(null);
      setNotes("");
      setPrescription([{ medicineName: "", dosage: "", frequencyPerDay: 1, durationDays: 5, instructions: "" }]);
      loadAppointments();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container">
      <h1>Doctor Dashboard</h1>
      {appointments.length === 0 && <p className="muted">No appointments yet.</p>}

      {appointments.map((appt) => (
        <div key={appt._id} className="card">
          <p>
            <b>{appt.patient?.name}</b> — {appt.date} at {appt.slotTime}{" "}
            <span className="badge status">{appt.status}</span>
          </p>

          {appt.preVisitSummary?.chiefComplaint && (
            <div className="card" style={{ background: "#fafbfc" }}>
              <p>
                <b>AI Pre-Visit Summary</b>{" "}
                <span className={`badge ${appt.preVisitSummary.urgency}`}>{appt.preVisitSummary.urgency} urgency</span>
                {appt.preVisitSummary.failed && <span className="muted"> (AI summary unavailable - fallback shown)</span>}
              </p>
              <p><b>Chief complaint:</b> {appt.preVisitSummary.chiefComplaint}</p>
              <p><b>Raw symptoms:</b> {appt.symptoms}</p>
              <p><b>Suggested questions:</b></p>
              <ul>
                {appt.preVisitSummary.suggestedQuestions?.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}

          {appt.status !== "completed" && appt.status !== "cancelled" && (
            <>
              {openNotesId !== appt._id ? (
                <button className="btn" onClick={() => setOpenNotesId(appt._id)}>Add post-visit notes</button>
              ) : (
                <div className="card" style={{ background: "#fafbfc" }}>
                  <div className="form-group">
                    <label>Clinical notes</label>
                    <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <label>Prescription</label>
                  {prescription.map((med, i) => (
                    <div key={i} className="grid-2" style={{ marginBottom: 8 }}>
                      <input placeholder="Medicine name" value={med.medicineName} onChange={(e) => updateMed(i, "medicineName", e.target.value)} />
                      <input placeholder="Dosage (e.g. 500mg)" value={med.dosage} onChange={(e) => updateMed(i, "dosage", e.target.value)} />
                      <input type="number" placeholder="Times per day" value={med.frequencyPerDay} onChange={(e) => updateMed(i, "frequencyPerDay", Number(e.target.value))} />
                      <input type="number" placeholder="Duration (days)" value={med.durationDays} onChange={(e) => updateMed(i, "durationDays", Number(e.target.value))} />
                      <input placeholder="Instructions" value={med.instructions} onChange={(e) => updateMed(i, "instructions", e.target.value)} style={{ gridColumn: "span 2" }} />
                    </div>
                  ))}
                  <button className="btn secondary" onClick={addMed} type="button">+ Add medicine</button>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn" disabled={saving} onClick={() => submitNotes(appt._id)}>
                      {saving ? "Generating summary..." : "Save & Generate Patient Summary"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {appt.postVisitSummary?.text && (
            <div style={{ marginTop: 8 }}>
              <b>Patient-facing summary (sent):</b>
              <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{appt.postVisitSummary.text}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
