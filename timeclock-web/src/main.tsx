import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

// ── Intercept Supabase invite / magic-link / recovery URL hashes ──────────
// When an employee clicks an invite email, Supabase redirects them here with
// auth tokens in the URL hash (e.g. #access_token=...&type=invite).
// If we're not already on /set-password, redirect there NOW (preserving the hash)
// so the SetPassword page can pick up the session and show the password form.
{
  const hash = window.location.hash;
  const isAuthLink =
    hash.includes("type=invite") ||
    hash.includes("type=magiclink") ||
    hash.includes("type=recovery");
  const alreadyOnSetPassword = window.location.pathname.startsWith("/set-password");

  if (isAuthLink && !alreadyOnSetPassword) {
    // replace() keeps the hash so Supabase can exchange the token on the new page
    window.location.replace("/set-password" + hash);
  }
}
// ─────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" />
    </BrowserRouter>
  </React.StrictMode>
);
