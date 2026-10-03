/**
 * @format
 */

import Geolocation from '@react-native-community/geolocation';
import React from 'react';
import { Text, TextInput } from 'react-native';
import MapView from 'react-native-maps';
import * as Permissions from 'react-native-permissions';
import ReactTestRenderer from 'react-test-renderer';

import type { RootStackScreenProps } from '../src/navigation/types';
import { GoWalkScreen } from '../src/screens/GoWalkScreen';
import { AnnouncementDetailsScreen } from '../src/screens/announcements/AnnouncementDetailsScreen';
import { CreateAnnouncementScreen } from '../src/screens/announcements/CreateAnnouncementScreen';
import { PickWalkPointScreen } from '../src/screens/announcements/PickWalkPointScreen';
import { useAnnouncementsStore } from '../src/store/announcementsStore';
import { useAuthStore } from '../src/store/authStore';
import { useLocationStore } from '../src/store/locationStore';
import type { Announcement, AnnouncementDetails, Pet } from '../src/types';
import { formatClock } from '../src/utils/date';
import { json, mockFetch, type MockRoute } from '../test-utils/mockFetch';

const checkMock = jest.mocked(Permissions.check);
const requestMock = jest.mocked(Permissions.request);
const positionMock = jest.mocked(Geolocation.getCurrentPosition);

const here = { lat: 47.9056, lng: 33.3906 };

function makePet(id: string, name: string, ownerId = 'o1'): Pet {
  return {
    id,
    owner_id: ownerId,
    name,
    breed: 'корги',
    species: 'dog',
    birth_date: null,
    age: null,
    approx_address: 'Центр',
    created_at: '2026-10-03T10:00:00Z',
  };
}

const bublik = makePet('p1', 'Бублик');
const sharik = makePet('p9', 'Шарик', 'o9');

const spot = {
  id: 's1',
  name: 'Площадка у парка',
  lat: 47.905549,
  lng: 33.390509,
  tags: [],
  present_count: 2,
};

const startsAt = new Date(Date.now() + 3 * 3600_000);
startsAt.setSeconds(0, 0);

function walk(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    pet_id: 'p9',
    spot_id: 's1',
    custom_point: null,
    starts_at: startsAt.toISOString(),
    duration_min: 90,
    status: 'active',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const commonRoutes: Record<string, MockRoute> = {
  'GET /pets/p9': () => json(200, sharik),
  'GET /walkspots/s1': () => json(200, { ...spot, present: [] }),
};

const initialAuth = useAuthStore.getState();
const initialLocation = useLocationStore.getState();
const initialAnnouncements = useAnnouncementsStore.getState();
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

function grantLocation() {
  checkMock.mockResolvedValue(Permissions.RESULTS.GRANTED);
}

beforeEach(() => {
  jest.restoreAllMocks();
  checkMock.mockReset().mockResolvedValue(Permissions.RESULTS.DENIED);
  requestMock.mockReset().mockResolvedValue(Permissions.RESULTS.GRANTED);
  positionMock.mockReset().mockImplementation(success =>
    success({
      coords: {
        latitude: here.lat,
        longitude: here.lng,
        altitude: null,
        accuracy: 10,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 0,
    }),
  );
  useAuthStore.setState(
    {
      ...initialAuth,
      status: 'signedIn',
      accessToken: 'access',
      pets: [bublik],
    },
    true,
  );
  useLocationStore.setState(initialLocation, true);
  useAnnouncementsStore.getState().reset();
  useAnnouncementsStore.setState(initialAnnouncements, true);
});

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
});

function fakeNavigation() {
  return {
    navigate: jest.fn(),
    popTo: jest.fn(),
    goBack: jest.fn(),
  };
}

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  // Background requests (names, nearby spots) settle.
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  return renderer!.root;
}

function texts(): string[] {
  return renderer!.root
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''));
}

function hasText(fragment: string): boolean {
  return texts().some(text => text.includes(fragment));
}

function findPressable(label: string) {
  return renderer!.root
    .findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )
    .pop();
}

