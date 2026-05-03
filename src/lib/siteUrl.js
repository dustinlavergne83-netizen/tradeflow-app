/**
 * Returns the correct public-facing URL for email links.
 *
 * When running locally (localhost), window.location.origin is NOT accessible
 * from the internet, so email links would be broken. This utility:
 *  1. Prefers the VITE_SITE_URL env variable (set this to your Vercel/production URL)
 *  2. Falls back to window.location.origin (works fine in production deployments)
 *
 * TO SET YOUR PRODUCTION URL:
 *   - Add this line to your .env file:
 *       VITE_SITE_URL=https://your-app.vercel.app
 *   - Or set it in your Vercel project environment variables
 */
export function getSiteUrl() {
  return import.meta.env.VITE_SITE_URL || window.location.origin;
}

/**
 * Returns true if the current site URL is localhost (meaning email links
 * will NOT work for real recipients).
 */
export function isLocalhost() {
  const origin = import.meta.env.VITE_SITE_URL || window.location.origin;
  return origin.includes('localhost') || origin.includes('127.0.0.1');
}
