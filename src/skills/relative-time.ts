/**
 * Human-readable relative duration, e.g. "3 days ago", "2 months ago".
 */
export function formatRelativeTime(
  date: Date | string,
  now: Date = new Date()
): string {
  const then = typeof date === 'string' ? new Date(date) : date;
  if (!Number.isFinite(then.getTime())) return 'unknown';

  let seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  const future = seconds < 0;
  seconds = Math.abs(seconds);

  const units: Array<[number, string]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];

  let value = seconds;
  let unit = 'second';
  for (const [div, name] of units) {
    if (value < div) {
      unit = name;
      break;
    }
    value = Math.floor(value / div);
    unit = name;
  }

  // Prefer day/month wording for mid-range spans
  if (unit === 'second' && value < 10) {
    return future ? 'just now' : 'just now';
  }
  const label = `${value} ${unit}${value === 1 ? '' : 's'}`;
  return future ? `in ${label}` : `${label} ago`;
}
