import logo from "../assets/logod.jpg";

export default function Header({ title, right }) {
  return (
    <header
      style={{
        padding: "12px 7px",
        background: "#f9fafb",
        color: "#f9fafb",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        minHeight: 72,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img
          src={logo}
          alt="Company Logo"
          style={{
            height: 80,
            width: "auto",
            objectFit: "contain",
            flexShrink: 0,
            marginTop: 18, 
          }}
        />
        {title && (
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>
            {title}
          </div>
        )}
      </div>

      {right && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            transform: "translateY(12px)",
            color: "#ffffff",
          }}
        >
          {right}
        </div>
      )}
    </header>
  );
}



