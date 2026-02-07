import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={{ display: "flex", gap: 16, padding: 16 }}>
      <NavLink to="/">Home</NavLink>
      <NavLink to="/project/new">New Project</NavLink>
      <NavLink to="/estimate">Estimate</NavLink>
      <NavLink to="/customers">Customers</NavLink>
      <NavLink to="/timeclock">Time Clock</NavLink>
    </nav>
  );
}


const linkStyle = {
  marginRight: "1rem",
  color: "#61dafb",
  textDecoration: "none",
};