async function press(label: string) {
  const target = findPressable(label);
  if (!target) {
    throw new Error(`No button "${label}"`);
  }
  await ReactTestRenderer.act(async () => {
    await target.props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
}

async function type(label: string, value: string) {
  const input = renderer!.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label);
  if (!input) {
    throw new Error(`No input "${label}"`);
  }
  await ReactTestRenderer.act(() => input.props.onChangeText(value));
}

describe('announcements list (the "Иду гулять" tab)', () => {
  function renderList(navigation = fakeNavigation()) {
    const props = {
      navigation,
      route: { key: 'GoWalk', name: 'GoWalk' },
    } as unknown as React.ComponentProps<typeof GoWalkScreen>;
    return render(<GoWalkScreen {...props} />);
  }

  test('shows each walk with pet, place, time, duration and status', async () => {
    const calls = mockFetch({
      ...commonRoutes,
      'GET /announcements': () =>
        json(200, {
          announcements: [
            walk(),
            walk({
              id: 'a2',
              pet_id: 'p1',
              spot_id: null,
              custom_point: { lat: 47.91, lng: 33.38 },
              starts_at: new Date(Date.now() - 10 * 60_000).toISOString(),
              duration_min: 60,
            }),
          ],
        }),
    });
    const navigation = fakeNavigation();
    await renderList(navigation);

    expect(hasText('Шарик')).toBe(true);
    expect(hasText('Площадка у парка')).toBe(true);
    expect(hasText(`${formatClock(startsAt)} · 1 ч 30 мин`)).toBe(true);
    expect(hasText('Запланирована')).toBe(true);

    expect(hasText('Бублик')).toBe(true);
    expect(hasText('ваш питомец')).toBe(true);
    expect(hasText('Точка на карте')).toBe(true);
    expect(hasText('Идёт сейчас')).toBe(true);

    // Without location the list is around the city centre.
    expect(hasText('Прогулки в радиусе 5 км от центра города')).toBe(true);
    expect(calls[0]?.path).toBe('/announcements');

    await press('Прогулка: Шарик');
    expect(navigation.navigate).toHaveBeenCalledWith('AnnouncementDetails', {
      id: 'a1',
    });
    await press('Создать объявление');
    expect(navigation.navigate).toHaveBeenCalledWith('CreateAnnouncement');
  });

  test('looks around the user when location is granted', async () => {
    grantLocation();
    const urls: string[] = [];
    mockFetch({
      'GET /announcements': () => json(200, { announcements: [] }),
    });
    const fetchSpy = jest.mocked(globalThis.fetch);
    await renderList();
    fetchSpy.mock.calls.forEach(([input]) => urls.push(String(input)));

    expect(hasText('Прогулки в радиусе 5 км от вас')).toBe(true);
    expect(
      urls.some(url => url.includes(`lat=${here.lat}&lng=${here.lng}`)),
    ).toBe(true);
    expect(hasText('Рядом пока никто не гуляет')).toBe(true);
  });

  test('a failed load offers a retry', async () => {
    let fail = true;
    mockFetch({
      ...commonRoutes,
      'GET /announcements': () =>
        fail
          ? json(500, { msg: 'x', error: 'db down' })
          : json(200, { announcements: [walk()] }),
    });
    await renderList();

    expect(
      hasText(
        'Не удалось загрузить прогулки: Ошибка сервера, попробуйте позже',
      ),
    ).toBe(true);

    fail = false;
    await press('Повторить');
    expect(hasText('Шарик')).toBe(true);
  });
});

describe('creating an announcement', () => {
  const created = walk({ id: 'new', pet_id: 'p1' });

  function renderCreate(
    params?: RootStackScreenProps<'CreateAnnouncement'>['route']['params'],
    navigation = fakeNavigation(),
  ) {
    const props = {
      navigation,
      route: { key: 'Create', name: 'CreateAnnouncement', params },
    } as unknown as RootStackScreenProps<'CreateAnnouncement'>;
    return render(<CreateAnnouncementScreen {...props} />);
  }

  test('a nearby spot: sends spot_id only and returns to the list with the walk on top', async () => {
    grantLocation();
    const calls = mockFetch({
      'GET /walkspots/nearby': () =>
        json(200, { spots: [{ ...spot, distance_m: 9 }] }),
      'POST /announcements': () => json(201, created),
    });
    const navigation = fakeNavigation();
    await renderCreate(undefined, navigation);

    // The only pet is preselected.
    expect(hasText('🐾 Бублик')).toBe(true);
    expect(hasText('Площадки в радиусе 500 м от вас')).toBe(true);
    expect(hasText('9 м · сейчас гуляют: 2')).toBe(true);
    const nearby = calls.find(call => call.path === '/walkspots/nearby');
    expect(nearby?.headers.Authorization).toBe('Bearer access');

    await press('Площадка у парка');
    await press('Объявить прогулку');

    const post = calls.find(call => call.method === 'POST');
    expect(post?.path).toBe('/announcements');
    expect(post?.body).toEqual({
      pet_id: 'p1',
      spot_id: 's1',
      starts_at: expect.any(String),
      duration_min: 60,
    });
    const start = Date.parse((post?.body as { starts_at: string }).starts_at);
    expect(start).toBeGreaterThanOrEqual(Date.now() - 1000);
    expect(new Date(start).getMinutes() % 15).toBe(0);

    expect(navigation.popTo).toHaveBeenCalledWith('Tabs', { screen: 'GoWalk' });
    const stored = useAnnouncementsStore.getState();
    expect(stored.announcements[0]?.id).toBe('new');
    expect(stored.spots.s1?.name).toBe('Площадка у парка');
  });

  test('a point from the map: sends custom_point only, with a custom duration', async () => {
    const calls = mockFetch({
      'POST /announcements': () => json(201, created),
    });
    const navigation = fakeNavigation();
    await renderCreate({ pickedPoint: { lat: 47.91, lng: 33.38 } }, navigation);

    expect(hasText('📌 Точка на карте')).toBe(true);
    expect(hasText('47.91000, 33.38000')).toBe(true);

    await press('Другая');
    await type('Длительность, минут', '45');
    await press('Объявить прогулку');

    const post = calls.find(call => call.method === 'POST');
    expect(post?.body).toEqual({
      pet_id: 'p1',
      custom_point: { lat: 47.91, lng: 33.38 },
      starts_at: expect.any(String),
      duration_min: 45,
    });
    expect(post?.body).not.toHaveProperty('spot_id');
    expect(navigation.popTo).toHaveBeenCalled();
  });

  test('switching to the map mode opens the picker; nothing is sent without a place', async () => {
    const calls = mockFetch({});
    const navigation = fakeNavigation();
    await renderCreate(undefined, navigation);

    await press('Объявить прогулку');
    expect(hasText('Выберите место прогулки')).toBe(true);

    await press('Точка на карте');
    await press('Выбрать точку на карте');
    expect(navigation.navigate).toHaveBeenCalledWith('PickWalkPoint', {});
    expect(calls.some(call => call.method === 'POST')).toBe(false);
  });

  test('without location access it explains and asks only on request', async () => {
    const calls = mockFetch({
      'GET /walkspots/nearby': () => json(200, { spots: [] }),
    });
    await renderCreate();

    expect(hasText('нужно ваше местоположение')).toBe(true);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);

    await press('Разрешить геолокацию');

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(calls[0]?.path).toBe('/walkspots/nearby');
    expect(hasText('В радиусе 500 м нет площадок для выгула')).toBe(true);
  });

  test('backend validation errors are shown in Russian', async () => {
    grantLocation();
    mockFetch({
      'GET /walkspots/nearby': () =>
        json(200, { spots: [{ ...spot, distance_m: 9 }] }),
      'POST /announcements': () =>
        json(400, {
          msg: 'CreateAnnouncement handler: announcement service',
          error:
            'starts_at must be between 1 hour ago and 30 days ahead: invalid argument',
        }),
    });
    const navigation = fakeNavigation();
    await renderCreate(undefined, navigation);

    await press('Площадка у парка');
    await press('Объявить прогулку');

    expect(
      hasText(
        'Время начала — не раньше чем час назад и не позже чем через 30 дней',
      ),
    ).toBe(true);
    expect(navigation.popTo).not.toHaveBeenCalled();
    expect(useAnnouncementsStore.getState().announcements).toEqual([]);
  });

  test('with several pets the owner picks one; a spot passed in is preselected', async () => {
    useAuthStore.setState({ pets: [bublik, makePet('p2', 'Муся')] });
    grantLocation();
    const calls = mockFetch({
      'GET /walkspots/nearby': () => json(200, { spots: [] }),
      'POST /announcements': () => json(201, created),
    });
    await renderCreate({
      spot: { id: 's7', name: 'Дальняя площадка', lat: 47.95, lng: 33.4 },
    });

    expect(hasText('Дальняя площадка')).toBe(true);
    await press('Объявить прогулку');
    expect(hasText('Выберите питомца')).toBe(true);

    await press('Муся');
    await press('Объявить прогулку');
    const post = calls.find(call => call.method === 'POST');
    expect(post?.body).toMatchObject({ pet_id: 'p2', spot_id: 's7' });
  });
});

