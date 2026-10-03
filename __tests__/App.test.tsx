/**
 * @format
 */

import React from 'react';
import { Text, TextInput } from 'react-native';
import * as Keychain from 'react-native-keychain';
import ReactTestRenderer from 'react-test-renderer';

import App from '../src/App';
import { saveTokens } from '../src/services/tokenStorage';
import { useAuthStore } from '../src/store/authStore';
import { useRealtimeStore } from '../src/store/realtimeStore';
import type { Owner, Pet } from '../src/types';
import { FakeWebSocket } from '../test-utils/fakeWebSocket';
import { json, mockFetch, type MockRoute } from '../test-utils/mockFetch';

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
  approx_address: 'Хамовники',
  created_at: '2026-10-03T10:00:00Z',
};

const tokens = { access_token: 'access', refresh_token: 'refresh' };

// The Map tab loads walk spots on mount.
const walkSpots: Record<string, MockRoute> = {
  'GET /walkspots': () => json(200, { spots: [] }),
};

const initialState = useAuthStore.getState();
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.restoreAllMocks();
  (Keychain as unknown as { __resetKeychain: () => void }).__resetKeychain();
  useAuthStore.setState(initialState, true);
  useRealtimeStore.getState().disable();
  FakeWebSocket.reset();
});

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
});

async function renderApp() {
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
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

// Screens below the top of the stack stay mounted, so the last match is the visible one.
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

test('starts on the login screen without a saved session', async () => {
  mockFetch(walkSpots);
  await renderApp();

  expect(hasText('Tailverse')).toBe(true);
  expect(hasText('Войти')).toBe(true);
});

test('validates the login form before sending it', async () => {
  const calls = mockFetch(walkSpots);
  await renderApp();

  await press('Войти');

  expect(hasText('Введите email')).toBe(true);
  expect(hasText('Введите пароль')).toBe(true);
  expect(calls).toHaveLength(0);
});

test('shows an error for wrong credentials', async () => {
  mockFetch({
    'POST /auth/login': () =>
      json(401, { msg: 'Login', error: 'invalid email or password' }),
  });
  await renderApp();

  await type('Email', 'owner@example.com');
  await type('Пароль', 'wrong-password');
  await press('Войти');

  expect(hasText('Неверный email или пароль')).toBe(true);
});

test('logging in leads to the main tabs', async () => {
  mockFetch({
    ...walkSpots,
    'POST /auth/login': () => json(200, tokens),
    'GET /owners/me': () => json(200, owner),
    'GET /pets': () => json(200, { pets: [pet] }),
  });
  await renderApp();

  await type('Email', 'owner@example.com');
  await type('Пароль', 'secret123');
  await press('Войти');

  expect(hasText('Иду гулять')).toBe(true);
  expect(hasText('Лента')).toBe(true);
  // The header's avatar button leads to the profile (where «Выйти» is).
  expect(
    renderer!.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Мой профиль' &&
        typeof node.props.onPress === 'function',
    ).length,
  ).toBeGreaterThan(0);
  expect(hasText('Выйти')).toBe(false);
});

test('registration continues with adding a pet, then the tabs', async () => {
  const calls = mockFetch({
    ...walkSpots,
    'POST /auth/register': () =>
      json(201, {
        owner_id: 'o1',
        email: 'owner@example.com',
        nickname: 'marko',
        ...tokens,
      }),
    'GET /owners/me': () => json(200, owner),
    'POST /pets': () => json(201, pet),
  });
  await renderApp();

  await press('Зарегистрироваться');
  await type('Email', 'owner@example.com');
  await type('Пароль', 'secret123');
  await type('Никнейм', 'marko');
  await press('Создать аккаунт');

  expect(hasText('Питомец — главный герой')).toBe(true);

  await press('Сохранить питомца');
  expect(hasText('Введите кличку')).toBe(true);
  expect(hasText('Выберите вид')).toBe(true);

  await type('Кличка', 'Бублик');
  await press('Собака');
  await type('Порода', 'корги');
  await type('Район', 'Хамовники');
  await press('Сохранить питомца');

  expect(calls.find(call => call.path === '/pets')?.body).toEqual({
    name: 'Бублик',
    species: 'dog',
    breed: 'корги',
    birth_date: null,
    approx_address: 'Хамовники',
  });
  expect(hasText('Бублик')).toBe(true);

  await press('Готово');
  expect(hasText('Иду гулять')).toBe(true);
});

test('restores a saved session straight into the app', async () => {
  await saveTokens(tokens);
  mockFetch({
    ...walkSpots,
    'GET /owners/me': () => json(200, owner),
    'GET /pets': () => json(200, { pets: [pet] }),
  });

  await renderApp();

  expect(hasText('Иду гулять')).toBe(true);
});

test('the map opens one live connection that lasts until logout', async () => {
  await saveTokens(tokens);
  mockFetch({
    ...walkSpots,
    'GET /owners/me': () => json(200, owner),
    'GET /pets': () => json(200, { pets: [pet] }),
  });
  await renderApp();

  // The Map tab is focused first and connects with the session's token.
  expect(FakeWebSocket.instances).toHaveLength(1);
  const socket = FakeWebSocket.last();
  expect(socket.headers).toEqual({ Authorization: 'Bearer access' });
  await ReactTestRenderer.act(() => socket.open());
  expect(useRealtimeStore.getState().status).toBe('open');

  // Other tabs keep the same connection.
  const servicesTab = renderer!.root
    .findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        node.findAllByType(Text).some(text => text.props.children === 'Услуги'),
    )
    .pop();
  await ReactTestRenderer.act(async () => {
    servicesTab!.props.onPress({ preventDefault() {} });
  });
  expect(socket.closedWith).toBeNull();
  expect(FakeWebSocket.instances).toHaveLength(1);

  await ReactTestRenderer.act(() => useAuthStore.getState().logout());
  expect(hasText('Войти')).toBe(true);
  expect(socket.closedWith?.code).toBe(1000);
  expect(FakeWebSocket.live()).toHaveLength(0);
});
