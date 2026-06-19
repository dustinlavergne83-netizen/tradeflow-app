/**
 * PayrollHub — Central payroll dashboard
 * Click any card to go to that payroll function.
 */
import { useNavigate } from "react-router-dom";

const cards = [
  {
    icon: "👤",
    title: "Employees",
    desc: "Manage employee profiles, roles, pay rates, and contact info.",
    path: "/employees",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.35)",
  },
  {
    icon: "🕐",
    title: "Time Clock",
    desc: "View timesheets, clock-in/out history, weekly totals, and overtime.",
    path: "/timeclock",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.35)",
  },
  {
    icon: "💰",
    title: "Payroll Approval",
    desc: "Review AI-extracted wages, taxes, and garnishments from check stubs. Approve to post to Expenses.",
    path: "/payroll-approval",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
  },
  {
    icon: "📤",
    title: "Upload Pay Stubs",
    desc: "Drag-and-drop PDFs from SmartVault or set up automatic delivery via Make / Zapier.",
    path: "/payroll-upload",
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.35)",
  },
  {
    icon: "📋",
    title: "Check Stubs",
    desc: "Browse the archive of processed pay stubs for each employee.",
    path: "/check-stubs",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.35)",
  },
  {
    icon: "📅",
    title: "Time Off Requests",
    desc: "Review and approve employee PTO, sick leave, and time-off requests.",
    path: "/time-off",
    color: "#ec4899",
    bg: "rgba(236,72,153,0.12)",
    border: "rgba(236,72,153,0.35)",
  },
];

export default function PayrollHub() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "28px 28px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ color: "#f97316", fontSize: 30, fontWeight: 900, marginBottom: 6 }}>
        💼 Payroll
      </h1>
      <p style={{ color: "#94a3b8", fontSize: 15, marginBottom: 32 }}>
        Manage employees, time, and payroll — all in one place.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 20,
      }}>
        {cards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            style={{
              backgroundColor: card.bg,
              border: `2px solid ${card.border}`,
              borderRadius: 16,
              padding: "28px 24px",
              textAlign: "left",
              cursor: "pointer",
              transition: "transform 0.15s, box-shadow 0.15s",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = `0 8px 24px ${card.border}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 14 }}>{card.icon}</div>
            <div style={{ color: card.color, fontSize: 19, fontWeight: 800, marginBottom: 8 }}>
              {card.title}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
              {card.desc}
            </div>
            <div style={{ color: card.color, fontSize: 13, fontWeight: 700, marginTop: 16 }}>
              Open →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