describe('picking a point on the map', () => {
  test('the pin is the map centre; confirming returns it without touching the Map tab', async () => {
    useLocationStore.setState({ userPosition: here });
    const navigation = fakeNavigation();
    const props = {
      navigation,
      route: { key: 'Pick', name: 'PickWalkPoint', params: undefined },
    } as unknown as RootStackScreenProps<'PickWalkPoint'>;
    await render(<PickWalkPointScreen {...props} />);

    const map = renderer!.root.findByType(MapView);
    expect(map.props.initialRegion).toMatchObject({
      latitude: here.lat,
      longitude: here.lng,
    });
    expect(hasText('47.90560, 33.39060')).toBe(true);

    await ReactTestRenderer.act(async () => {
      map.props.onRegionChangeComplete({
        latitude: 47.912,
        longitude: 33.385,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      });
    });
    expect(hasText('47.91200, 33.38500')).toBe(true);

    await ReactTestRenderer.act(async () => {
      map.props.onLongPress({
        nativeEvent: { coordinate: { latitude: 47.92, longitude: 33.37 } },
      });
    });
    expect(hasText('47.92000, 33.37000')).toBe(true);

    await press('Выбрать эту точку');
    expect(navigation.popTo).toHaveBeenCalledWith(
      'CreateAnnouncement',
      { pickedPoint: { lat: 47.92, lng: 33.37 } },
      { merge: true },
    );
    expect(useLocationStore.getState().manualPoint).toBeNull();
  });
});

