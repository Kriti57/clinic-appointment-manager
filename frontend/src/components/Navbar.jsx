import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">Clinic Appointments</Link>
      <div>
        {!user && <Link to="/login">Login</Link>}
        {!user && <Link to="/register">Register</Link>}
        {user && user.role === "patient" && <Link to="/patient">Dashboard</Link>}
        {user && user.role === "doctor" && <Link to="/doctor">Dashboard</Link>}
        {user && user.role === "admin" && <Link to="/admin">Dashboard</Link>}
        {user && <button onClick={handleLogout}>Logout ({user.name})</button>}
      </div>
    </nav>
  );
}
