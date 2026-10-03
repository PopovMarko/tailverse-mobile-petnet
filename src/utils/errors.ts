import { ApiError } from '../api/client';

/** Russian messages for HTTP statuses; callers override the ones that mean something specific. */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Проверьте введённые данные',
  401: 'Сессия истекла, войдите снова',
  403: 'Недостаточно прав',
  404: 'Не найдено',
  409: 'Конфликт данных',
  413: 'Файл слишком большой (максимум 10 МБ)',
  415: 'Неподдерживаемый формат файла',
};

/** Turns any thrown value into a message for the user. */
export function describeError(
  error: unknown,
  overrides: Partial<Record<number, string>> = {},
): string {
  if (error instanceof ApiError) {
    const message = overrides[error.status] ?? STATUS_MESSAGES[error.status];
    if (message) {
      return message;
    }
    if (error.status >= 500) {
      return 'Ошибка сервера, попробуйте позже';
    }
    return error.message;
  }
  // fetch rejects with a TypeError ("Network request failed") when the server is unreachable.
  if (error instanceof TypeError) {
    return 'Нет связи с сервером';
  }
  return error instanceof Error ? error.message : String(error);
}
