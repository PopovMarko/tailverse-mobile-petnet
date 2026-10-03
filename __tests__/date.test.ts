import {
  ageInYears,
  formatAge,
  formatDate,
  parseDateString,
  toDateString,
} from '../src/utils/date';

test('toDateString formats the local calendar date', () => {
  expect(toDateString(new Date(2021, 0, 5, 23, 30))).toBe('2021-01-05');
});

test('parseDateString rejects malformed and impossible dates', () => {
  expect(parseDateString('2021-02-30')).toBeNull();
  expect(parseDateString('05.01.2021')).toBeNull();
  expect(parseDateString('2021-01-05')).toEqual(new Date(2021, 0, 5));
});

test('formatDate shows DD.MM.YYYY', () => {
  expect(formatDate('2021-01-05')).toBe('05.01.2021');
});

test('ageInYears counts full years like the backend', () => {
  const now = new Date(2026, 9, 3);
  expect(ageInYears('2020-10-03', now)).toBe(6);
  expect(ageInYears('2020-10-04', now)).toBe(5);
  expect(ageInYears('2026-05-01', now)).toBe(0);
  expect(ageInYears('2027-01-01', now)).toBe(0);
});

test('formatAge uses Russian plural forms', () => {
  expect(formatAge(0)).toBe('меньше года');
  expect(formatAge(1)).toBe('1 год');
  expect(formatAge(3)).toBe('3 года');
  expect(formatAge(5)).toBe('5 лет');
  expect(formatAge(11)).toBe('11 лет');
  expect(formatAge(21)).toBe('21 год');
  expect(formatAge(22)).toBe('22 года');
});
