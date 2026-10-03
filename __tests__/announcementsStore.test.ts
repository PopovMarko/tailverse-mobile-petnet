import { useAnnouncementsStore } from '../src/store/announcementsStore';
import { useAuthStore } from '../src/store/authStore';
import type { Announcement, Pet } from '../src/types';
import { json, mockFetch } from '../test-utils/mockFetch';

const center = { lat: 47.9056, lng: 33.3906 };

const myPet: Pet = {
  id: 'p1',
  owner_id: 'o1',
  name: 'Бублик',
  breed: 'корги',
  species: 'dog',
  birth_date: null,
  age: null,
  approx_address: 'Центр',
  created_at: '2026-10-03T10:00:00Z',
};

const inHour = (minutes = 60) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    pet_id: 'p9',
    spot_id: 's1',
    custom_point: null,
    starts_at: inHour(),
    duration_min: 60,
    status: 'active',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const spot = {
  id: 's1',
  name: 'Площадка у парка',
  lat: 47.9055,
  lng: 33.3905,
  tags: [],
  present: [],
};

const initialAuth = useAuthStore.getState();
const initialState = useAnnouncementsStore.getState();

/** Lets the background name requests finish. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState(
    {
      ...initialAuth,
      status: 'signedIn',
      accessToken: 'access',
      pets: [myPet],
    },
    true,
  );
  useAnnouncementsStore.getState().reset();
  useAnnouncementsStore.setState(initialState, true);
});

test('fetch loads the area and the names of pets and spots once', async () => {
  const calls = mockFetch({
    'GET /announcements': () =>
      json(200, {
        announcements: [
          announcement(),
          announcement({ id: 'a2', pet_id: 'p1' }),
          announcement({
            id: 'a3',
            spot_id: null,
            custom_point: { lat: 47.91, lng: 33.38 },
          }),
        ],
      }),
    'GET /pets/p9': () => json(200, { ...myPet, id: 'p9', name: 'Шарик' }),
    'GET /walkspots/s1': () => json(200, spot),
  });

  await useAnnouncementsStore.getState().fetchAnnouncements(center);
  await flush();

  const state = useAnnouncementsStore.getState();
  expect(state.status).toBe('success');
  expect(state.announcements.map(item => item.id)).toEqual(['a1', 'a2', 'a3']);
  expect(state.petNames).toEqual({ p9: 'Шарик' });
  expect(state.spots).toEqual({
    s1: { name: 'Площадка у парка', lat: 47.9055, lng: 33.3905 },
  });
  expect(calls[0]?.path).toBe('/announcements');
  // Own pets are known; each other pet and spot is asked for once.
  expect(calls.map(call => call.path).sort()).toEqual([
    '/announcements',
    '/pets/p9',
    '/walkspots/s1',
  ]);
});

test('a failed fetch keeps the list and reports the error', async () => {
  useAnnouncementsStore.setState({ announcements: [announcement()] });
  mockFetch({
    'GET /announcements': () => json(500, { msg: 'x', error: 'boom' }),
  });

  await useAnnouncementsStore.getState().fetchAnnouncements(center);

  const state = useAnnouncementsStore.getState();
  expect(state.status).toBe('error');
  expect(state.error).toBe('Ошибка сервера, попробуйте позже');
  expect(state.announcements).toHaveLength(1);
});

test('createAnnouncement posts one place and puts the walk first', async () => {
  const created = announcement({ id: 'new', pet_id: 'p1' });
  const calls = mockFetch({
    'GET /announcements': () =>
      json(200, {
        announcements: [
          announcement({
            pet_id: 'p1',
            spot_id: null,
            custom_point: { lat: 47.91, lng: 33.39 },
          }),
        ],
      }),
    'POST /announcements': () => json(201, created),
  });
  await useAnnouncementsStore.getState().fetchAnnouncements(center);

  const result = await useAnnouncementsStore.getState().createAnnouncement({
    petId: 'p1',
    startsAt: new Date(created.starts_at),
    durationMin: 60,
    place: {
      kind: 'spot',
      spot: { id: 's1', name: 'Площадка у парка', lat: 47.9055, lng: 33.3905 },
    },
  });

  expect(result).toEqual(created);
  const post = calls.find(call => call.method === 'POST');
  expect(post?.headers.Authorization).toBe('Bearer access');
  expect(post?.body).toEqual({
    pet_id: 'p1',
    spot_id: 's1',
    starts_at: created.starts_at,
    duration_min: 60,
  });
  const state = useAnnouncementsStore.getState();
  expect(state.announcements.map(item => item.id)).toEqual(['new', 'a1']);
  // The chosen spot's name is known without asking the backend.
  expect(state.spots.s1?.name).toBe('Площадка у парка');
  expect(calls.some(call => call.path === '/walkspots/s1')).toBe(false);
});

test('createAnnouncement rejects with the backend error and leaves the list', async () => {
  mockFetch({
    'POST /announcements': () =>
      json(400, { msg: 'x', error: 'starts_at must be ...: invalid argument' }),
  });

  await expect(
    useAnnouncementsStore.getState().createAnnouncement({
      petId: 'p1',
      startsAt: new Date(),
      durationMin: 60,
      place: { kind: 'point', point: center },
    }),
  ).rejects.toMatchObject({ status: 400 });
  expect(useAnnouncementsStore.getState().announcements).toEqual([]);
});

describe('applyAnnouncementCreated (live updates)', () => {
  beforeEach(async () => {
    mockFetch({
      'GET /announcements': () =>
        json(200, { announcements: [announcement()] }),
      'GET /pets/p9': () => json(200, { ...myPet, id: 'p9', name: 'Шарик' }),
      'GET /pets/p7': () => json(200, { ...myPet, id: 'p7', name: 'Рекс' }),
      'GET /walkspots/s1': () => json(200, spot),
      'GET /walkspots/far': () =>
        json(200, { ...spot, id: 'far', lat: 48.5, lng: 35.0 }),
    });
    await useAnnouncementsStore.getState().fetchAnnouncements(center);
    await flush();
  });

  const ids = () =>
    useAnnouncementsStore.getState().announcements.map(item => item.id);

  test('adds a nearby walk on top and loads its pet name', async () => {
    useAnnouncementsStore.getState().applyAnnouncementCreated(
      announcement({
        id: 'live',
        pet_id: 'p7',
        spot_id: null,
        custom_point: { lat: 47.91, lng: 33.39 },
      }),
    );
    await flush();
    await flush();

    expect(ids()).toEqual(['live', 'a1']);
    expect(useAnnouncementsStore.getState().petNames.p7).toBe('Рекс');
  });

  test('a spot walk is placed by its spot (known or loaded)', async () => {
    useAnnouncementsStore
      .getState()
      .applyAnnouncementCreated(announcement({ id: 'near', spot_id: 's1' }));
    useAnnouncementsStore
      .getState()
      .applyAnnouncementCreated(announcement({ id: 'far', spot_id: 'far' }));
    await flush();
    await flush();

    expect(ids()).toEqual(['near', 'a1']);
  });

  test('ignores walks outside the area, over or not active; dedupes by id', async () => {
    const apply = useAnnouncementsStore.getState().applyAnnouncementCreated;
    apply(
      announcement({
        id: 'far',
        spot_id: null,
        custom_point: { lat: 48.5, lng: 35.0 },
      }),
    );
    apply(
      announcement({
        id: 'over',
        starts_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
      }),
    );
    apply(announcement({ id: 'cancelled', status: 'cancelled' }));
    apply(announcement({ id: 'a1', duration_min: 90 }));
    await flush();

    expect(ids()).toEqual(['a1']);
    expect(
      useAnnouncementsStore.getState().announcements[0]?.duration_min,
    ).toBe(90);
  });
});

test('logging out forgets the list', async () => {
  mockFetch({
    'GET /announcements': () => json(200, { announcements: [announcement()] }),
  });
  await useAnnouncementsStore.getState().fetchAnnouncements(center);
  expect(useAnnouncementsStore.getState().announcements).toHaveLength(1);

  await useAuthStore.getState().logout();

  const state = useAnnouncementsStore.getState();
  expect(state.announcements).toEqual([]);
  expect(state.query).toBeNull();
  expect(state.status).toBe('idle');
});