describe('walk details', () => {
  test('shows who joined; the owner joins and leaves with a pet', async () => {
    let participants: AnnouncementDetails['participants'] = [
      {
        pet_id: 'p5',
        pet_name: 'Рекс',
        owner_nickname: 'olga',
        joined_at: new Date().toISOString(),
      },
    ];
    const calls = mockFetch({
      ...commonRoutes,
      'GET /announcements/a1': () => json(200, { ...walk(), participants }),
      'POST /announcements/a1/join': () => {
        participants = [
          ...participants,
          {
            pet_id: 'p1',
            pet_name: 'Бублик',
            owner_nickname: 'marko',
            joined_at: new Date().toISOString(),
          },
        ];
        return json(200, {
          announcement_id: 'a1',
          pet_id: 'p1',
          joined_at: new Date().toISOString(),
        });
      },
      'DELETE /announcements/a1/join': () => {
        participants = participants.filter(entry => entry.pet_id !== 'p1');
        return { status: 204 };
      },
    });
    const props = {
      navigation: fakeNavigation(),
      route: {
        key: 'Details',
        name: 'AnnouncementDetails',
        params: { id: 'a1' },
      },
    } as unknown as RootStackScreenProps<'AnnouncementDetails'>;
    await render(<AnnouncementDetailsScreen {...props} />);

    expect(hasText('🐾 Шарик')).toBe(true);
    expect(hasText('Площадка у парка')).toBe(true);
    expect(hasText('Идут вместе: 1')).toBe(true);
    expect(hasText('Рекс')).toBe(true);

    await press('Пойду с Бублик');
    const join = calls.find(call => call.method === 'POST');
    expect(join?.body).toEqual({ pet_id: 'p1' });
    expect(hasText('Идут вместе: 2')).toBe(true);
    expect(hasText('Бублик')).toBe(true);
    expect(hasText('ваш питомец')).toBe(true);

    await press('Не пойду: Бублик');
    const leave = calls.find(call => call.method === 'DELETE');
    expect(leave?.path).toBe('/announcements/a1/join');
    expect(leave?.body).toEqual({ pet_id: 'p1' });
    expect(hasText('Идут вместе: 1')).toBe(true);
  });
});
