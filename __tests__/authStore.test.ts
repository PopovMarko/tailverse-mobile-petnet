import * as Keychain from 'react-native-keychain';

import { loadTokens, saveTokens } from '../src/services/tokenStorage';
import { useAuthStore } from '../src/store/authStore';
import type { Owner, Pet } from '../src/types';
import { json, mockFetch, unauthorized } from '../test-utils/mockFetch';

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
  birth_date: '2022-05-01',
  age: 4,
  approx_address: 'Хамовники',
  created_at: '2026-10-03T10:00:00Z',
};

const tokens = (n: number) => ({
  access_token: `access-${n}`,
  refresh_token: `refresh-${n}`,
});

const bearer = (n: number) => `Bearer access-${n}`;

const initialState = useAuthStore.getState();

beforeEach(() => {
  jest.restoreAllMocks();
  (Keychain as unknown as { __resetKeychain: () => void }).__resetKeychain();
  useAuthStore.setState(initialState, true);
});

describe('login', () => {
  test('stores the tokens and loads the account', async () => {
    const calls = mockFetch({
      'POST /auth/login': () => json(200, tokens(1)),
      'GET /owners/me': () => json(200, owner),
      'GET /pets': () => json(200, { pets: [pet] }),
    });

    await useAuthStore.getState().login(' owner@example.com ', 'secret123');

    const state = useAuthStore.getState();
    expect(state.status).toBe('signedIn');
    expect(state.owner).toEqual(owner);
    expect(state.pets).toEqual([pet]);
    expect(state.needsOnboarding).toBe(false);
    expect(state.accessToken).toBe('access-1');
    expect(await loadTokens()).toEqual(tokens(1));
    expect(calls[0]?.body).toEqual({
      email: 'owner@example.com',
      password: 'secret123',
    });
    expect(calls[1]?.headers.Authorization).toBe(bearer(1));
  });

  test('an owner without pets goes to onboarding', async () => {
    mockFetch({
      'POST /auth/login': () => json(200, tokens(1)),
      'GET /owners/me': () => json(200, owner),
      'GET /pets': () => json(200, { pets: [] }),
    });

    await useAuthStore.getState().login('owner@example.com', 'secret123');

    expect(useAuthStore.getState().needsOnboarding).toBe(true);
  });

  test('wrong credentials reject with 401 and keep the user signed out', async () => {
    mockFetch({
      'POST /auth/login': () =>
        json(401, { msg: 'Login', error: 'invalid email or password' }),
    });

    await expect(
      useAuthStore.getState().login('owner@example.com', 'wrong-pass'),
    ).rejects.toMatchObject({ status: 401 });

    expect(useAuthStore.getState().status).toBe('restoring');
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(await loadTokens()).toBeNull();
  });
});

