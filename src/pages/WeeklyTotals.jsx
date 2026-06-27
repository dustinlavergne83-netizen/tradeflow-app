import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

import { formatDate } from "../utils/dateUtils";
import { notify } from '../lib/notify';

const BRAND = {
  bg: "#0b3ea8",        // dark blue/black background
  text: "#f97316",      // light text
  cardBg: "#e5e7eb",    // card background
  cardText: "#fc6b04ff",  // card text
  border: "#1f2937",    // subtle borders

  primary: "#0b3ea8",   // ⚡ DML BLUE (logo blue)
  accent: "#fc6b04ff",    // 🔥 DML ORANGE (logo orange)
  danger: "#f97316",    // delete / warnings
};

function toDateYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weekStartMonday(dateStr) {
  // Parse the date string to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  
  // Get the day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = d.getDay();
  // Calculate how many days to subtract to get to Monday
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  // Create a new date for Monday
  const monday = new Date(year, month - 1, day + diff);
  return toDateYMD(monday);
}

function toTimeHHMM(dt) {
  return dt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function mapSegmentsToEntries(segs) {
  return (segs || []).map((seg) => {
    const start = new Date(seg.start_at);
    const end = seg.end_at ? new Date(seg.end_at) : null;

    const dateStr = toDateYMD(start);
    const inStr = toTimeHHMM(start);
    const outStr = end ? toTimeHHMM(end) : "—";

    return {
      id: seg.id,
      date: dateStr,
      in: inStr,
      out: outStr,
      project: seg.project_task || "",
    };
  });
}

function minutesBetween(startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return 0;
  if (endHHMM === "—") return 0;

  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;

  let start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start);
}

function dayTotalMinutes(segmentsForThatDate, lunchChecked) {
  const raw = (segmentsForThatDate || []).reduce((sum, s) => {
    return sum + minutesBetween(s.in, s.out);
  }, 0);

  return Math.max(0, raw - (lunchChecked ? 30 : 0));
}

export default function WeeklyTotals() {
  const nav = useNavigate();

  const isMobileApp = useMemo(() => {
    return new URLSearchParams(window.location.search).get("mobile") === "1";
  }, []);

  const [entries, setEntries] = useState([]);

  // Lunch state is read from the database (is_lunch on shift_segments), not localStorage
  const [lunchByDate, setLunchByDate] = useState({});
// Swipe right to go back (mobile only)
useEffect(() => {
  if (!isMobileApp) return;

  let sx = 0;
  let sy = 0;

  const onStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    sx = t.clientX;
    sy = t.clientY;
  };

  const onEnd = (e) => {
    const t = e.changedTouches?.[0];
    if (!t) return;

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    // swipe right
    if (dx > 90 && Math.abs(dy) < 60) {
      nav("/timeclock" + window.location.search, { replace: true });
    }
  };

  window.addEventListener("touchstart", onStart, { passive: true });
  window.addEventListener("touchend", onEnd, { passive: true });

  return () => {
    window.removeEventListener("touchstart", onStart);
    window.removeEventListener("touchend", onEnd);
  };
}, [isMobileApp, nav]);

const [openWeek, setOpenWeek] = useState(null);

  // Load recent segments (enough to build a bunch of weeks)
  useEffect(() => {
    (async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) return notify("Auth error: " + userErr.message);

      const userId = userData.user?.id;
      if (!userId) return;

      const { data: segs, error } = await supabase
        .from("shift_segments")
        .select("id, project_task, start_at, end_at, is_lunch")
        .eq("user_id", userId)
        .order("start_at", { ascending: false })
        .limit(800);

      if (error) return notify("Load totals error: " + error.message);

      setEntries(mapSegmentsToEntries(segs));

      // Build lunchByDate from is_lunch flag in database
      const dbLunch = {};
      for (const seg of (segs || [])) {
        if (seg.is_lunch) {
          const date = toDateYMD(new Date(seg.start_at));
          dbLunch[date] = true;
        }
      }
      setLunchByDate(dbLunch);
    })();
  }, []);

 const weekly = useMemo(() => {
  const groupedWeeks = {};

  for (const e of entries) {
    const w = weekStartMonday(e.date);
    groupedWeeks[w] = groupedWeeks[w] || {};
    groupedWeeks[w][e.date] = groupedWeeks[w][e.date] || [];
    groupedWeeks[w][e.date].push(e);
  }

  const weeks = Object.keys(groupedWeeks).map((w) => {
    const byDate = groupedWeeks[w];

    const totalHours = Object.keys(byDate).reduce((sum, dateStr) => {
      const lunchChecked = !!lunchByDate[dateStr];
      const mins = dayTotalMinutes(byDate[dateStr], lunchChecked);
      return sum + mins / 60;
    }, 0);

    return {
      weekStart: w,
      totalHours,
      dayCount: Object.keys(byDate).length,
      byDate, // ✅ keep for expand view
    };
  });

  weeks.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  return weeks;
}, [entries, lunchByDate]);


   

 
 return (
  <div
    style={{
      minHeight: "100vh",
      background: BRAND.bg,
      color: BRAND.text,
    }}
  >
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <h2
        style={{
          margin: 0,
          color: BRAND.text,
          textAlign: "center",
          fontWeight: 900,
        }}
      >
        Weekly Totals
      </h2>

      <div style={{ marginTop: 14 }}>
        {weekly.length === 0 ? (
          <div style={{ opacity: 0.85 }}>No weeks found yet.</div>
        ) : (
          weekly.map((w) => {
            const isOpen = openWeek === w.weekStart;

            return (
              <div
                key={w.weekStart}
                style={{
                  border: `1px solid ${BRAND.border}`,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  background: BRAND.cardBg,
                }}
              >
                <button
                  onClick={() => setOpenWeek(isOpen ? null : w.weekStart)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    color: BRAND.text,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>Week of {w.weekStart}</div>
                    <div style={{ fontWeight: 900, color: BRAND.accent }}>
                      {w.totalHours.toFixed(2)} hrs
                    </div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                    {w.dayCount} day{w.dayCount === 1 ? "" : "s"} with time entries • Tap to{" "}
                    {isOpen ? "hide" : "view"} days
                  </div>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    {Object.keys(w.byDate)
                      .sort((a, b) => (a < b ? -1 : 1))
                      .map((dateStr) => {
                        const lunchChecked = !!lunchByDate[dateStr];
                        const mins = dayTotalMinutes(w.byDate[dateStr], lunchChecked);
                        const hrs = (mins / 60).toFixed(2);

                        return (
                          <div
                            key={dateStr}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: `1px solid ${BRAND.border}`,
                              background: "rgba(255,255,255,0.03)",
                            }}
                          >
                            <div style={{ fontWeight: 800 }}>
                              {dateStr}{" "}
                              <span style={{ fontWeight: 600, opacity: 0.8 }}>
                                (
                                {new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
                                  weekday: "short",
                                })}
                                )
                              </span>
                              {lunchChecked ? (
                                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.85 }}>
                                  Lunch -0.5
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontWeight: 900 }}>{hrs} hrs</div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>
);
}
