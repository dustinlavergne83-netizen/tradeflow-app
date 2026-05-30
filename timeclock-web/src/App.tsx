import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Timesheets from "./pages/Timesheets";
import Employees from "./pages/Employees";
import Jobs from "./pages/Jobs";
import Reports from "./pages/Reports";
import AIChat from "./pages/AIChat";
import GPS from "./pages/GPS";
import DeleteAccount from "./pages/DeleteAccount";
import SetPassword from "./pages/SetPassword";
import DownloadApp from "./pages/DownloadApp";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, employeeRole } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Loading TradeFlow…</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  // Regular field employees don't have access to the admin web portal
  if (employeeRole === "employee") return <Navigate to="/download-app" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/set-password"   element={<SetPassword />} />
      <Route path="/download-app"   element={<DownloadApp />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="employees"  element={<Employees />} />
        <Route path="jobs"       element={<Jobs />} />
        <Route path="reports"    element={<Reports />} />
        <Route path="ai"         element={<AIChat />} />
        <Route path="gps"        element={<GPS />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
