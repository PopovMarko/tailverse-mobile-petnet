/**
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import * as Keychain from 'react-native-keychain';
import MapView from 'react-native-maps';
import ReactTestRenderer from 'react-test-renderer';

import App from '../src/App';
import { saveTokens } from '../src/services/tokenStorage';
import { useAnnouncementsStore } from '../src/store/announcementsStore';
import { useAuthStore } from '../src/store/authStore';
import type { Announcement, Owner, Pet } from '../src/types';
import { json, mockFetch } from '../test-utils/mockFetch';

// React Navigation schedules timers; fake them so none fire after the test ends.
jest.useFakeTimers();

const owner: Owner = {
  id: 'o1',
  email: 'owner@example.com',
  nickname: 'marko',
  gender: null,
  avatar_url: null,
  visibility: { gender: false, avatar_url: true },
  created_at: '2026-10-03T10:00:00Z',
};

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

const initialAuth = useAuthStore.getState();
const initialAnnouncements = useAnnouncementsStore.getState();
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.restoreAllMocks();
  (Keychain as unknown as { __resetKeychain: () => void }).__resetKeychain();
  useAuthStore.setState(initialAuth, true);
  useAnnouncementsStore.getState().reset();
  useAnnouncementsStore.setState(initialAnnouncements, true);
});

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
});

function texts(): string[] {
  return renderer!.root
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''));
}

function hasText(fragment: string): boolean {
  return texts().some(text => text.includes(fragment));
}

/** Lets the fake backend's responses (and the renders they cause) finish. */
async function settle() {
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });
}

// Screens below the top of the stack stay mounted, so the last match is the visible one.
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
  await settle();
}

/** Presses the bottom tab whose title is `title`. */
async function pressTab(title: string) {
  const tab = renderer!.root
    .findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        node.findAllByType(Text).some(text => text.props.children === title),
    )
    .pop();
  if (!tab) {
    throw new Error(`No tab "${title}"`);
  }
  await ReactTestRenderer.act(async () => {
    tab.props.onPress({ preventDefault() {} });
  });
  await settle();
}

test('announce a walk at a point picked on the map, then land on the list', async () => {
  await saveTokens({ access_token: 'access', refresh_token: 'refresh' });
  let announcements: Announcement[] = [];
  const calls = mockFetch({
    'GET /owners/me': () => json(200, owner),
    'GET /pets': () => json(200, { pets: [pet] }),
    'GET /walkspots': () => json(200, { spots: [] }),
    'GET /announcements': () => json(200, { announcements }),
    'POST /announcements': call => {
      const body = call.body as {
        pet_id: string;
        custom_point: { lat: number; lng: number };
        starts_at: string;
        duration_min: number;
      };
      const created: Announcement = {
        id: 'new',
        pet_id: body.pet_id,
        spot_id: null,
        custom_point: body.custom_point,
        starts_at: body.starts_at,
        duration_min: body.duration_min,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      announcements = [created];
      return json(201, created);
    },
  });

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await settle();

  await pressTab('Иду гулять');
  expect(hasText('Рядом пока никто не гуляет')).toBe(true);

  await press('Создать объявление');
  expect(hasText('Объявить прогулку')).toBe(true);

  await press('Точка на карте');
  await press('Выбрать точку на карте');
  expect(hasText('Двигайте карту')).toBe(true);

  const map = renderer!.root.findAllByType(MapView).pop()!;
  await ReactTestRenderer.act(async () => {
    map.props.onRegionChangeComplete({
      latitude: 47.91,
      longitude: 33.38,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    });
  });
  await press('Выбрать эту точку');

  // Back on the form with the point.
  expect(hasText('47.91000, 33.38000')).toBe(true);
  expect(hasText('Двигайте карту')).toBe(false);

  await press('Объявить прогулку');

  const post = calls.find(call => call.method === 'POST');
  expect(post?.body).toMatchObject({
    pet_id: 'p1',
    custom_point: { lat: 47.91, lng: 33.38 },
    duration_min: 60,
  });
  expect(post?.body).not.toHaveProperty('spot_id');

  // The form is gone and the list shows the new walk first.
  expect(hasText('Объявить прогулку')).toBe(false);
  expect(hasText('Создать объявление')).toBe(true);
  expect(hasText('Точка на карте')).toBe(true);
  expect(hasText('Запланирована')).toBe(true);
  expect(useAnnouncementsStore.getState().announcements[0]?.id).toBe('new');
});
