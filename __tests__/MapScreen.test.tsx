/**
 * @format
 */

import React from 'react';
import { Linking, Text } from 'react-native';
import MapView from 'react-native-maps';
import * as Permissions from 'react-native-permissions';
import ReactTestRenderer from 'react-test-renderer';

import { MapScreen } from '../src/screens/MapScreen';
import { useAuthStore } from '../src/store/authStore';
import { useLocationStore } from '../src/store/locationStore';
import { useWalkSpotsStore } from '../src/store/walkSpotsStore';
import type { Pet, WalkSpotDetails } from '../src/types';
import { formatClock } from '../src/utils/date';
import { json, mockFetch } from '../test-utils/mockFetch';

const checkMock = jest.mocked(Permissions.check);
const requestMock = jest.mocked(Permissions.request);

const pet: Pet = {
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

const spotSummary = {
  id: 's1',
  name: 'Площадка у парка',
  lat: 47.9055,
  lng: 33.3905,
  tags: ['огорожено'],
  present_count: 1,
};

const checkedInAt = new Date(Date.now() - 25 * 60_000);

const initialAuth = useAuthStore.getState();
const initialLocation = useLocationStore.getState();
const initialSpots = useWalkSpotsStore.getState();
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.restoreAllMocks();
  checkMock.mockReset().mockResolvedValue(Permissions.RESULTS.DENIED);
  requestMock.mockReset().mockResolvedValue(Permissions.RESULTS.GRANTED);
  useAuthStore.setState(
    { ...initialAuth, status: 'signedIn', accessToken: 'access', pets: [pet] },
    true,
  );
  useLocationStore.setState(initialLocation, true);
  useWalkSpotsStore.setState(initialSpots, true);
});

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
});

/** Fake backend: one spot where "Шарик" is; Бублик can check in and out. */
function backend() {
  let present = [
    {
      pet_id: 'p9',
      pet_name: 'Шарик',
      owner_nickname: 'olga',
      checked_in_at: checkedInAt.toISOString(),
    },
  ];
  const details = (): WalkSpotDetails => ({
    id: spotSummary.id,
    name: spotSummary.name,
    lat: spotSummary.lat,
    lng: spotSummary.lng,
    tags: spotSummary.tags,
    present,
  });
  return mockFetch({
    'GET /walkspots': () =>
      json(200, {
        spots: [{ ...spotSummary, present_count: present.length }],
      }),
    'GET /walkspots/s1': () => json(200, details()),
    'POST /walkspots/s1/checkin': () => {
      const now = new Date().toISOString();
      present = [
        ...present,
        {
          pet_id: 'p1',
          pet_name: 'Бублик',
          owner_nickname: 'marko',
          checked_in_at: now,
        },
      ];
      return json(200, {
        spot_id: 's1',
        pet_id: 'p1',
        checked_in_at: now,
        expires_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
      });
    },
    'DELETE /walkspots/s1/checkin': () => {
      present = present.filter(entry => entry.pet_id !== 'p1');
      return { status: 204 };
    },
  });
}

function fakeNavigation() {
  return { navigate: jest.fn() };
}

async function renderMap(navigation = fakeNavigation()) {
  const props = {
    navigation,
    route: { key: 'Map', name: 'Map' },
  } as unknown as React.ComponentProps<typeof MapScreen>;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<MapScreen {...props} />);
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

function hasButton(label: string): boolean {
  return (
    renderer!.root.findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    ).length > 0
  );
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
    await target.props.onPress();
  });
}

async function pressMarker(id: string) {
  const marker = renderer!.root.find(
    node =>
      node.props.identifier === id && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    await marker.props.onPress();
  });
}

test('explains why location helps and asks only after "Разрешить"', async () => {
  backend();
  await renderMap();

  expect(hasText('Показать места рядом с вами?')).toBe(true);
  expect(requestMock).not.toHaveBeenCalled();

  await press('Разрешить');

  expect(requestMock).toHaveBeenCalledTimes(1);
  expect(useLocationStore.getState().permission).toBe('granted');
  expect(hasText('Показать места рядом с вами?')).toBe(false);
});

test('"Не сейчас" leaves only the 📍 button, which brings the card back', async () => {
  backend();
  await renderMap();

  await press('Не сейчас');
  expect(hasText('Показать места рядом с вами?')).toBe(false);
  expect(requestMock).not.toHaveBeenCalled();

  await press('Моё местоположение');
  expect(hasText('Показать места рядом с вами?')).toBe(true);
});

test('with access already granted there is no card at all', async () => {
  checkMock.mockResolvedValue(Permissions.RESULTS.GRANTED);
  backend();
  await renderMap();

  expect(hasText('Показать места рядом с вами?')).toBe(false);
  expect(hasButton('Разрешить')).toBe(false);
  expect(requestMock).not.toHaveBeenCalled();
});

