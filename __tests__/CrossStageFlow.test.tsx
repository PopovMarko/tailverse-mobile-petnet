/**
 * One session through every stage against a fake backend and a fake presence
 * socket: login (2) → map with a live spot_update and a check-in (3, 7) →
 * «Куда пойти» starts a walk at that spot (6 → 4) → a walk announced by someone
 * else arrives live (7) → a post tagged with the checked-in spot (5) → logout
 * clears every per-user store (2).
 *
 * @format
 */

import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import * as Keychain from 'react-native-keychain';
import * as Permissions from 'react-native-permissions';
import ReactTestRenderer from 'react-test-renderer';

import App from '../src/App';
import { loadTokens } from '../src/services/tokenStorage';
import { useAnnouncementsStore } from '../src/store/announcementsStore';
import { useAuthStore } from '../src/store/authStore';
import { useFeedStore } from '../src/store/feedStore';
import { useLocationStore } from '../src/store/locationStore';
import { useRealtimeStore } from '../src/store/realtimeStore';
import { useWalkSpotsStore } from '../src/store/walkSpotsStore';
import type {
  Announcement,
  CheckInResponse,
  Owner,
  Pet,
  Post,
  WalkSpot,
} from '../src/types';
import { DEFAULT_REGION } from '../src/utils/geo';
import { FakeWebSocket } from '../test-utils/fakeWebSocket';
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

const bublik: Pet = {
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

const sharik: Pet = { ...bublik, id: 'p9', owner_id: 'o9', name: 'Шарик' };

// A walk spot in the centre of Kryvyi Rih, where the map starts without location access.
const park: WalkSpot = {
  id: 's1',
  name: 'Площадка у парка',
  lat: DEFAULT_REGION.latitude + 0.002,
  lng: DEFAULT_REGION.longitude + 0.002,
  tags: [],
  present_count: 1,
};

let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.restoreAllMocks();
  (Keychain as unknown as { __resetKeychain: () => void }).__resetKeychain();
  // Location access not decided: the app must work without it.
  jest.mocked(Permissions.check).mockResolvedValue(Permissions.RESULTS.DENIED);
  FakeWebSocket.reset();
});

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
  useRealtimeStore.getState().disable();
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
  for (let i = 0; i < 5; i++) {
    await ReactTestRenderer.act(async () => {
      await Promise.resolve();
    });
  }
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
    await target.props.onPress({ preventDefault() {} });
  });
  await settle();
}

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

async function pressMarker(id: string) {
  const marker = renderer!.root.find(
    node =>
      node.props.identifier === id && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    await marker.props.onPress();
  });
  await settle();
}

function markerCount(id: string): number {
  const marker = renderer!.root.find(node => node.props.identifier === id);
  const label = marker
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''))
    .join('');
  return Number(label.replace(/\D/g, ''));
}

async function type(label: string, value: string) {
  const input = renderer!.root
    .findAllByType(TextInput)
    .filter(node => node.props.accessibilityLabel === label)
    .pop();
  if (!input) {
    throw new Error(`No input "${label}"`);
  }
  await ReactTestRenderer.act(() => input.props.onChangeText(value));
}

