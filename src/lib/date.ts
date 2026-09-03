import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfWeek,
  subDays,
} from "date-fns";

export const DATE_FORMAT = "yyyy-MM-dd";

/** Parse a "yyyy-MM-dd" key as a LOCAL date; null unless it round-trips exactly. */
export function parseDateKey(key: string): Date | null {
  if (!key) return null;
  const d = parse(key, DATE_FORMAT, new Date());
  return isValid(d) && format(d, DATE_FORMAT) === key ? d : null;
}

/** Convert a Date or date key into a local Date (string keys parse as local). */
function toLocalDate(date: Date | string): Date {
  if (typeof date !== "string") return date;
  return parseDateKey(date) ?? new Date(date);
}

export function todayKey(): string {
  return format(new Date(), DATE_FORMAT);
}

export function formatDateKey(date: Date | string): string {
  return format(toLocalDate(date), DATE_FORMAT);
}

export function formatDateLong(date: Date | string): string {
  return format(toLocalDate(date), "EEEE, MMMM d");
}

export function formatDateShort(date: Date | string): string {
  return format(toLocalDate(date), "EEE, MMM d");
}

/** Shift a date key by whole days; falls back to today for invalid keys. */
export function addDaysToKey(key: string, amount: number): string {
  const d = parseDateKey(key);
  return d ? format(addDays(d, amount), DATE_FORMAT) : todayKey();
}

/** The Monday→Sunday calendar week that contains `key`. */
export function weekDaysFor(key: string): string[] {
  const d = parseDateKey(key) ?? new Date();
  const start = startOfWeek(d, { weekStartsOn: 1 });
  const end = endOfWeek(d, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).map((x) => format(x, DATE_FORMAT));
}

export function last7Days(): string[] {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(subDays(new Date(), i));
  }
  return days.map((d) => formatDateKey(d));
}