describe('register', () => {
  const input = {
    email: 'new@example.com',
    password: 'secret123',
    nickname: ' marko ',
    gender: 'male' as const,
    visibility: { gender: true, avatar_url: false },
    avatar: null,
  };

  test('creates the account and starts pet onboarding', async () => {
    const calls = mockFetch({
      'POST /auth/register': () =>
        json(201, {
          owner_id: 'o1',
          email: 'new@example.com',
          nickname: 'marko',
          ...tokens(1),
        }),
      'GET /owners/me': () => json(200, owner),
    });

    const result = await useAuthStore.getState().register(input);

    expect(result).toEqual({ avatarUploaded: true });
    expect(calls[0]?.body).toEqual({
      email: 'new@example.com',
      password: 'secret123',
      nickname: 'marko',
      gender: 'male',
      visibility: { gender: true, avatar_url: false },
    });
    const state = useAuthStore.getState();
    expect(state.status).toBe('signedIn');
    expect(state.needsOnboarding).toBe(true);
    expect(state.owner).toEqual(owner);
    expect(await loadTokens()).toEqual(tokens(1));
  });

  test('uploads the avatar with the new token and saves its URL', async () => {
    const avatarUrl = 'http://127.0.0.1:8080/uploads/abc.jpg';
    const calls = mockFetch({
      'POST /auth/register': () =>
        json(201, { owner_id: 'o1', email: 'e', nickname: 'n', ...tokens(1) }),
      'POST /uploads': () => json(201, { url: avatarUrl }),
      'PATCH /owners/me': () => json(200, { ...owner, avatar_url: avatarUrl }),
    });

    const result = await useAuthStore.getState().register({
      ...input,
      avatar: { uri: 'file:///tmp/a.jpg', type: 'image/jpeg', name: 'a.jpg' },
    });

    expect(result.avatarUploaded).toBe(true);
    expect(calls[1]?.headers.Authorization).toBe(bearer(1));
    expect(calls[1]?.body).toBeInstanceOf(FormData);
    expect(calls[2]?.body).toEqual({ avatar_url: avatarUrl });
    expect(useAuthStore.getState().owner?.avatar_url).toBe(avatarUrl);
  });

  test('a failed avatar upload does not fail the registration', async () => {
    mockFetch({
      'POST /auth/register': () =>
        json(201, { owner_id: 'o1', email: 'e', nickname: 'n', ...tokens(1) }),
      'POST /uploads': () => json(415, { msg: 'upload', error: 'bad type' }),
      'GET /owners/me': () => json(200, owner),
    });

    const result = await useAuthStore.getState().register({
      ...input,
      avatar: { uri: 'file:///tmp/a.gif', type: 'image/gif', name: 'a.gif' },
    });

    expect(result.avatarUploaded).toBe(false);
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  test('a taken email rejects with 409', async () => {
    mockFetch({
      'POST /auth/register': () =>
        json(409, { msg: 'Register', error: 'email is already registered' }),
    });

    await expect(useAuthStore.getState().register(input)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('restoreSession', () => {
  test('without saved tokens shows the auth screens', async () => {
    const calls = mockFetch({});

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(calls).toHaveLength(0);
  });

  test('restores a saved session', async () => {
    await saveTokens(tokens(1));
    mockFetch({
      'GET /owners/me': () => json(200, owner),
      'GET /pets': () => json(200, { pets: [pet] }),
    });

    await useAuthStore.getState().restoreSession();

    const state = useAuthStore.getState();
    expect(state.status).toBe('signedIn');
    expect(state.owner).toEqual(owner);
  });

  test('refreshes an expired access token and saves the new pair', async () => {
    await saveTokens(tokens(1));
    const refreshCalls: unknown[] = [];
    mockFetch({
      'POST /auth/refresh': call => {
        refreshCalls.push(call.body);
        return json(200, tokens(2));
      },
      'GET /owners/me': call =>
        call.headers.Authorization === bearer(2)
          ? json(200, owner)
          : unauthorized,
      'GET /pets': call =>
        call.headers.Authorization === bearer(2)
          ? json(200, { pets: [pet] })
          : unauthorized,
    });

    await useAuthStore.getState().restoreSession();

    // Both parallel requests got 401 but the session was refreshed only once.
    expect(refreshCalls).toEqual([{ refresh_token: 'refresh-1' }]);
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().accessToken).toBe('access-2');
    expect(await loadTokens()).toEqual(tokens(2));
  });

  test('logs out when the refresh token is rejected', async () => {
    await saveTokens(tokens(1));
    mockFetch({
      'POST /auth/refresh': () => unauthorized,
      'GET /owners/me': () => unauthorized,
      'GET /pets': () => unauthorized,
    });

    await useAuthStore.getState().restoreSession();

    const state = useAuthStore.getState();
    expect(state.status).toBe('signedOut');
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(await loadTokens()).toBeNull();
  });

  test('keeps the session and reports the error when the server is unreachable', async () => {
    await saveTokens(tokens(1));
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Network request failed'));

    await useAuthStore.getState().restoreSession();

    const state = useAuthStore.getState();
    expect(state.status).toBe('restoring');
    expect(state.restoreError).toBe('Нет связи с сервером');
    expect(await loadTokens()).toEqual(tokens(1));
  });
});

describe('signed in', () => {
  beforeEach(async () => {
    await saveTokens(tokens(1));
    useAuthStore.setState({
      status: 'signedIn',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      owner,
      pets: [],
      needsOnboarding: true,
    });
  });

  test('addPet posts the pet and appends it', async () => {
    const calls = mockFetch({ 'POST /pets': () => json(201, pet) });
    const body = {
      name: 'Бублик',
      species: 'dog',
      breed: 'корги',
      birth_date: '2022-05-01',
      approx_address: 'Хамовники',
    };

    await expect(useAuthStore.getState().addPet(body)).resolves.toEqual(pet);

    expect(calls[0]?.body).toEqual(body);
    expect(calls[0]?.headers.Authorization).toBe(bearer(1));
    expect(useAuthStore.getState().pets).toEqual([pet]);
  });

  test('finishOnboarding needs at least one pet', () => {
    useAuthStore.getState().finishOnboarding();
    expect(useAuthStore.getState().needsOnboarding).toBe(true);

    useAuthStore.setState({ pets: [pet] });
    useAuthStore.getState().finishOnboarding();
    expect(useAuthStore.getState().needsOnboarding).toBe(false);
  });

  test('an expired session mid-use logs out when refresh fails', async () => {
    mockFetch({
      'POST /pets': () => unauthorized,
      'POST /auth/refresh': () => unauthorized,
    });

    await expect(
      useAuthStore.getState().addPet({
        name: 'x',
        breed: 'y',
        approx_address: 'z',
      }),
    ).rejects.toMatchObject({ status: 401 });

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(await loadTokens()).toBeNull();
  });

  test('logout clears memory and secure storage', async () => {
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.status).toBe('signedOut');
    expect(state.owner).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(await loadTokens()).toBeNull();
  });
});
