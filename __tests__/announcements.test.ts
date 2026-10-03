import { ApiError } from '../src/api/client';
import type { AnnouncementCreateRequest } from '../src/types';
import {
  buildAnnouncementRequest,
  describeCreateError,
  describeJoinError,
  parseDurationInput,
  validateAnnouncementForm,
  walkPhase,
  type WalkPlace,
} from '../src/utils/announcements';
import {
  formatDateTime,
  formatDuration,
  roundUpToMinutes,
} from '../src/utils/date';
import { distanceM, formatDistance } from '../src/utils/geo';

const startsAt = new Date('2026-10-03T12:30:00Z');
const spotPlace: WalkPlace = {
  kind: 'spot',
  spot: { id: 's1', name: 'Площадка', lat: 47.9, lng: 33.39, distance_m: 120 },
};
const pointPlace: WalkPlace = {
  kind: 'point',
  point: { lat: 47.91, lng: 33.38 },
};

describe('buildAnnouncementRequest', () => {
  test('a spot sends spot_id only', () => {
    const body = buildAnnouncementRequest({
      petId: 'p1',
      startsAt,
      durationMin: 60,
      place: spotPlace,
    });
    expect(body).toEqual({
      pet_id: 'p1',
      spot_id: 's1',
      starts_at: '2026-10-03T12:30:00.000Z',
      duration_min: 60,
    });
    expect(body).not.toHaveProperty('custom_point');
  });

  test('a point sends custom_point only', () => {
    const body = buildAnnouncementRequest({
      petId: 'p1',
      startsAt,
      durationMin: 45,
      place: pointPlace,
    });
    expect(body).toEqual({
      pet_id: 'p1',
      custom_point: { lat: 47.91, lng: 33.38 },
      starts_at: '2026-10-03T12:30:00.000Z',
      duration_min: 45,
    });
    expect(body).not.toHaveProperty('spot_id');
    // The JSON on the wire has exactly one of the two keys.
    expect(Object.keys(JSON.parse(JSON.stringify(body))).sort()).toEqual([
      'custom_point',
      'duration_min',
      'pet_id',
      'starts_at',
    ]);
  });

  test('the request type rejects both places and neither', () => {
    const fields = { pet_id: 'p1', starts_at: '', duration_min: 30 };
    // @ts-expect-error — both spot_id and custom_point
    const both: AnnouncementCreateRequest = {
      ...fields,
      spot_id: 's1',
      custom_point: { lat: 1, lng: 2 },
    };
    // @ts-expect-error — neither
    const neither: AnnouncementCreateRequest = { ...fields };
    expect([both, neither]).toHaveLength(2);
  });
});

describe('validateAnnouncementForm', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  const valid = {
    petId: 'p1',
    startsAt: new Date('2026-10-03T12:15:00Z'),
    durationMin: 60,
    place: spotPlace,
  };

  test('accepts a complete form', () => {
    expect(validateAnnouncementForm(valid, now)).toEqual({});
  });

  test('requires a pet, a place and a sane duration', () => {
    expect(
      validateAnnouncementForm(
        { ...valid, petId: null, place: null, durationMin: null },
        now,
      ),
    ).toEqual({
      pet: 'Выберите питомца',
      place: 'Выберите место прогулки',
      duration: 'Укажите длительность от 1 минуты до 12 ч',
    });
    expect(
      validateAnnouncementForm({ ...valid, durationMin: 0 }, now).duration,
    ).toBeDefined();
    expect(
      validateAnnouncementForm({ ...valid, durationMin: 721 }, now).duration,
    ).toBeDefined();
    expect(
      validateAnnouncementForm({ ...valid, durationMin: 720 }, now).duration,
    ).toBeUndefined();
  });

  test('the start may not be in the past or more than 30 days ahead', () => {
    expect(
      validateAnnouncementForm(
        { ...valid, startsAt: new Date('2026-10-03T11:50:00Z') },
        now,
      ).startsAt,
    ).toBe('Это время уже прошло — выберите другое');
    // A few minutes late (the form stayed open) is still fine.
    expect(
      validateAnnouncementForm(
        { ...valid, startsAt: new Date('2026-10-03T11:57:00Z') },
        now,
      ).startsAt,
    ).toBeUndefined();
    expect(
      validateAnnouncementForm(
        { ...valid, startsAt: new Date('2026-11-03T12:00:00Z') },
        now,
      ).startsAt,
    ).toBe('Не позже чем через 30 дней');
  });
});

