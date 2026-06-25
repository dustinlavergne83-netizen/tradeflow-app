import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// ─── Brand / palette ─────────────────────────────────────────────────────────
const BRAND_BLUE = "#0b3ea8";
const BRAND_ORANGE = "#fc6b04";

function formatTime(dateStr) {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(minutes) {
  if (!minutes || minutes < 0) return "0:00";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function getLiveMinutes(startAt) {
  if (!startAt) return 0;
  return (Date.now() - new Date(startAt).getTime()) / 60000;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PortalClock() {
  const { slug } = useParams();

  // ── Company & Auth ──────────────────────────────────────────────────────────
  const [company, setCompany] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [checking, setChecking] = useState(true);

  // ── Invite token ─────────────────────────────────────────────────────────────
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [inviteEmployee, setInviteEmployee] = useState(null); // the pending employee record
  const [inviteNotFound, setInviteNotFound] = useState(false);
  const [inviteSetup, setInviteSetup] = useState({ password: "", confirmPassword: "" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteDone, setInviteDone] = useState(false);

  // ── Login ───────────────────────────────────────────────────────────────────
  const [loginMode, setLoginMode] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // ── Employee ────────────────────────────────────────────────────────────────
  const [employee, setEmployee] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [weeklySegments, setWeeklySegments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [ticker, setTicker] = useState(0); // force re-render for live timer
  const [gpsLoading, setGpsLoading] = useState(false);
  const [signoutLoading, setSignoutLoading] = useState(false);

  // ── Load company ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, logo_url, primary_color, slug")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();
      if (data) setCompany(data);
      else setNotFound(true);
      setChecking(false);
    })();
  }, [slug]);

  // ── Load invite token if present ─────────────────────────────────────────────
  useEffect(() => {
    if (!company || !inviteToken) return;
    (async () => {
      const { data: emp } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, role")
        .eq("invite_token", inviteToken)
        .eq("company_id", company.id)
        .is("user_id", null)
        .maybeSingle();
      if (emp) setInviteEmployee(emp);
      else setInviteNotFound(true);
    })();
  }, [company, inviteToken]);

  // ── Auto-login if session exists ─────────────────────────────────────────────
  useEffect(() => {
    if (!company || inviteToken) return; // don't auto-login if coming from an invite
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await loadEmployee(session.user.id);
    })();
  }, [company, inviteToken]);

  // ── Live timer tick ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeShift) return;
    const id = setInterval(() => setTicker(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [activeShift]);

  // ── Load employee data ────────────────────────────────────────────────────────
  const loadEmployee = useCallback(async (userId) => {
    const { data: emp } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, role")
      .eq("user_id", userId)
      .eq("company_id", company.id)
      .maybeSingle();

    if (!emp) { await supabase.auth.signOut(); return; }
    setEmployee(emp);
    setLoginMode(false);
    await Promise.all([
      loadActiveShift(emp.id),
      loadWeeklySegments(emp.id),
      loadJobs(),
    ]);
  }, [company]);

  async function loadActiveShift(empId) {
    const { data } = await supabase
      .from("shifts")
      .select("id, clock_in_at, project_id, projects(name)")
      .eq("employee_id", empId)
      .is("clock_out_at", null)
      .maybeSingle();
    setActiveShift(data || null);
    if (data?.project_id) setSelectedJob(data.project_id);
  }

  async function loadWeeklySegments(empId) {
    const weekStart = getMonday(new Date());
    const { data } = await supabase
      .from("shifts")
      .select("id, clock_in_at, clock_out_at, project_id, projects(name)")
      .eq("employee_id", empId)
      .gte("clock_in_at", weekStart + "T00:00:00")
      .order("clock_in_at", { ascending: false });
    setWeeklySegments(data || []);
  }

  async function loadJobs() {
    const { data } = await supabase
      .from("projects")
      .select("id, name, status")
      .eq("company_id", company.id)
      .in("status", ["active", "in_progress", "pending"])
      .order("name");
    setJobs(data || []);
  }

  // ── Sign In ───────────────────────────────────────────────────────────────────
  async function handleSignIn(e) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.toLowerCase().trim(),
        password: loginPassword,
      });
      if (error) { setLoginError("Invalid email or password."); setLoginLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      await loadEmployee(user.id);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Get GPS location ──────────────────────────────────────────────────────────
  function getGPS() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGpsLoading(false); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { setGpsLoading(false); resolve(null); },
        { timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  // ── Clock In ──────────────────────────────────────────────────────────────────
  async function handleClockIn() {
    if (!selectedJob) { setActionError("Please select a job first."); return; }
    setActionError(""); setActionSuccess(""); setActionLoading(true);
    try {
      const gps = await getGPS();
      const { error } = await supabase.from("shifts").insert({
        employee_id: employee.id,
        company_id: company.id,
        project_id: selectedJob,
        clock_in_at: new Date().toISOString(),
        gps_clock_in: gps ? `POINT(${gps.lng} ${gps.lat})` : null,
        gps_lat_in: gps?.lat || null,
        gps_lng_in: gps?.lng || null,
      });
      if (error) throw error;
      setActionSuccess("✅ Clocked in successfully!");
      await loadActiveShift(employee.id);
      await loadWeeklySegments(employee.id);
    } catch (err) {
      setActionError(err.message || "Failed to clock in.");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Clock Out ─────────────────────────────────────────────────────────────────
  async function handleClockOut() {
    if (!activeShift) return;
    setActionError(""); setActionSuccess(""); setActionLoading(true);
    try {
      const gps = await getGPS();
      const { error } = await supabase
        .from("shifts")
        .update({
          clock_out_at: new Date().toISOString(),
          gps_clock_out: gps ? `POINT(${gps.lng} ${gps.lat})` : null,
          gps_lat_out: gps?.lat || null,
          gps_lng_out: gps?.lng || null,
        })
        .eq("id", activeShift.id);
      if (error) throw error;
      setActionSuccess("✅ Clocked out successfully!");
      setActiveShift(null);
      setSelectedJob("");
      await loadWeeklySegments(employee.id);
    } catch (err) {
      setActionError(err.message || "Failed to clock out.");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Complete Invite (create auth account + link employee) ────────────────────
  async function handleCompleteInvite(e) {
    e.preventDefault();
    if (inviteSetup.password.length < 8) { setInviteError("Password must be at least 8 characters."); return; }
    if (inviteSetup.password !== inviteSetup.confirmPassword) { setInviteError("Passwords do not match."); return; }
    setInviteError("");
    setInviteLoading(true);
    try {
      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteEmployee.email,
        password: inviteSetup.password,
        options: { data: { first_name: inviteEmployee.first_name, last_name: inviteEmployee.last_name } },
      });
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Failed to create account.");

      // Link the employee record
      const { error: linkError } = await supabase
        .from("employees")
        .update({ user_id: userId, invite_token: null })
        .eq("id", inviteEmployee.id);
      if (linkError) throw linkError;

      setInviteDone(true);
    } catch (err) {
      setInviteError(err.message || "Failed to create account.");
    } finally {
      setInviteLoading(false);
    }
  }

  // ── Sign Out ──────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    setSignoutLoading(true);
    await supabase.auth.signOut();
    setEmployee(null);
    setActiveShift(null);
    setWeeklySegments([]);
    setLoginMode(true);
    setLoginEmail("");
    setLoginPassword("");
    setSignoutLoading(false);
  }

  // ── Computed weekly hours ─────────────────────────────────────────────────────
  const weeklyMinutes = weeklySegments.reduce((sum, seg) => {
    if (!seg.clock_in_at) return sum;
    const out = seg.clock_out_at ? new Date(seg.clock_out_at) : new Date();
    const mins = (out - new Date(seg.clock_in_at)) / 60000;
    return sum + (mins > 0 ? mins : 0);
  }, 0);

  const accent = company?.primary_color || BRAND_ORANGE;

  // ── Invite: Account Created Success ──────────────────────────────────────────
  if (inviteToken && inviteDone) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${BRAND_BLUE} 0%, #1e3a8a 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 24, padding: "44px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111", margin: "0 0 10px 0" }}>Account created!</h1>
          <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
            Welcome to <strong>{company?.name}</strong>! Check your email to confirm your account, then come back here to clock in.
          </p>
          <button
            onClick={() => window.location.href = `/${slug}/clock`}
            style={{ width: "100%", padding: "14px", background: accent, color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 900, cursor: "pointer" }}
          >
            Go to Time Clock →
          </button>
        </div>
      </div>
    );
  }

  // ── Invite: Create Account Form ───────────────────────────────────────────────
  if (inviteToken && inviteEmployee) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${BRAND_BLUE} 0%, #1e3a8a 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, padding: "40px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            {company?.logo_url
              ? <img src={company.logo_url} alt={company.name} style={{ maxHeight: 64, maxWidth: 160, objectFit: "contain", marginBottom: 10 }} />
              : <div style={{ width: 56, height: 56, borderRadius: 12, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 12px" }}>⏱️</div>
            }
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111" }}>Welcome, {inviteEmployee.first_name}!</h1>
            <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 13 }}>{company?.name} · Create your account to start clocking in</p>
          </div>

          {/* Pre-filled info */}
          <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}><strong>Name:</strong> {inviteEmployee.first_name} {inviteEmployee.last_name}</div>
            <div style={{ fontSize: 13, color: "#374151" }}><strong>Email:</strong> {inviteEmployee.email}</div>
          </div>

          <form onSubmit={handleCompleteInvite} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 5 }}>Create a Password *</label>
              <input
                type="password"
                value={inviteSetup.password}
                onChange={e => setInviteSetup(s => ({ ...s, password: e.target.value }))}
                placeholder="At least 8 characters"
                required
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #d1d5db", fontSize: 15, boxSizing: "border-box", outline: "none" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 5 }}>Confirm Password *</label>
              <input
                type="password"
                value={inviteSetup.confirmPassword}
                onChange={e => setInviteSetup(s => ({ ...s, confirmPassword: e.target.value }))}
                placeholder="Re-enter your password"
                required
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #d1d5db", fontSize: 15, boxSizing: "border-box", outline: "none" }}
              />
            </div>
            {inviteError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
                ⚠️ {inviteError}
              </div>
            )}
            <button type="submit" disabled={inviteLoading} style={{
              padding: "14px", borderRadius: 12, border: "none",
              background: inviteLoading ? "#9ca3af" : accent,
              color: "#fff", fontSize: 16, fontWeight: 900, cursor: inviteLoading ? "default" : "pointer",
            }}>
              {inviteLoading ? "⏳ Creating account…" : "Activate My Account →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#9ca3af" }}>
            Powered by <strong style={{ color: accent }}>TradeFlow</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── Invite token not found ────────────────────────────────────────────────────
  if (inviteToken && inviteNotFound) {
    return (
      <div style={{ minHeight: "100vh", background: BRAND_BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#fff", padding: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔗</div>
          <h2 style={{ fontWeight: 900, fontSize: 22 }}>Invite Link Expired</h2>
          <p style={{ color: "#94a3b8", maxWidth: 300, margin: "10px auto 0" }}>
            This invite link has already been used or is no longer valid. Ask your employer to send a new one.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading / Not Found ───────────────────────────────────────────────────────
  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: BRAND_BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", background: BRAND_BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#fff", padding: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontWeight: 900, fontSize: 24 }}>Portal Not Found</h2>
          <p style={{ color: "#94a3b8" }}>No company found for "<strong>{slug}</strong>"</p>
        </div>
      </div>
    );
  }

  // ── Login Screen ──────────────────────────────────────────────────────────────
  if (loginMode) {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${BRAND_BLUE} 0%, #1e3a8a 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}>
        <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 24, padding: "40px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          {/* Company header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            {company.logo_url
              ? <img src={company.logo_url} alt={company.name} style={{ maxHeight: 72, maxWidth: 180, objectFit: "contain", marginBottom: 10 }} />
              : <div style={{ width: 64, height: 64, borderRadius: 14, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 12px" }}>⏱️</div>
            }
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111" }}>{company.name}</h1>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Employee Time Clock</p>
          </div>

          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 5 }}>Email</label>
              <input
                type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                required autoComplete="email" placeholder="you@email.com"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #d1d5db", fontSize: 15, boxSizing: "border-box", outline: "none" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 5 }}>Password</label>
              <input
                type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                required autoComplete="current-password" placeholder="••••••••"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #d1d5db", fontSize: 15, boxSizing: "border-box", outline: "none" }}
              />
            </div>
            {loginError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
                ⚠️ {loginError}
              </div>
            )}
            <button
              type="submit" disabled={loginLoading}
              style={{ padding: "14px", borderRadius: 12, border: "none", background: loginLoading ? "#9ca3af" : accent, color: "#fff", fontSize: 16, fontWeight: 900, cursor: loginLoading ? "default" : "pointer" }}
            >
              {loginLoading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#9ca3af" }}>
            Powered by <strong style={{ color: accent }}>TradeFlow</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── Timeclock Interface ───────────────────────────────────────────────────────
  const isClockedIn = !!activeShift;
  const liveMinutes = isClockedIn ? getLiveMinutes(activeShift.clock_in_at) : 0;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${BRAND_BLUE} 0%, #1a3a8f 100%)`, padding: "0 0 40px" }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {company.logo_url
            ? <img src={company.logo_url} alt={company.name} style={{ height: 40, maxWidth: 120, objectFit: "contain" }} />
            : <div style={{ width: 40, height: 40, borderRadius: 10, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⏱️</div>
          }
          <div>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{company.name}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Time Clock</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{employee.first_name} {employee.last_name}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textTransform: "capitalize" }}>{employee.role}</div>
          </div>
          <button onClick={handleSignOut} disabled={signoutLoading} style={{
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)",
            color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          }}>
            {signoutLoading ? "…" : "Sign Out"}
          </button>
        </div>
      </div>

      <div style={{ padding: "0 16px", maxWidth: 500, margin: "0 auto" }}>

        {/* ── Clock Status Card ── */}
        <div style={{
          background: isClockedIn
            ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
            : "linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)",
          borderRadius: 20, padding: "28px 24px",
          textAlign: "center", marginBottom: 16,
          boxShadow: isClockedIn ? "0 8px 32px rgba(22,163,74,0.4)" : "0 8px 32px rgba(30,64,175,0.4)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>
            {isClockedIn ? "🟢" : "⭕"}
          </div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
            {isClockedIn ? "Currently Clocked In" : "Not Clocked In"}
          </div>
          {isClockedIn && (
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, marginBottom: 4 }}>
              Since {formatTime(activeShift.clock_in_at)} · {activeShift.projects?.name || "No job"}
            </div>
          )}
          {isClockedIn && (
            <div style={{
              display: "inline-block", background: "rgba(255,255,255,0.2)",
              borderRadius: 20, padding: "6px 18px", marginTop: 8,
              color: "#fff", fontSize: 20, fontWeight: 900, letterSpacing: 0.5,
            }}>
              ⏱ {formatDuration(liveMinutes)} today
            </div>
          )}
        </div>

        {/* ── Job Selector ── */}
        {!isClockedIn && (
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: "20px", marginBottom: 14, border: "1px solid rgba(255,255,255,0.15)" }}>
            <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
              📁 Select Job / Project
            </label>
            <select
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
              style={{
                width: "100%", padding: "13px 14px", borderRadius: 12,
                border: "1.5px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.95)", fontSize: 15, fontWeight: 600, color: "#111",
                outline: "none", boxSizing: "border-box",
              }}
            >
              <option value="">-- Select a job --</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
        )}

        {/* ── Clock In/Out Button ── */}
        {actionError && (
          <div style={{ background: "#fee2e2", borderRadius: 12, padding: "10px 14px", marginBottom: 12, color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
            ⚠️ {actionError}
          </div>
        )}
        {actionSuccess && (
          <div style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.4)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, color: "#bbf7d0", fontSize: 14, fontWeight: 600 }}>
            {actionSuccess}
          </div>
        )}

        {gpsLoading && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 8 }}>
            📍 Getting GPS location…
          </div>
        )}

        <button
          onClick={isClockedIn ? handleClockOut : handleClockIn}
          disabled={actionLoading || gpsLoading || (!isClockedIn && !selectedJob)}
          style={{
            width: "100%", padding: "18px",
            background: actionLoading || gpsLoading
              ? "#9ca3af"
              : isClockedIn
                ? "#dc2626"
                : accent,
            color: "#fff", border: "none", borderRadius: 16,
            fontSize: 20, fontWeight: 900,
            cursor: (actionLoading || gpsLoading || (!isClockedIn && !selectedJob)) ? "default" : "pointer",
            boxShadow: isClockedIn ? "0 6px 24px rgba(220,38,38,0.4)" : `0 6px 24px rgba(252,107,4,0.4)`,
            transition: "all 0.2s",
            marginBottom: 24,
          }}
        >
          {actionLoading ? "⏳ Processing…"
            : isClockedIn ? "🔴 Clock Out"
              : "🟢 Clock In"}
        </button>

        {/* ── Weekly Summary ── */}
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ color: "#fff", fontWeight: 900, fontSize: 16, margin: 0 }}>📊 This Week</h3>
            <div style={{
              background: accent, color: "#fff",
              borderRadius: 20, padding: "4px 14px",
              fontSize: 15, fontWeight: 900,
            }}>
              {formatDuration(weeklyMinutes)} hrs
            </div>
          </div>

          {weeklySegments.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", fontSize: 14, margin: "12px 0" }}>
              No time logged yet this week
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {weeklySegments.slice(0, 10).map((seg) => {
                const mins = seg.clock_out_at
                  ? (new Date(seg.clock_out_at) - new Date(seg.clock_in_at)) / 60000
                  : (Date.now() - new Date(seg.clock_in_at)) / 60000;
                const day = new Date(seg.clock_in_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
                return (
                  <div key={seg.id} style={{
                    background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    border: !seg.clock_out_at ? "1px solid rgba(22,163,74,0.5)" : "1px solid transparent",
                  }}>
                    <div>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                        {seg.projects?.name || "No job"} {!seg.clock_out_at && <span style={{ color: "#4ade80", fontSize: 11 }}>● LIVE</span>}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                        {day} · {formatTime(seg.clock_in_at)} – {seg.clock_out_at ? formatTime(seg.clock_out_at) : "now"}
                      </div>
                    </div>
                    <div style={{ color: "#fff", fontWeight: 900, fontSize: 15, flexShrink: 0, marginLeft: 8 }}>
                      {formatDuration(mins)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
