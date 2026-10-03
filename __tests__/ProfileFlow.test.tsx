/**
 * @format
 */

import React from 'react';
import { Alert, Switch, Text, TextInput } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import * as Keychain from 'react-native-keychain';
import ReactTestRenderer from 'react-test-renderer';

import App from '../src/App';
import { saveTokens } from '../src/services/tokenStorage';
import { useAuthStore } from '../src/store/authStore';
import { useFeedStore } from '../src/store/feedStore';
import type {
  Owner,
  OwnerUpdateRequest,
  Pet,
  PetUpdateRequest,
  Post,
} from '../src/types';
import { json, mockFetch, type MockRoute } from '../test-utils/mockFetch';

// React Navigation schedules timers; fake them so none fire after the test ends.
jest.useFakeTimers();

const owner: Owner = {
  id: 'o1',
  email: 'owner@example.com',
  nickname: 'marko',
  gender: 'male',
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
  birth_date: '2022-05-01',
  age: 4,
  approx_address: 'Хамовники',
  created_at: '2026-10-03T10:00:00Z',
};

const ponchik: Pet = { ...bublik, id: 'p2', name: 'Пончик', birth_date: null };

const sharik: Pet = {
  ...bublik,
  id: 'p9',
  owner_id: 'o9',
  name: 'Шарик',
  breed: 'метис',
  approx_address: 'Центр',
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

/** Fake backend of a signed-in owner whose profile and pets can be edited. */
function backend(pets: Pet[], extra: Record<string, MockRoute> = {}) {
  let me = owner;
  let myPets = pets;
  return mockFetch({
    'GET /owners/me': () => json(200, me),
    'GET /pets': () => json(200, { pets: myPets }),
    'GET /walkspots': () => json(200, { spots: [] }),
    'PATCH /owners/me': call => {
      const body = call.body as OwnerUpdateRequest;
      me = {
        ...me,
        ...(body.nickname !== undefined ? { nickname: body.nickname } : {}),
        ...(body.gender !== undefined ? { gender: body.gender || null } : {}),
        ...(body.avatar_url !== undefined
          ? { avatar_url: body.avatar_url || null }
          : {}),
        visibility: { ...me.visibility, ...body.visibility },
      };
      return json(200, me);
    },
    ...Object.fromEntries(
      pets.flatMap(pet => [
        [
          `PATCH /pets/${pet.id}`,
          (call: { body: unknown }) => {
            const body = call.body as PetUpdateRequest;
            const updated = {
              ...myPets.find(item => item.id === pet.id)!,
              ...body,
              // Like the backend: "" removes the birth date, null keeps it.
              ...(body.birth_date === ''
                ? { birth_date: null, age: null }
                : body.birth_date === null
                ? {
                    birth_date: myPets.find(item => item.id === pet.id)!
                      .birth_date,
                  }
                : {}),
            } as Pet;
            myPets = myPets.map(item => (item.id === pet.id ? updated : item));
            return json(200, updated);
          },
        ],
        [
          `DELETE /pets/${pet.id}`,
          () => {
            myPets = myPets.filter(item => item.id !== pet.id);
            return { status: 204 };
          },
        ],
      ]),
    ),
    ...extra,
  });
}

async function renderApp() {
  await saveTokens({ access_token: 'access', refresh_token: 'refresh' });
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await settle();
}

function texts(): string[] {
  return renderer!.root
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''));
}

function hasText(fragment: string): boolean {
  return texts().some(text => text.includes(fragment));
}

async function settle() {
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });
}

// Screens below the top of the stack stay mounted, so the last match is the visible one.
function findButton(label: string) {
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
  return target;
}

async function press(label: string) {
  const target = findButton(label);
  await ReactTestRenderer.act(async () => {
    await target.props.onPress();
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

async function toggle(label: string, value: boolean) {
  const control = renderer!.root
    .findAllByType(Switch)
    .filter(node => node.props.accessibilityLabel === label)
    .pop()!;
  await ReactTestRenderer.act(() => control.props.onValueChange(value));
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

function answerAlerts(button: string) {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find(item => item.text === button)?.onPress?.();
    });
}

test('the header avatar opens the profile with who sees what', async () => {
  backend([bublik]);
  await renderApp();

  await press('Мой профиль');

  expect(hasText('owner@example.com')).toBe(true);
  expect(hasText('Мужской')).toBe(true);
  // Email and the hidden gender are private, the nickname is public.
  expect(
    texts().filter(text => text.includes('видно только вам')),
  ).toHaveLength(2);
  expect(hasText('видно всем')).toBe(true);
  expect(hasText('Бублик')).toBe(true);
  expect(hasText('Собака · корги')).toBe(true);
});

test('editing the profile sends only the changes and shows them', async () => {
  const calls = backend([bublik]);
  await renderApp();

  await press('Мой профиль');
  await press('Редактировать профиль');
  await type('Никнейм', ' marko2 ');
  await press('Не указан');
  await toggle('Показывать фото профиля', false);
  await press('Сохранить');

  const patch = calls.find(call => call.method === 'PATCH');
  expect(patch?.body).toEqual({
    nickname: 'marko2',
    gender: '',
    visibility: { avatar_url: false },
  });
  // Back on the profile with the saved data.
  expect(hasText('Редактировать профиль')).toBe(true);
  expect(useAuthStore.getState().owner?.nickname).toBe('marko2');
  expect(hasText('marko2')).toBe(true);
  expect(hasText('Не указан')).toBe(true);
});

test('a new photo is uploaded and saved; a removed one is cleared', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [
      { uri: 'file:///new.jpg', type: 'image/jpeg', fileName: 'new.jpg' },
    ],
  });
  const calls = backend([bublik], {
    'POST /uploads': () =>
      json(201, { url: 'https://cdn.example.com/new.jpg' }),
  });
  await renderApp();

  await press('Мой профиль');
  await press('Редактировать профиль');
  answerAlerts('Выбрать из галереи');
  await press('Выбрать фото профиля');
  await settle();
  await press('Сохранить');

  expect(calls.map(call => `${call.method} ${call.path}`)).toEqual(
    expect.arrayContaining(['POST /uploads', 'PATCH /owners/me']),
  );
  expect(calls.find(call => call.method === 'PATCH')?.body).toEqual({
    avatar_url: 'https://cdn.example.com/new.jpg',
  });
  expect(hasText('Есть')).toBe(true);

  await press('Редактировать профиль');
  await press('Удалить фото');
  await press('Сохранить');

  expect(calls.filter(call => call.method === 'PATCH').pop()?.body).toEqual({
    avatar_url: '',
  });
  expect(useAuthStore.getState().owner?.avatar_url).toBeNull();
});