test('parseDurationInput accepts whole minutes only', () => {
  expect(parseDurationInput(' 45 ')).toBe(45);
  expect(parseDurationInput('')).toBeNull();
  expect(parseDurationInput('1.5')).toBeNull();
  expect(parseDurationInput('-5')).toBeNull();
});

test('walkPhase follows the status and the time', () => {
  const walk = {
    status: 'active' as const,
    starts_at: '2026-10-03T12:00:00Z',
    duration_min: 60,
  };
  expect(walkPhase(walk, new Date('2026-10-03T11:59:00Z'))).toBe('upcoming');
  expect(walkPhase(walk, new Date('2026-10-03T12:30:00Z'))).toBe('ongoing');
  expect(walkPhase(walk, new Date('2026-10-03T13:00:00Z'))).toBe('ended');
  expect(walkPhase({ ...walk, status: 'cancelled' })).toBe('cancelled');
  expect(walkPhase({ ...walk, status: 'finished' })).toBe('ended');
});

test('backend validation errors read in Russian', () => {
  const badRequest = (error: string) =>
    new ApiError(400, { msg: 'CreateAnnouncement handler', error });
  expect(
    describeCreateError(
      badRequest(
        'starts_at must be between 1 hour ago and 30 days ahead: invalid argument',
      ),
    ),
  ).toBe('Время начала — не раньше чем час назад и не позже чем через 30 дней');
  expect(
    describeCreateError(
      badRequest('duration_min must be in [1, 720]: invalid argument'),
    ),
  ).toBe('Длительность — от 1 минуты до 12 ч');
  expect(
    describeCreateError(
      badRequest(
        'exactly one of spot_id and custom_point is required: invalid argument',
      ),
    ),
  ).toBe('Выберите одно место: площадку или точку на карте');
  expect(describeCreateError(badRequest('something else'))).toBe(
    'Проверьте введённые данные',
  );
  expect(describeCreateError(new ApiError(403, null))).toBe(
    'Объявить прогулку можно только со своим питомцем',
  );
  expect(describeCreateError(new TypeError('Network request failed'))).toBe(
    'Нет связи с сервером',
  );

  expect(
    describeJoinError(
      badRequest('the walk has already ended: invalid argument'),
    ),
  ).toBe('Прогулка уже закончилась');
  expect(describeJoinError(new ApiError(409, null))).toBe(
    'Этот питомец уже идёт на прогулку',
  );
});

test('date and duration formatting', () => {
  const now = new Date(2026, 9, 3, 10, 0);
  expect(formatDateTime(new Date(2026, 9, 3, 14, 30), now)).toBe(
    'сегодня, 14:30',
  );
  expect(formatDateTime(new Date(2026, 9, 4, 9, 5), now)).toBe('завтра, 09:05');
  expect(formatDateTime(new Date(2026, 9, 2, 23, 0), now)).toBe('вчера, 23:00');
  expect(formatDateTime(new Date(2026, 9, 15, 8, 0), now)).toBe(
    '15 октября, 08:00',
  );

  expect(formatDuration(45)).toBe('45 мин');
  expect(formatDuration(60)).toBe('1 ч');
  expect(formatDuration(90)).toBe('1 ч 30 мин');

  expect(roundUpToMinutes(new Date(2026, 9, 3, 10, 7, 30), 15)).toEqual(
    new Date(2026, 9, 3, 10, 15),
  );
  expect(roundUpToMinutes(new Date(2026, 9, 3, 10, 15), 15)).toEqual(
    new Date(2026, 9, 3, 10, 15),
  );
  expect(roundUpToMinutes(new Date(2026, 9, 3, 10, 59, 1), 15)).toEqual(
    new Date(2026, 9, 3, 11, 0),
  );
});

test('distances', () => {
  // ~111 m per 0.001° of latitude.
  expect(
    distanceM({ lat: 47.9, lng: 33.39 }, { lat: 47.901, lng: 33.39 }),
  ).toBeCloseTo(111.2, 0);
  expect(formatDistance(9)).toBe('9 м');
  expect(formatDistance(120.4)).toBe('120 м');
  expect(formatDistance(1200)).toBe('1,2 км');
  expect(formatDistance(5000)).toBe('5 км');
  expect(formatDistance(15_300)).toBe('15 км');
});
