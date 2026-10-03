import type { DateString } from '../types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local calendar date of `date` as "YYYY-MM-DD" (the backend's birth_date format). */
export function toDateString(date: Date): DateString {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

/** Parses "YYYY-MM-DD" into a local Date at midnight; null if malformed. */
export function parseDateString(value: DateString): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** "YYYY-MM-DD" as "ДД.ММ.ГГГГ" for display. */
export function formatDate(value: DateString): string {
  const date = parseDateString(value);
  return date
    ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
    : value;
}

/** Full years between birth date and now — the same rule the backend uses for "age". */
export function ageInYears(
  birthDate: DateString,
  now: Date = new Date(),
): number | null {
  const birth = parseDateString(birthDate);
  if (!birth) {
    return null;
  }
  let years = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    years--;
  }
  return Math.max(years, 0);
}

/** Russian plural form for a count: plural(5, ['год', 'года', 'лет']) → 'лет'. */
export function plural(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return forms[0];
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return forms[1];
  }
  return forms[2];
}

/** Age for display: "меньше года", "1 год", "3 года", "7 лет". */
export function formatAge(years: number): string {
  if (years < 1) {
    return 'меньше года';
  }
  return `${years} ${plural(years, ['год', 'года', 'лет'])}`;
}

/**
 * How long ago `from` was, in short Russian: "только что", "5 мин назад",
 * "2 ч назад", "1 ч 20 мин назад". Future times count as "только что".
 */
export function formatAgo(from: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) {
    return 'только что';
  }
  if (minutes < 60) {
    return `${minutes} мин назад`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч назад` : `${hours} ч ${rest} мин назад`;
}

/** Local clock time "ЧЧ:ММ". */
export function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Check-in time for display: "с 14:05 · 25 мин назад"; the raw value if unparsable. */
export function formatSince(timestamp: string, now: Date = new Date()): string {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) {
    return timestamp;
  }
  const date = new Date(time);
  return `с ${formatClock(date)} · ${formatAgo(date, now)}`;
}

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** Local date and time of a walk: "сегодня, 14:30", "завтра, 09:00", "5 октября, 10:00". */
export function formatDateTime(date: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  const day =
    days === 0
      ? 'сегодня'
      : days === 1
      ? 'завтра'
      : days === -1
      ? 'вчера'
      : `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
  return `${day}, ${formatClock(date)}`;
}

/** Duration for display: "45 мин", "1 ч", "1 ч 30 мин". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

/** The first moment at or after `date` on a whole `step`-minute mark (seconds dropped). */
export function roundUpToMinutes(date: Date, step: number): Date {
  const stepMs = step * 60_000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
}
