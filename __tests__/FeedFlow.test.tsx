/**
 * @format
 */

import React from 'react';
import { Text, TextInput } from 'react-native';
import * as Keychain from 'react-native-keychain';
import ReactTestRenderer from 'react-test-renderer';

import App from '../src/App';
import { saveTokens } from '../src/services/tokenStorage';
import { useFeedStore } from '../src/store/feedStore';
import { useAuthStore } from '../src/store/authStore';
import type { Owner, Pet, Post } from '../src/types';
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
const initialFeed = useFeedStore.getState();
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.restoreAllMocks();
  (Keychain as unknown as { __resetKeychain: () => void }).__resetKeychain();
  useAuthStore.setState(initialAuth, true);
  useFeedStore.getState().reset();
  useFeedStore.setState(initialFeed, true);
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

test('write a post from the "Лента" tab, then see it on top of the feed', async () => {
  await saveTokens({ access_token: 'access', refresh_token: 'refresh' });
  let posts: Post[] = [];
  const calls = mockFetch({
    'GET /owners/me': () => json(200, owner),
    'GET /pets': () => json(200, { pets: [pet] }),
    'GET /walkspots': () => json(200, { spots: [] }),
    'GET /posts': () => json(200, { posts, next_cursor: null }),
    'POST /posts': call => {
      const body = call.body as { pet_id: string; text: string };
      const created: Post = {
        id: 'new',
        pet_id: body.pet_id,
        spot_id: null,
        text: body.text,
        photo_urls: [],
        created_at: new Date().toISOString(),
      };
      posts = [created];
      return json(201, created);
    },
  });

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await settle();

  await pressTab('Лента');
  expect(hasText('Пока нет постов')).toBe(true);

  await press('Написать пост');
  expect(hasText('Опубликовать')).toBe(true);
  // No location access and no check-in: the post has no place yet.
  expect(hasText('Без места')).toBe(true);

  await type('Как прошла прогулка', 'Первая прогулка в парке');
  await press('Опубликовать');

  expect(calls.find(call => call.method === 'POST')?.body).toEqual({
    pet_id: 'p1',
    text: 'Первая прогулка в парке',
  });
  // The form is gone and the feed shows the new post first.
  expect(hasText('Опубликовать')).toBe(false);
  expect(hasText('Написать пост')).toBe(true);
  expect(hasText('Первая прогулка в парке')).toBe(true);
  expect(hasText('только что')).toBe(true);
});
