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
