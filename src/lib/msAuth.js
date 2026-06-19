/**
 * msAuth.js — Shared Microsoft OAuth 2.0 PKCE helper
 *
 * Used by both Communications.jsx and EmailInbox.jsx.
 * All OAuth redirects go through /email-inbox (the one registered SPA redirect URI).
 * The caller can pass a returnTo path so the user lands back on the right page.
 *
 * NO MSAL LIBRARY — pure fetch + Web Crypto API.
 */

const MS_TENANT    = '9bd3d089-ecc6-4777-9198-41f0d40f95d6';
const MS_CLIENT    = '1101ddc0-5dc1-4275-beb6-34b2ef897452';
const REDIRECT_URI = window.location.origin + '/email-inbox'; // must match Azure App Registration
// Full scope set for both inbox (read) and communications (read+write+send)
const SCOPES       = 'Mail.Read Mail.ReadBasic Mail.ReadWrite Mail.Send offline_access';
const AUTH_URL     = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL    = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;

export const TOKEN_KEY     = 'ms_graph_token_v3';  // shared across all pages
export const RETURN_TO_KEY = 'ms_auth_return_to';  // where to navigate after auth
const VERIFIER_KEY          = 'ms_pkce_verifier';
const STATE_KEY             = 'ms_oauth_state';

// ── Crypto helpers ───────────────────────────────────────────────────────────
function randomString(len = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

async function pkceChallenge(verifier) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Start sign-in redirect ───────────────────────────────────────────────────
// returnTo: the path to navigate to AFTER auth (e.g. '/communications')
export async function startSignIn(returnTo = '/email-inbox') {
  const verifier  = randomString(64);
  const state     = randomString(32);
  const challenge = await pkceChallenge(verifier);

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  // Store the return path so EmailInbox can redirect after exchanging the code
  if (returnTo && returnTo !== '/email-inbox') {
    localStorage.setItem(RETURN_TO_KEY, returnTo);
  } else {
    localStorage.removeItem(RETURN_TO_KEY);
  }

  const params = new URLSearchParams({
    client_id:             MS_CLIENT,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    response_mode:         'fragment',
    state,
    prompt:                'select_account',
  });

  window.location.href = `${AUTH_URL}?${params}`;
}

// ── Exchange auth code for tokens ────────────────────────────────────────────
export async function exchangeCode(code, returnedState) {
  const storedState = sessionStorage.getItem(STATE_KEY);
  const verifier    = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  if (storedState && returnedState && returnedState !== storedState) {
    throw new Error('OAuth state mismatch — please try signing in again.');
  }
  if (!verifier) {
    throw new Error('PKCE verifier not found — session may have expired. Please try again.');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     MS_CLIENT,
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || `Token exchange failed (HTTP ${res.status})`);
  }

  const t = await res.json();
  const tokenData = {
    access_token:  t.access_token,
    refresh_token: t.refresh_token,
    expires_at:    Date.now() + t.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));

  // Clean the auth code from the URL
  window.history.replaceState({}, document.title, '/email-inbox');
  return tokenData.access_token;
}

// ── Get a valid access token (refreshing silently if expired) ────────────────
export async function getValidToken() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;

  let td;
  try { td = JSON.parse(raw); }
  catch { localStorage.removeItem(TOKEN_KEY); return null; }

  // Still valid (5-min buffer)
  if (Date.now() < td.expires_at - 300_000) return td.access_token;

  // Try silent refresh
  if (!td.refresh_token) { localStorage.removeItem(TOKEN_KEY); return null; }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     MS_CLIENT,
      refresh_token: td.refresh_token,
      scope:         SCOPES,
    }),
  });

  if (!res.ok) { localStorage.removeItem(TOKEN_KEY); return null; }

  const t = await res.json();
  const newTd = {
    access_token:  t.access_token,
    refresh_token: t.refresh_token || td.refresh_token,
    expires_at:    Date.now() + t.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(newTd));
  return newTd.access_token;
}

// ── Check if user is currently signed in ────────────────────────────────────
export function isSignedIn() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return false;
  try {
    const td = JSON.parse(raw);
    // Signed in if token exists (even if expired — refresh_token can renew it)
    return !!(td.access_token);
  } catch { return false; }
}

// ── Sign out ─────────────────────────────────────────────────────────────────
export function doSignOut(redirectAfter = null) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(RETURN_TO_KEY);
  const returnUri = redirectAfter
    ? window.location.origin + redirectAfter
    : window.location.origin + '/email-inbox';
  window.location.href = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/logout`
    + `?post_logout_redirect_uri=${encodeURIComponent(returnUri)}`;
}
