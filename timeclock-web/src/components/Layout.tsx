import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const BRAND_BLUE   = "#0b3ea8";
const BRAND_ORANGE = "#fc6b04";

const navItems = [
  { to: "/dashboard",  icon: "📊", label: "Dashboard" },
  { to: "/timesheets", icon: "⏰", label: "Timesheets" },
  { to: "/employees",  icon: "👷", label: "Employees" },
  { to: "/jobs",       icon: "📋", label: "Jobs" },
  { to: "/reports",    icon: "📈", label: "Reports" },
  { to: "/gps",        icon: "📍", label: "GPS" },
];

export default function Layout() {
  const { company, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-blue-700">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
            style={{ backgroundColor: BRAND_ORANGE }}
          >
            TF
          </div>
          <div>
            <p className="text-white font-black text-sm leading-none">TradeFlow</p>
            <p className="text-blue-300 text-xs mt-0.5 leading-none">Admin Dashboard</p>
          </div>
        </div>
        {company && (
          <p className="text-blue-200 text-xs mt-3 font-medium truncate">{company.name}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-white text-blue-800"
                  : "text-blue-100 hover:bg-blue-700"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {/* AI Chat */}
        <NavLink
          to="/ai"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              isActive
                ? "bg-white text-purple-800"
                : "text-blue-100 hover:bg-blue-700"
            }`
          }
        >
          <span className="text-base">🤖</span>
          AI Assistant
        </NavLink>
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-blue-700 space-y-2">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-blue-200 hover:bg-blue-700 transition-colors"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-56 flex-shrink-0 flex-col"
        style={{ backgroundColor: BRAND_BLUE }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute left-0 top-0 h-full w-56 flex flex-col z-50"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <span className="text-xl">☰</span>
          </button>
          <span className="font-black text-gray-900">TradeFlow</span>
          {company && <span className="text-sm text-gray-500 truncate">{company.name}</span>}
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
