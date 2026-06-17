import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

const BRAND_BLUE = "#0b3ea8";

export default function DownloadApp() {
  const navigate = useNavigate();
  const { company, employeeName } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: TradeFlow brand */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ backgroundColor: BRAND_BLUE }}
            >
              TF
            </div>
            <span className="font-black text-gray-800 text-sm">TradeFlow</span>
          </div>

          {/* Right: Company logo + employee name */}
          <div className="flex flex-col items-end gap-0.5">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <span className="font-bold text-gray-700 text-sm">{company?.name ?? ""}</span>
            )}
            {employeeName && (
              <span className="text-xs text-gray-500">{employeeName}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-left mb-6">
            <h2 className="text-base font-black text-gray-900 mb-2">📱 Use the Mobile App</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Field employees clock in and out using the <strong>TradeFlow mobile app</strong>.
              This web portal is for administrators only.
            </p>

            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              Sign in to the app using:<br />
              <strong>Your email</strong> + the password you created
            </p>

            <div className="space-y-3">
              <a
                href="#"
                className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-black text-white rounded-xl font-semibold text-sm opacity-60 cursor-not-allowed"
                onClick={(e) => { e.preventDefault(); toast("App Store link coming soon!"); }}
              >
                <span className="text-xl">🍎</span>
                Download on the App Store
              </a>
              <a
                href="#"
                className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-green-700 text-white rounded-xl font-semibold text-sm opacity-60 cursor-not-allowed"
                onClick={(e) => { e.preventDefault(); toast("Google Play link coming soon!"); }}
              >
                <span className="text-xl">🤖</span>
                Get it on Google Play
              </a>
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">
              App store links will be available soon.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Sign out
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Questions?{" "}
            <a href="mailto:info@tradeflowllc.com" className="text-blue-600 hover:underline">
              info@tradeflowllc.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