/** The fake backend: one owner with one pet, one walk spot, walks and posts kept in memory. */
function backend() {
  let present = 1;
  const announcements: Announcement[] = [];
  const posts: Post[] = [];
  const calls = mockFetch({
    'POST /auth/login': () =>
      json(200, { access_token: 'access', refresh_token: 'refresh' }),
    'GET /owners/me': () => json(200, owner),
    'GET /pets': () => json(200, { pets: [bublik] }),
    'GET /pets/p9': () => json(200, sharik),
    'GET /walkspots': () =>
      json(200, { spots: [{ ...park, present_count: present }] }),
    'GET /walkspots/s1': () =>
      json(200, {
        ...park,
        present: [
          {
            pet_id: 'p9',
            pet_name: 'Шарик',
            owner_nickname: 'olga',
            checked_in_at: new Date().toISOString(),
          },
          ...(present > 2
            ? [
                {
                  pet_id: 'p1',
                  pet_name: 'Бублик',
                  owner_nickname: 'marko',
                  checked_in_at: new Date().toISOString(),
                },
              ]
            : []),
        ].slice(0, present),
      }),
    'POST /walkspots/s1/checkin': () => {
      present = 3;
      const now = Date.now();
      const entry: CheckInResponse = {
        spot_id: 's1',
        pet_id: 'p1',
        checked_in_at: new Date(now).toISOString(),
        expires_at: new Date(now + 2 * 3600_000).toISOString(),
      };
      return json(200, entry);
    },
    'GET /announcements': () => json(200, { announcements }),
    'POST /announcements': call => {
      const body = call.body as Pick<
        Announcement,
        'pet_id' | 'starts_at' | 'duration_min'
      > & { spot_id: string };
      const created: Announcement = {
        id: 'mine',
        pet_id: body.pet_id,
        spot_id: body.spot_id,
        custom_point: null,
        starts_at: body.starts_at,
        duration_min: body.duration_min,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      announcements.unshift(created);
      return json(201, created);
    },
    'GET /posts': () => json(200, { posts, next_cursor: null }),
    'POST /posts': call => {
      const body = call.body as {
        pet_id: string;
        spot_id?: string;
        text: string;
      };
      const created: Post = {
        id: 'post1',
        pet_id: body.pet_id,
        spot_id: body.spot_id ?? null,
        text: body.text,
        photo_urls: [],
        created_at: new Date().toISOString(),
      };
      posts.unshift(created);
      return json(201, created);
    },
  });
  return calls;
}

test('one session through every stage, and logout forgets all of it', async () => {
  const calls = backend();
  const sent = (method: string, path: string) =>
    calls.filter(call => call.method === method && call.path === path);

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await settle();

  // Stage 2: email + password login is the entry point.
  expect(hasText('Войти')).toBe(true);
  await type('Email', ' owner@example.com ');
  await type('Пароль', 'secret123');
  await press('Войти');
  expect(sent('POST', '/auth/login')[0]?.body).toEqual({
    email: 'owner@example.com',
    password: 'secret123',
  });
  expect(await loadTokens()).toEqual({
    access_token: 'access',
    refresh_token: 'refresh',
  });
  expect(sent('GET', '/pets')[0]?.headers.Authorization).toBe('Bearer access');

  // Stage 3: the map starts on Kryvyi Rih without location access and shows the spot.
  expect(hasText('Показать места рядом с вами?')).toBe(true);
  expect(markerCount('s1')).toBe(1);

  // Stage 7: the map opened the presence socket; updates go straight to the marker.
  const socket = FakeWebSocket.last();
  expect(socket.url).toMatch(/^ws:\/\/.+\/ws\/presence$/);
  expect(socket.headers.Authorization).toBe('Bearer access');
  await ReactTestRenderer.act(() => socket.open());
  const listRequests = sent('GET', '/walkspots').length;
  await ReactTestRenderer.act(() =>
    socket.receive({ type: 'spot_update', spot_id: 's1', present_count: 2 }),
  );
  expect(markerCount('s1')).toBe(2);
  expect(sent('GET', '/walkspots')).toHaveLength(listRequests);

  // Stage 3: who is there, then check in with the pet.
  await pressMarker('s1');
  expect(hasText('Шарик')).toBe(true);
  await press('Я здесь с Бублик');
  expect(sent('POST', '/walkspots/s1/checkin')[0]?.body).toEqual({
    pet_id: 'p1',
  });
  expect(useWalkSpotsStore.getState().myCheckIns.p1?.spot_id).toBe('s1');
  expect(markerCount('s1')).toBe(3);
  await press('Закрыть');

  // Stage 6 → 4: «Куда пойти» suggests the spot and starts a walk there.
  await pressTab('Куда пойти');
  expect(hasText('от центра Кривого Рога')).toBe(true);
  await press('Площадка у парка');
  await press('Иду гулять сюда: Площадка у парка');
  expect(hasText('Площадка у парка')).toBe(true);
  await press('Объявить прогулку');
  const created = sent('POST', '/announcements')[0]?.body;
  expect(created).toMatchObject({ pet_id: 'p1', spot_id: 's1' });
  expect(created).not.toHaveProperty('custom_point');
  // Back on the walks list with the new walk.
  expect(hasText('Объявить прогулку')).toBe(false);
  expect(hasText('Создать объявление')).toBe(true);
  expect(useAnnouncementsStore.getState().announcements[0]?.id).toBe('mine');

  // Stage 7: someone else's walk nearby arrives live and is listed as is.
  const theirs: Announcement = {
    id: 'theirs',
    pet_id: 'p9',
    spot_id: null,
    custom_point: { lat: park.lat, lng: park.lng },
    starts_at: new Date(Date.now() + 3600_000).toISOString(),
    duration_min: 30,
    status: 'active',
    created_at: new Date().toISOString(),
  };
  // The walk is placed only after its spot is known, which is asynchronous.
  await ReactTestRenderer.act(async () => {
    socket.receive({ type: 'announcement_created', announcement: theirs });
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  });
  await settle();
  expect(
    useAnnouncementsStore.getState().announcements.map(item => item.id),
  ).toEqual(['theirs', 'mine']);
  expect(hasText('Шарик')).toBe(true);

  // Stage 5: a post is tagged with the spot the pet is checked in at.
  await pressTab('Лента');
  expect(hasText('Пока нет постов')).toBe(true);
  await press('Написать пост');
  expect(hasText('Площадка у парка')).toBe(true);
  await type('Как прошла прогулка', 'Гуляли у парка');
  await press('Опубликовать');
  expect(sent('POST', '/posts')[0]?.body).toEqual({
    pet_id: 'p1',
    spot_id: 's1',
    text: 'Гуляли у парка',
  });
  expect(hasText('Гуляли у парка')).toBe(true);
  expect(useFeedStore.getState().posts.map(post => post.id)).toEqual(['post1']);

  // Stage 2: logout from the profile forgets everything of this session.
  await ReactTestRenderer.act(() =>
    useLocationStore.getState().setManualPoint({ lat: 47.9, lng: 33.4 }),
  );
  jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) =>
      buttons?.find(button => button.text === 'Выйти')?.onPress?.(),
    );
  await press('Мой профиль');
  await press('Выйти');

  expect(hasText('Войти')).toBe(true);
  expect(useAuthStore.getState()).toMatchObject({
    status: 'signedOut',
    accessToken: null,
    refreshToken: null,
    owner: null,
    pets: [],
  });
  expect(await loadTokens()).toBeNull();
  expect(useWalkSpotsStore.getState()).toMatchObject({
    spots: [],
    myCheckIns: {},
    selectedSpotId: null,
  });
  expect(useAnnouncementsStore.getState()).toMatchObject({
    announcements: [],
    query: null,
    petNames: {},
    spots: {},
  });
  expect(useFeedStore.getState()).toMatchObject({
    posts: [],
    petNames: {},
    spots: {},
    spotId: null,
  });
  expect(useLocationStore.getState().manualPoint).toBeNull();
  expect(useRealtimeStore.getState()).toMatchObject({
    enabled: false,
    status: 'idle',
  });
  expect(socket.closedWith?.code).toBe(1000);
  expect(FakeWebSocket.live()).toHaveLength(0);
});