test('an empty nickname is not sent', async () => {
  const calls = backend([bublik]);
  await renderApp();

  await press('Мой профиль');
  await press('Редактировать профиль');
  await type('Никнейм', '   ');
  await press('Сохранить');

  expect(hasText('Введите никнейм')).toBe(true);
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
});

test('a pet is edited from its profile; the only pet cannot be deleted', async () => {
  const calls = backend([bublik]);
  await renderApp();

  await press('Мой профиль');
  await press('Питомец Бублик');

  expect(hasText('Ваш питомец')).toBe(true);
  expect(hasText('Хамовники')).toBe(true);
  expect(findButton('Удалить питомца').props.accessibilityState).toMatchObject({
    disabled: true,
  });
  expect(hasText('Это ваш единственный питомец')).toBe(true);

  await press('Редактировать');
  await type('Кличка', 'Бубочка');
  await type('Район', 'Центр');
  // The saved birth date can be removed: it is sent as "".
  await press('Очистить дату');
  await press('Сохранить');

  const patch = calls.find(call => call.method === 'PATCH');
  expect(patch?.path).toBe('/pets/p1');
  expect(patch?.body).toEqual({
    name: 'Бубочка',
    approx_address: 'Центр',
    birth_date: '',
  });
  expect(hasText('🐾 Бубочка')).toBe(true);
  expect(hasText('Центр')).toBe(true);
  expect(useAuthStore.getState().pets[0]?.birth_date).toBeNull();
});

test('deleting one of two pets asks first, then returns to the profile', async () => {
  const calls = backend([bublik, ponchik]);
  await renderApp();

  await press('Мой профиль');
  await press('Питомец Пончик');
  const alert = answerAlerts('Удалить');
  await press('Удалить питомца');

  expect(alert).toHaveBeenCalledWith(
    'Удалить Пончик?',
    expect.stringContaining('посты'),
    expect.any(Array),
  );
  expect(
    calls.some(call => call.method === 'DELETE' && call.path === '/pets/p2'),
  ).toBe(true);
  expect(useAuthStore.getState().pets).toEqual([bublik]);
  expect(hasText('Мои питомцы · 1')).toBe(true);
  expect(hasText('Пончик')).toBe(false);
});

test('«Выйти» asks for confirmation and returns to the login screen', async () => {
  backend([bublik]);
  await renderApp();

  await press('Мой профиль');
  const alert = answerAlerts('Выйти');
  await press('Выйти');

  expect(alert).toHaveBeenCalledWith(
    'Выйти из аккаунта?',
    undefined,
    expect.any(Array),
  );
  expect(useAuthStore.getState().status).toBe('signedOut');
  expect(hasText('Войти')).toBe(true);
});

test("a pet's name in the feed opens its public profile with the owner card", async () => {
  const post: Post = {
    id: 'post1',
    pet_id: 'p9',
    spot_id: null,
    text: 'Гуляем!',
    photo_urls: [],
    created_at: new Date().toISOString(),
  };
  const calls = backend([bublik], {
    'GET /posts': () => json(200, { posts: [post], next_cursor: null }),
    'GET /pets/p9': () => json(200, sharik),
    'GET /owners/o9': () =>
      json(200, {
        id: 'o9',
        nickname: 'olga',
        gender: null,
        avatar_url: null,
        created_at: '2026-01-15T10:00:00Z',
      }),
  });
  await renderApp();

  await pressTab('Лента');
  await press('Профиль питомца Шарик');
  await settle();

  expect(hasText('🐾 Шарик')).toBe(true);
  expect(hasText('метис')).toBe(true);
  expect(hasText('olga')).toBe(true);
  expect(hasText('В Tailverse с января 2026')).toBe(true);
  // Hidden fields come back null and are simply not shown; no editing.
  expect(hasText('Пол:')).toBe(false);
  expect(hasText('Ваш питомец')).toBe(false);
  expect(() => findButton('Редактировать')).toThrow();
  expect(calls.some(call => call.path === '/owners/o9')).toBe(true);
});