test('when access is blocked it offers the Settings without asking again', async () => {
  checkMock.mockResolvedValue(Permissions.RESULTS.BLOCKED);
  const openSettings = jest
    .spyOn(Linking, 'openSettings')
    .mockResolvedValue(undefined);
  backend();
  await renderMap();

  expect(hasText('Карта работает и без геолокации')).toBe(true);
  expect(hasButton('Разрешить')).toBe(false);

  await press('Открыть настройки');
  expect(openSettings).toHaveBeenCalled();
});

test('long press picks a place by hand; "Сбросить" forgets it', async () => {
  backend();
  await renderMap();

  const map = renderer!.root.findByType(MapView);
  await ReactTestRenderer.act(async () => {
    map.props.onLongPress({
      nativeEvent: { coordinate: { latitude: 47.91, longitude: 33.34 } },
    });
  });

  expect(useLocationStore.getState().manualPoint).toEqual({
    lat: 47.91,
    lng: 33.34,
  });
  expect(hasText('Выбранное место')).toBe(true);

  await press('Сбросить выбранное место');
  expect(useLocationStore.getState().manualPoint).toBeNull();
  expect(hasText('Выбранное место')).toBe(false);
});

test('a marker opens the sheet with who is there; the owner checks in and out', async () => {
  const calls = backend();
  await renderMap();

  await pressMarker('s1');

  expect(hasText('Площадка у парка')).toBe(true);
  expect(hasText('Сейчас здесь: 1')).toBe(true);
  expect(hasText('Шарик')).toBe(true);
  expect(hasText(`olga · с ${formatClock(checkedInAt)} · 25 мин назад`)).toBe(
    true,
  );

  await press('Я здесь с Бублик');

  expect(calls.find(call => call.method === 'POST')?.body).toEqual({
    pet_id: 'p1',
  });
  expect(hasText('Сейчас здесь: 2')).toBe(true);
  expect(hasText('ваш питомец')).toBe(true);
  expect(useWalkSpotsStore.getState().spots[0]?.present_count).toBe(2);

  await press('Уйти: Бублик');

  const checkout = calls.find(call => call.method === 'DELETE');
  expect(checkout?.path).toBe('/walkspots/s1/checkin');
  expect(checkout?.body).toEqual({ pet_id: 'p1' });
  expect(hasText('Сейчас здесь: 1')).toBe(true);
  expect(hasButton('Я здесь с Бублик')).toBe(true);
  expect(useWalkSpotsStore.getState().spots[0]?.present_count).toBe(1);
});

test('the sheet shows an empty state when nobody is there', async () => {
  mockFetch({
    'GET /walkspots': () => json(200, { spots: [spotSummary] }),
    'GET /walkspots/s1': () =>
      json(200, { ...spotSummary, present_count: undefined, present: [] }),
  });
  await renderMap();

  await pressMarker('s1');

  expect(hasText('Сейчас здесь: 0')).toBe(true);
  expect(hasText('Пока никого нет')).toBe(true);

  await press('Закрыть');
  expect(useWalkSpotsStore.getState().selectedSpotId).toBeNull();
});

test('"Посты об этом месте" opens the feed filtered by the spot', async () => {
  backend();
  const navigation = fakeNavigation();
  await renderMap(navigation);

  await pressMarker('s1');
  await press('Посты об этом месте');

  expect(navigation.navigate).toHaveBeenCalledWith('Feed', {
    spot: {
      id: 's1',
      name: 'Площадка у парка',
      lat: spotSummary.lat,
      lng: spotSummary.lng,
    },
  });
});

test('a pet in the sheet opens its profile', async () => {
  backend();
  const navigation = fakeNavigation();
  await renderMap(navigation);

  await pressMarker('s1');
  await press('Профиль питомца Шарик');

  expect(navigation.navigate).toHaveBeenCalledWith('PetProfile', { id: 'p9' });
});

test('opened for a spot, it opens that spot once and clears the param', async () => {
  backend();
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  const props = {
    navigation,
    route: {
      key: 'Map',
      name: 'Map',
      params: {
        focusSpot: {
          id: 's1',
          name: spotSummary.name,
          lat: spotSummary.lat,
          lng: spotSummary.lng,
        },
      },
    },
  } as unknown as React.ComponentProps<typeof MapScreen>;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<MapScreen {...props} />);
  });

  expect(useWalkSpotsStore.getState().selectedSpotId).toBe('s1');
  expect(hasText('Сейчас здесь: 1')).toBe(true);
  expect(navigation.setParams).toHaveBeenCalledWith({ focusSpot: undefined });
});
