/**
 * Date formatting utilities for consistent display across the app.
 */

interface FormattedDate {
  text: string;
  isRelative: boolean;
}

/**
 * Format a single date for display.
 * - Within 7 days: shows weekday name (e.g., "Tuesday")
 * - Beyond 7 days: shows "Mon DD" format (e.g., "Dec 9")
 */
export function formatSingleDate(dateStr: string): FormattedDate {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Within the next 7 days (including today) - show day name
  if (daysUntil >= 0 && daysUntil <= 7) {
    return { text: date.toLocaleDateString('en-US', { weekday: 'long' }), isRelative: false };
  }

  // More than a week away or in the past - use "Mon DD" format
  return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isRelative: false };
}

/**
 * Format an event date range for display in banners.
 * - Single day: "Tuesday" or "Dec 9"
 * - Multi-day: "Tuesday - Friday" or "Dec 4 - Dec 7"
 */
export function formatEventDate(dateStart: string | null, dateEnd?: string | null): string {
  if (!dateStart) return '';

  const start = formatSingleDate(dateStart);

  // Single-day event (or no end date)
  if (!dateEnd || dateEnd === dateStart) {
    return start.text;
  }

  // Multi-day event
  const end = formatSingleDate(dateEnd);
  return `${start.text} - ${end.text}`;
}

/**
 * Format a date for section headers in the reminders list.
 * - Within 7 days: "Tuesday"
 * - Beyond 7 days: "Tuesday, December 9"
 * - No date: "General reminders"
 */
export function formatSectionHeader(dateStr: string | null): string {
  if (!dateStr) return 'General reminders';

  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Within the next 7 days (including today) - show day name
  if (daysUntil >= 0 && daysUntil <= 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
