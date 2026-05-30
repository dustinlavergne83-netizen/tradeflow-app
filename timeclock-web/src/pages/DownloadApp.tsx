import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

export default function DownloadApp() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4"
          style={{ backgroundColor: "#0b3ea8" }}
        >
          TF
        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-2">TradeFlow</h1>
        <p className="text-gray-500 text-sm mb-8">Welcome! You're signed in as a field employee.</p>

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
  );
}
