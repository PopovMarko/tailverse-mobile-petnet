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
