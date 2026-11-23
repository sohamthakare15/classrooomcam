/**
 * Indian Standard Time (IST) Date & Time Utilities (Asia/Kolkata).
 * Ensures consistency across live clock, attendance dates, and history timestamps.
 */

export const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current date string formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 * Avoids UTC off-by-one day rollover errors.
 */
export function getTodayKolkataDateString() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

/**
 * Formats a date object or string into readable Indian Standard Time date.
 * e.g. "Mon, Nov 23, 2026"
 */
export function formatKolkataDate(dateInput) {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' && dateInput.length === 10
    ? new Date(`${dateInput}T12:00:00+05:30`)
    : new Date(dateInput);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(d);
}

/**
 * Formats time in Asia/Kolkata with hours, minutes, and seconds.
 * e.g. "07:30:15 PM"
 */
export function formatKolkataTime(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(d);
}

/**
 * Formats timestamp (epoch or ISO) into full readable datetime in Asia/Kolkata.
 * e.g. "23 Nov 2026, 07:30 PM"
 */
export function formatKolkataDateTime(timestamp) {
  if (!timestamp) return '—';
  const d = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}
