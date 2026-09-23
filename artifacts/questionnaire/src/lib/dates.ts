// Date helpers shared by every dashboard filter.
//
// The database stores `timestamp without time zone` values that were written
// as UTC (`new Date().toISOString()`), so PostgREST returns them with no
// offset, e.g. "2026-09-15T04:03:24.032". `new Date()` parses an offset-less
// string as LOCAL time, which shifts every record 10–11 hours in Sydney.
// parseDbTimestamp treats those strings as the UTC they actually are.

const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a database timestamp. Offset-less values are UTC. */
export function parseDbTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (DATE_ONLY.test(trimmed)) return parseDateOnly(trimmed);
  const iso = HAS_TZ.test(trimmed) ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/** Parse a `YYYY-MM-DD` string (e.g. from <input type="date">) as a LOCAL date. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  const match = DATE_ONLY.exec((value || '').trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Whole-day index of a date in the local calendar. Built from the local
 * Y/M/D, so the difference between two indexes is a DST-safe day count —
 * unlike (a - b) / 86400000, which breaks on 23- and 25-hour days.
 */
export function localDayIndex(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface DateFilter {
  preset: DatePreset;
  /** `YYYY-MM-DD`, only used when preset is 'custom'. Either end may be open. */
  start: string;
  end: string;
}

export const ALL_DATES: DateFilter = { preset: 'all', start: '', end: '' };

/**
 * Does a database timestamp fall inside the filter?
 *
 * - Today: the current local calendar day.
 * - This Week: Monday of the current week through today.
 * - This Month: the 1st of the current month through today.
 * - Custom: inclusive of both the start and end day; either may be left blank.
 */
export function matchesDateFilter(value: string | null | undefined, filter: DateFilter, now: Date = new Date()): boolean {
  if (filter.preset === 'all') return true;
  const date = parseDbTimestamp(value);
  if (!date) return false;

  const day = localDayIndex(date);
  const today = localDayIndex(now);

  switch (filter.preset) {
    case 'today':
      return day === today;
    case 'week': {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      return day >= today - daysSinceMonday && day <= today;
    }
    case 'month': {
      const firstOfMonth = localDayIndex(new Date(now.getFullYear(), now.getMonth(), 1));
      return day >= firstOfMonth && day <= today;
    }
    case 'custom': {
      const start = parseDateOnly(filter.start);
      const end = parseDateOnly(filter.end);
      let from = start ? localDayIndex(start) : -Infinity;
      let to = end ? localDayIndex(end) : Infinity;
      if (from > to) [from, to] = [to, from];
      return day >= from && day <= to;
    }
    default:
      return true;
  }
}

/** Format a database timestamp for display in the lawyer's local time. */
export function formatDbTimestamp(value: string | null | undefined): string {
  const date = parseDbTimestamp(value);
  return date ? date.toLocaleString('en-AU') : '';
}
