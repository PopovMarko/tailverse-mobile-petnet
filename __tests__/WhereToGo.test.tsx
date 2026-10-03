/**
 * @format
 */

import Geolocation from '@react-native-community/geolocation';
import React from 'react';
import { Text } from 'react-native';
import * as Keychain from 'react-native-keychain';
import * as Permissions from 'react-native-permissions';
import ReactTestRenderer from 'react-test-renderer';

import App from '../src/App';
import { WhereToGoScreen } from '../src/screens/WhereToGoScreen';
import { saveTokens } from '../src/services/tokenStorage';
import { useAuthStore } from '../src/store/authStore';
import { useLocationStore } from '../src/store/locationStore';
import { useWalkSpotsStore } from '../src/store/walkSpotsStore';
import type { Announcement, Owner, Pet, WalkSpot } from '../src/types';
import { json, mockFetch, type MockRoute } from '../test-utils/mockFetch';

const checkMock = jest.mocked(Permissions.check);
const requestMock = jest.mocked(Permissions.request);
const positionMock = jest.mocked(Geolocation.getCurrentPosition);

const here = { lat: 47.9056, lng: 33.3906 };

const owner: Owner = {
  id: 'o1',
  email: 'owner@example.com',
  nickname: 'marko',
  gender: null,
  avatar_url: null,
  visibility: { gender: false, avatar_url: true },
  created_at: '2026-10-03T10:00:00Z',
};

const bublik: Pet = {
  id: 'p1',
  owner_id: 'o1',
  name: 'Бублик',
  breed: 'корги',
  species: 'dog',
  birth_date: null,
  age: null,
  approx_address: 'Хамовники',
  created_at: '2026-10-03T10:00:00Z',
};

// Distances from `here`: park ~ 0 m, square ~ 1.1 km, forest ~ 3.3 km.
const park: WalkSpot = {
  id: 's1',
  name: 'Площадка у парка',
  lat: 47.905549,
  lng: 33.390509,
  tags: ['огорожено'],
  present_count: 0,
};
const square: WalkSpot = {
  id: 's2',
  name: 'Сквер',
  lat: 47.9156,
  lng: 33.3906,
  tags: [],
  present_count: 3,
};
const forest: WalkSpot = {
  id: 's3',
  name: 'Лесополоса',
  lat: 47.9356,
  lng: 33.3906,
  tags: [],
  present_count: 1,
};

function walkAt(spotId: string, id: string): Announcement {
  return {
    id,
    pet_id: 'p9',
    spot_id: spotId,
    custom_point: null,
    starts_at: new Date(Date.now() + 3600_000).toISOString(),
    duration_min: 60,
    status: 'active',
    created_at: new Date().toISOString(),
  };
}

const routes: Record<string, MockRoute> = {
  'GET /walkspots': () => json(200, { spots: [forest, park, square] }),
  'GET /announcements': () =>
    json(200, {
      announcements: [walkAt('s3', 'a1'), walkAt('s3', 'a2')],
    }),
};

const initialAuth = useAuthStore.getState();
const initialLocation = useLocationStore.getState();
const initialSpots = useWalkSpotsStore.getState();
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  (Keychain as unknown as { __resetKeychain: () => void }).__resetKeychain();
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
      owner,
      pets: [bublik],
    },
    true,
  );
  useLocationStore.setState(initialLocation, true);
  useWalkSpotsStore.getState().reset();
  useWalkSpotsStore.setState(initialSpots, true);
});

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
});

function fakeNavigation() {
  return { navigate: jest.fn() };
}

async function settle() {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
}

async function renderScreen(navigation = fakeNavigation()) {
  const props = {
    navigation,
    route: { key: 'WhereToGo', name: 'WhereToGo' },
  } as unknown as React.ComponentProps<typeof WhereToGoScreen>;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<WhereToGoScreen {...props} />);
  });
  await settle();
  return navigation;
}

function texts(): string[] {
  return renderer!.root
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''));
}

function hasText(fragment: string): boolean {
  return texts().some(text => text.includes(fragment));
}

/** Spot names in the order they are listed. */
function listedSpots(): string[] {
  return texts()
    .filter(text => text.startsWith('📍 '))
    .map(text => text.slice(3));
}

async function press(label: string) {
  const target = renderer!.root
    .findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )
    .pop();
  if (!target) {
    throw new Error(`No button "${label}"`);
  }
  await ReactTestRenderer.act(async () => {
    await target.props.onPress({ preventDefault() {} });
  });
  await settle();
}

