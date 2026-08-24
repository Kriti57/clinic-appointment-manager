import { useEffect, useState } from "react";
import api from "../api/axios";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "", specialisation: "", slotDurationMinutes: 30, bio: "",
  });
  const [workingHours, setWorkingHours] = useState([{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }]);
  const [message, setMessage] = useState("");
  const [leaveForm, setLeaveForm] = useState({});

  const loadDoctors = async () => {
    const { data } = await api.get("/doctors");
    setDoctors(data.doctors);
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const updateHour = (i, field, value) => {
    const updated = [...workingHours];
    updated[i][field] = field === "dayOfWeek" ? Number(value) : value;
    setWorkingHours(updated);
  };
  const addHourRow = () => setWorkingHours([...workingHours, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }]);

  const createDoctor = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      await api.post("/doctors", { ...form, workingHours });
      setMessage(`Doctor ${form.name} created.`);
      setForm({ name: "", email: "", password: "", phone: "", specialisation: "", slotDurationMinutes: 30, bio: "" });
      setWorkingHours([{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }]);
      loadDoctors();
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to create doctor.");
    }
  };

  const markLeave = async (doctorId) => {
    const entry = leaveForm[doctorId];
    if (!entry?.date) return;
    await api.post(`/doctors/${doctorId}/leave`, entry);
    setLeaveForm({ ...leaveForm, [doctorId]: { date: "", reason: "" } });
    loadDoctors();
    alert("Leave day added. Any affected patients have been notified.");
  };

  return (
    <div className="container">
      <h1>Admin Dashboard</h1>

      <div className="card">
        <h2>Add a doctor</h2>
        <form onSubmit={createDoctor}>
          <div className="grid-2">
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Temporary password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Specialisation</label>
              <input value={form.specialisation} onChange={(e) => setForm({ ...form, specialisation: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Slot duration (minutes)</label>
              <input type="number" value={form.slotDurationMinutes} onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })} />
            </div>
          </div>

          <label>Working hours</label>
          {workingHours.map((wh, i) => (
            <div key={i} className="grid-2" style={{ marginBottom: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <select value={wh.dayOfWeek} onChange={(e) => updateHour(i, "dayOfWeek", e.target.value)}>
                {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
              </select>
              <input type="time" value={wh.startTime} onChange={(e) => updateHour(i, "startTime", e.target.value)} />
              <input type="time" value={wh.endTime} onChange={(e) => updateHour(i, "endTime", e.target.value)} />
            </div>
          ))}
          <button type="button" className="btn secondary" onClick={addHourRow}>+ Add day</button>

          <div style={{ marginTop: 14 }}>
            <button className="btn">Create doctor</button>
          </div>
        </form>
        {message && <p className="muted">{message}</p>}
      </div>

      <div className="card">
        <h2>Existing doctors</h2>
        {doctors.map((doc) => (
          <div key={doc._id} className="card" style={{ background: "#fafbfc" }}>
            <h3>Dr. {doc.user?.name} — {doc.specialisation}</h3>
            <p className="muted">{doc.slotDurationMinutes} min slots · {doc.leaveDays?.length || 0} leave day(s) on record</p>
            <div className="grid-2" style={{ maxWidth: 500 }}>
              <input
                type="date"
                value={leaveForm[doc._id]?.date || ""}
                onChange={(e) => setLeaveForm({ ...leaveForm, [doc._id]: { ...leaveForm[doc._id], date: e.target.value } })}
              />
              <input
                placeholder="Reason (optional)"
                value={leaveForm[doc._id]?.reason || ""}
                onChange={(e) => setLeaveForm({ ...leaveForm, [doc._id]: { ...leaveForm[doc._id], reason: e.target.value } })}
              />
            </div>
            <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => markLeave(doc._id)}>
              Mark as on leave
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
