import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="container">
      <div className="card">
        <h1>Healthcare Appointment & Follow-up Manager</h1>
        <p className="muted">
          Book appointments, share symptoms in advance, and get AI-assisted pre-visit and
          post-visit summaries, with email and calendar sync.
        </p>
        {!user && (
          <p>
            <Link to="/register" className="btn" style={{ textDecoration: "none", display: "inline-block" }}>
              Get started as a patient
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