describe('without location access', () => {
  test('suggests spots around the city centre and says so; never prompts', async () => {
    const calls = mockFetch(routes);
    await renderScreen();

    const spotsCall = calls.find(call => call.path === '/walkspots');
    expect(spotsCall?.query).toEqual({
      lat: '47.9106',
      lng: '33.3436',
      radius_m: '5000',
    });
    const walksCall = calls.find(call => call.path === '/announcements');
    expect(walksCall?.query).toMatchObject({ radius_m: '5000' });
    expect(walksCall?.query.to).toBeDefined();

    expect(hasText('от центра Кривого Рога')).toBe(true);
    expect(hasText('Район из профиля («Хамовники»)')).toBe(true);
    expect(hasText('Подобрать места рядом с вами?')).toBe(true);
    expect(requestMock).not.toHaveBeenCalled();
  });

  test('"Разрешить" asks once, then suggests from the user position', async () => {
    const calls = mockFetch(routes);
    await renderScreen();

    await press('Разрешить');

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(hasText('от вашего местоположения')).toBe(true);
    expect(
      calls.filter(call => call.path === '/walkspots').pop()?.query,
    ).toEqual({
      lat: String(here.lat),
      lng: String(here.lng),
      radius_m: '5000',
    });
    expect(hasText('Подобрать места рядом с вами?')).toBe(false);
  });

  test('the place picked on the map is used before the city centre', async () => {
    useLocationStore.setState({ manualPoint: { lat: 47.95, lng: 33.4 } });
    const calls = mockFetch(routes);
    await renderScreen();

    expect(hasText('от места, выбранного на карте')).toBe(true);
    expect(calls.find(call => call.path === '/walkspots')?.query).toMatchObject(
      {
        lat: '47.95',
        lng: '33.4',
      },
    );

    // The city centre can still be chosen by hand.
    await press('Центр города');
    expect(hasText('от центра Кривого Рога')).toBe(true);
    expect(
      calls.filter(call => call.path === '/walkspots').pop()?.query,
    ).toMatchObject({ lat: '47.9106' });
  });
});

describe('with location access', () => {
  beforeEach(() => {
    checkMock.mockResolvedValue(Permissions.RESULTS.GRANTED);
  });

  test('lists spots closest first, with who is there and upcoming walks', async () => {
    mockFetch(routes);
    await renderScreen();

    expect(hasText('от вашего местоположения')).toBe(true);
    expect(hasText('Подобрать места рядом с вами?')).toBe(false);
    expect(listedSpots()).toEqual(['Площадка у парка', 'Сквер', 'Лесополоса']);
    expect(hasText('1,1 км')).toBe(true);
    expect(hasText('Сейчас гуляют: 3')).toBe(true);
    expect(hasText('2 прогулки в ближайшие сутки')).toBe(true);
    expect(hasText('огорожено')).toBe(true);

    await press('Сейчас гуляют');
    expect(listedSpots()).toEqual(['Сквер', 'Лесополоса', 'Площадка у парка']);
  });

  test('a spot leads to the walk form, the map and its posts', async () => {
    mockFetch(routes);
    const navigation = await renderScreen();

    await press('Сквер');
    await press('Иду гулять сюда: Сквер');
    expect(navigation.navigate).toHaveBeenLastCalledWith('CreateAnnouncement', {
      spot: {
        id: 's2',
        name: 'Сквер',
        lat: square.lat,
        lng: square.lng,
        distance_m: 1112,
      },
    });

    await press('На карте: Сквер');
    expect(navigation.navigate).toHaveBeenLastCalledWith('Map', {
      focusSpot: { id: 's2', name: 'Сквер', lat: square.lat, lng: square.lng },
    });

    await press('Посты об этом месте: Сквер');
    expect(navigation.navigate).toHaveBeenLastCalledWith('Feed', {
      spot: { id: 's2', name: 'Сквер', lat: square.lat, lng: square.lng },
    });
  });

  test('works without the walks when they fail to load', async () => {
    mockFetch({
      'GET /walkspots': routes['GET /walkspots']!,
      'GET /announcements': () => json(500, { msg: 'x', error: 'boom' }),
    });
    await renderScreen();

    expect(listedSpots()).toHaveLength(3);
    expect(hasText('в ближайшие сутки')).toBe(false);
  });

  test('a load error offers a retry; an empty area says so', async () => {
    let reply = json(500, { msg: 'x', error: 'boom' });
    mockFetch({
      'GET /walkspots': () => reply,
      'GET /announcements': () => json(200, { announcements: [] }),
    });
    await renderScreen();

    expect(hasText('Не удалось загрузить места')).toBe(true);

    reply = json(200, { spots: [] });
    await press('Повторить');

    expect(hasText('Поблизости пока нет мест для выгула')).toBe(true);
  });
});

test('in the app, «На карте» opens the spot on the Map tab', async () => {
  checkMock.mockResolvedValue(Permissions.RESULTS.GRANTED);
  useAuthStore.setState(initialAuth, true);
  await saveTokens({ access_token: 'access', refresh_token: 'refresh' });
  jest.useFakeTimers();
  const calls = mockFetch({
    ...routes,
    'GET /owners/me': () => json(200, owner),
    'GET /pets': () => json(200, { pets: [bublik] }),
    'GET /walkspots/s2': () => json(200, { ...square, present: [] }),
  });
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  const tab = renderer!.root
    .findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        node
          .findAllByType(Text)
          .some(text => text.props.children === 'Куда пойти'),
    )
    .pop()!;
  await ReactTestRenderer.act(async () => {
    tab.props.onPress({ preventDefault() {} });
  });
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });
  expect(hasText('Площадка у парка')).toBe(true);

  for (const label of ['Сквер', 'На карте: Сквер']) {
    const target = renderer!.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )
      .pop()!;
    await ReactTestRenderer.act(async () => {
      await target.props.onPress();
    });
  }
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(calls.some(call => call.path === '/walkspots/s2')).toBe(true);
  expect(useWalkSpotsStore.getState().selectedSpotId).toBe('s2');
  expect(hasText('Сейчас здесь: 0')).toBe(true);
});
