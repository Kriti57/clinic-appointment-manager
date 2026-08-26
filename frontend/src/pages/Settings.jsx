import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";

export default function Settings() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const status = searchParams.get("calendarConnected");
    if (status === "true") setMessage("Google Calendar connected successfully!");
    if (status === "false") setMessage("Google Calendar connection failed. Please try again.");
  }, [searchParams]);

  const connectCalendar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/auth/google/connect");
      window.location.href = data.url;
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not start Google connection.");
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card">
        <h2>Settings</h2>
        <h3>Google Calendar</h3>
        <p className="muted">
          Connect your Google Calendar so appointment events are automatically created,
          updated, and removed when you book, reschedule, or cancel.
        </p>
        <button className="btn" onClick={connectCalendar} disabled={loading}>
          {loading ? "Redirecting..." : "Connect Google Calendar"}
        </button>
        {message && <p className="muted" style={{ marginTop: 12 }}>{message}</p>}
      </div>
    </div>
  );
}