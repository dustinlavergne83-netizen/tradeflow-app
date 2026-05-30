import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

export default function SetPassword() {
  const navigate = useNavigate();
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [ready,     setReady]     = useState(false);
  const [checking,  setChecking]  = useState(true);
  const [done,      setDone]      = useState(false); // show post-set screen
  const [isAdmin,   setIsAdmin]   = useState(false); // role after password set

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && session) {
        setReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Look up the employee's role to decide where to send them
    const { data: { user } } = await supabase.auth.getUser();
    let role = "employee";
    if (user) {
      const { data: emp } = await supabase
        .from("employees")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      role = emp?.role ?? "employee";
    }

    setLoading(false);

    if (role === "admin" || role === "super_admin") {
      toast.success("Password set! Welcome to TradeFlow 🎉");
      navigate("/dashboard");
    } else {
      // Regular employee — don't give them the admin dashboard
      setIsAdmin(false);
      setDone(true);
    }
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Verifying your invite link…</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4"
            style={{ backgroundColor: "#0b3ea8" }}
          >
            TF
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-500 text-sm mb-6">
            This invite link has expired or already been used. Please ask your admin to send a new invite.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-3 rounded-xl font-bold text-white text-sm"
            style={{ backgroundColor: "#0b3ea8" }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Post-set screen for regular employees
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4"
            style={{ backgroundColor: "#0b3ea8" }}
          >
            TF
          </div>

          {/* Success badge */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 bg-green-100">
            ✅
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-2">You're all set!</h1>
          <p className="text-gray-500 text-sm mb-8">
            Your TradeFlow password has been created successfully.
          </p>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-left mb-6">
            <h2 className="text-base font-black text-gray-900 mb-2">📱 Download the TradeFlow App</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              As a field employee, you'll clock in and out using the <strong>TradeFlow mobile app</strong>.
              Use your email and the password you just created to sign in.
            </p>

            {/* Placeholder download buttons */}
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

          <p className="text-xs text-gray-400">
            Questions?{" "}
            <a href="mailto:info@tradeflowllc.com" className="text-blue-600 hover:underline">
              info@tradeflowllc.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Main set-password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4"
            style={{ backgroundColor: "#0b3ea8" }}
          >
            TF
          </div>
          <h1 className="text-2xl font-black text-gray-900">Welcome to TradeFlow!</h1>
          <p className="text-gray-500 text-sm mt-1">Set your password to get started</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-black text-white text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#fc6b04" }}
            >
              {loading ? "Setting password…" : "Set Password →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Need help?{" "}
          <a href="mailto:info@tradeflowllc.com" className="text-blue-600 hover:underline">
            info@tradeflowllc.com
          </a>
        </p>
      </div>
    </div>
  );
}
