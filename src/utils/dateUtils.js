/**
 * Safely parse a date string as LOCAL time (not UTC).
 *
 * JavaScript's `new Date("2026-02-07")` parses date-only strings as UTC midnight,
 * which in US timezones (e.g., CST = UTC-6) shows as the PREVIOUS day.
 *
 * This function appends T00:00:00 to date-only strings so they parse as local midnight.
 * Full datetime strings (with T already) are parsed normally.
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  // If it already has a time component, parse normally
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    return new Date(dateStr);
  }
  // For date-only strings (YYYY-MM-DD), parse as local time by appending T00:00:00
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Format a date string for display, handling timezone correctly.
 * @param {string} dateStr - Date string (YYYY-MM-DD or full ISO)
 * @param {Intl.DateTimeFormatOptions} options - toLocaleDateString options
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr, options) {
  const date = parseLocalDate(dateStr);
  if (!date || isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', options || undefined);
}

/**
 * Get today's date as a YYYY-MM-DD string in LOCAL time.
 *
 * DO NOT use `new Date().toISOString().split('T')[0]` — that returns the UTC date,
 * which after 7 PM US/Central (midnight UTC) will be TOMORROW's date.
 * This function always returns the correct local calendar date.
 */
export function getTodayLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a Date object to a YYYY-MM-DD string in LOCAL time.
 * Use this instead of date.toISOString().split('T')[0] which gives the UTC date.
 */
export function toLocalDateString(date) {
  if (!date || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
