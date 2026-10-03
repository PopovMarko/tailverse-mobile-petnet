// Client-side checks that mirror the backend's validation rules, so most
// mistakes are caught before a request is sent.

// Deliberately loose: the backend does the strict RFC check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export const NICKNAME_MAX = 50;
export const PET_NAME_MAX = 100;
export const BREED_MAX = 100;
export const SPECIES_MAX = 50;
export const APPROX_ADDRESS_MAX = 200;

/** Length in Unicode code points, as the backend's validator counts it. */
function length(value: string): number {
  return Array.from(value).length;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) {
    return 'Введите email';
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return 'Некорректный email';
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (length(value) < PASSWORD_MIN) {
    return `Пароль должен быть не короче ${PASSWORD_MIN} символов`;
  }
  if (length(value) > PASSWORD_MAX) {
    return `Пароль должен быть не длиннее ${PASSWORD_MAX} символов`;
  }
  return null;
}

/** Required trimmed text of at most `max` characters. */
export function validateRequired(
  value: string,
  max: number,
  emptyMessage: string,
): string | null {
  const text = value.trim();
  if (!text) {
    return emptyMessage;
  }
  if (length(text) > max) {
    return `Не длиннее ${max} символов`;
  }
  return null;
}
