/**
 * @format
 */

import Geolocation from '@react-native-community/geolocation';
import React from 'react';
import { Alert, FlatList, Image, Text, TextInput } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import * as Permissions from 'react-native-permissions';
import ReactTestRenderer from 'react-test-renderer';

import { FeedScreen } from '../src/screens/FeedScreen';
import { CreatePostScreen } from '../src/screens/feed/CreatePostScreen';
import { useAuthStore } from '../src/store/authStore';
import { useFeedStore } from '../src/store/feedStore';
import { useLocationStore } from '../src/store/locationStore';
import { useWalkSpotsStore } from '../src/store/walkSpotsStore';
import type { Pet, Post } from '../src/types';
import { json, mockFetch, type MockRoute } from '../test-utils/mockFetch';

const checkMock = jest.mocked(Permissions.check);
const requestMock = jest.mocked(Permissions.request);
const positionMock = jest.mocked(Geolocation.getCurrentPosition);
const libraryMock = jest.mocked(launchImageLibrary);

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
const muska = makePet('p2', 'Муська');
const sharik = makePet('p9', 'Шарик', 'o9');

const spot = {
  id: 's1',
  name: 'Площадка у парка',
  lat: 47.905549,
  lng: 33.390509,
  tags: [],
  present_count: 0,
};

const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();

function post(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    pet_id: 'p9',
    spot_id: null,
    text: `Пост ${id}`,
    photo_urls: [],
    created_at: fiveMinutesAgo,
    ...overrides,
  };
}

const commonRoutes: Record<string, MockRoute> = {
  'GET /pets/p9': () => json(200, sharik),
  'GET /walkspots/s1': () => json(200, { ...spot, present: [] }),
};

const initialAuth = useAuthStore.getState();
const initialLocation = useLocationStore.getState();
const initialFeed = useFeedStore.getState();
const initialSpots = useWalkSpotsStore.getState();
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

function grantLocation() {
  checkMock.mockResolvedValue(Permissions.RESULTS.GRANTED);
}

/** Alert.alert presses the button titled `title` right away. */
function answerAlerts(title: string) {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find(button => button.text === title)?.onPress?.();
    });
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
  libraryMock.mockReset().mockResolvedValue({ didCancel: true });
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
  useWalkSpotsStore.setState(initialSpots, true);
  useFeedStore.getState().reset();
  useFeedStore.setState(initialFeed, true);
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
    setParams: jest.fn(),
  };
}

/** Lets the fake backend's responses (and the renders they cause) finish. */
async function settle() {
  for (let i = 0; i < 3; i++) {
    await ReactTestRenderer.act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  await settle();
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
  await settle();
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

describe('the feed (the "Лента" tab)', () => {
  function renderFeed(
    navigation = fakeNavigation(),
    params?: { spot?: typeof spot },
  ) {
    const props = {
      navigation,
      route: { key: 'Feed', name: 'Feed', params },
    } as unknown as React.ComponentProps<typeof FeedScreen>;
    return render(<FeedScreen {...props} />);
  }

  test('shows each post with pet, time, text, photos and place', async () => {
    const calls = mockFetch({
      ...commonRoutes,
      'GET /posts': () =>
        json(200, {
          posts: [
            post('a', {
              spot_id: 's1',
              text: 'Отлично погуляли',
              photo_urls: [
                'http://host/uploads/1.jpg',
                'http://host/uploads/2.jpg',
              ],
            }),
            post('b', { pet_id: 'p1', text: 'Мой пост' }),
          ],
          next_cursor: null,
        }),
    });

    await renderFeed();

    expect(calls[0]?.query).toEqual({ limit: '20' });
    expect(hasText('🐾 Шарик')).toBe(true);
    expect(hasText('5 мин назад')).toBe(true);
    expect(hasText('Отлично погуляли')).toBe(true);
    expect(hasText('📍 Площадка у парка')).toBe(true);
    expect(hasText('1/2')).toBe(true);
    // The pager renders once it knows its width.
    const pager = renderer!.root.findAll(
      node => typeof node.props.onLayout === 'function' && node.props.style,
    );
    await ReactTestRenderer.act(() => {
      pager.forEach(node =>
        node.props.onLayout({ nativeEvent: { layout: { width: 300 } } }),
      );
    });
    expect(
      renderer!.root.findAllByType(Image).map(node => node.props.source.uri),
    ).toEqual(['http://host/uploads/1.jpg', 'http://host/uploads/2.jpg']);

    expect(hasText('🐾 Бублик')).toBe(true);
    expect(texts()).toContain(' · ваш');
    expect(findPressable('Удалить пост: Бублик')).toBeDefined();
    expect(findPressable('Удалить пост: Шарик')).toBeUndefined();
    expect(hasText('Это все посты')).toBe(true);
  });

  test('scrolling to the end loads the next page by cursor', async () => {
    const calls = mockFetch({
      ...commonRoutes,
      'GET /posts': call =>
        call.query.cursor === 'cur1'
          ? json(200, {
              posts: [post('b', { text: 'Старый пост' })],
              next_cursor: null,
            })
          : json(200, { posts: [post('a')], next_cursor: 'cur1' }),
    });
    await renderFeed();
    expect(hasText('Это все посты')).toBe(false);

    const list = renderer!.root.findByType(FlatList);
    await ReactTestRenderer.act(async () => {
      list.props.onEndReached();
      list.props.onEndReached();
    });
    await settle();

    expect(calls.filter(call => call.query.cursor === 'cur1')).toHaveLength(1);
    expect(hasText('Старый пост')).toBe(true);
    expect(hasText('Это все посты')).toBe(true);
  });

  test('a failed next page waits for "Повторить"', async () => {
    let failing = true;
    const calls = mockFetch({
      ...commonRoutes,
      'GET /posts': call =>
        call.query.cursor
          ? failing
            ? json(500, { msg: 'boom', error: 'boom' })
            : json(200, { posts: [post('b')], next_cursor: null })
          : json(200, { posts: [post('a')], next_cursor: 'cur1' }),
    });
    await renderFeed();

    const list = renderer!.root.findByType(FlatList);
    await ReactTestRenderer.act(async () => list.props.onEndReached());
    await settle();
    expect(hasText('Не удалось загрузить ещё')).toBe(true);

    await ReactTestRenderer.act(async () =>
      renderer!.root.findByType(FlatList).props.onEndReached(),
    );
    expect(calls.filter(call => call.query.cursor)).toHaveLength(1);

    failing = false;
    await press('Загрузить ещё');
    expect(hasText('Пост b')).toBe(true);
  });

  test('tapping a place shows only its posts; ✕ returns to the whole feed', async () => {
    const calls = mockFetch({
      ...commonRoutes,
      'GET /posts': call =>
        json(200, {
          posts: call.query.spot_id
            ? [post('a', { spot_id: 's1' })]
            : [post('a', { spot_id: 's1' }), post('b')],
          next_cursor: null,
        }),
    });
    await renderFeed();

    await press('Посты места Площадка у парка');

    expect(calls.at(-1)?.query).toEqual({ spot_id: 's1', limit: '20' });
    expect(findPressable('Сбросить фильтр')).toBeDefined();
    expect(hasText('Пост b')).toBe(false);

    await press('Сбросить фильтр');
    expect(calls.at(-1)?.query).toEqual({ limit: '20' });
    expect(hasText('Пост b')).toBe(true);
    expect(findPressable('Фильтр по месту')).toBeDefined();
  });

  test('opened from a spot it is filtered by that spot', async () => {
    const calls = mockFetch({
      ...commonRoutes,
      'GET /posts': () => json(200, { posts: [], next_cursor: null }),
    });
    const navigation = fakeNavigation();

    await renderFeed(navigation, { spot });

    expect(calls.filter(call => call.path === '/posts')).toHaveLength(1);
    expect(calls[0]?.query).toEqual({ spot_id: 's1', limit: '20' });
    expect(navigation.setParams).toHaveBeenCalledWith({ spot: undefined });
    expect(hasText('📍 Площадка у парка')).toBe(true);
    expect(hasText('Об этом месте пока не писали')).toBe(true);
  });

  test('the place filter lists spots around and applies the chosen one', async () => {
    const calls = mockFetch({
      ...commonRoutes,
      'GET /posts': () => json(200, { posts: [], next_cursor: null }),
      'GET /walkspots': () => json(200, { spots: [spot] }),
    });
    await renderFeed();

    await press('Фильтр по месту');
    expect(hasText('Посты о месте')).toBe(true);
    expect(calls.find(call => call.path === '/walkspots')?.query).toMatchObject(
      { radius_m: '20000' },
    );

    await press('Площадка у парка');
    expect(hasText('Посты о месте')).toBe(false);
    expect(calls.at(-1)?.query).toEqual({ spot_id: 's1', limit: '20' });
    expect(useFeedStore.getState().spotId).toBe('s1');
  });

  test('the owner deletes a post after confirming', async () => {
    const calls = mockFetch({
      'GET /posts': () =>
        json(200, { posts: [post('a', { pet_id: 'p1' })], next_cursor: null }),
      'DELETE /posts/a': () => ({ status: 204 }),
    });
    await renderFeed();
    const alert = answerAlerts('Удалить');

    await press('Удалить пост: Бублик');

    expect(alert).toHaveBeenCalledWith(
      'Удалить пост?',
      expect.any(String),
      expect.any(Array),
    );
    expect(calls.some(call => call.method === 'DELETE')).toBe(true);
    expect(hasText('Пост a')).toBe(false);
    expect(hasText('Пока нет постов')).toBe(true);
  });

  test('a load error offers a retry', async () => {
    let failing = true;
    mockFetch({
      ...commonRoutes,
      'GET /posts': () =>
        failing
          ? json(500, { msg: 'boom', error: 'boom' })
          : json(200, { posts: [post('a')], next_cursor: null }),
    });
    await renderFeed();
    expect(hasText('Не удалось загрузить ленту')).toBe(true);

    failing = false;
    await press('Повторить');
    expect(hasText('Пост a')).toBe(true);
  });

  test('"Написать пост" opens the post form', async () => {
    mockFetch({
      'GET /posts': () => json(200, { posts: [], next_cursor: null }),
    });
    const navigation = fakeNavigation();
    await renderFeed(navigation);

    await press('Написать пост');
    expect(navigation.navigate).toHaveBeenCalledWith('CreatePost');
  });
});

describe('a new post', () => {
  function renderCreate(navigation = fakeNavigation()) {
    const props = {
      navigation,
      route: { key: 'CreatePost', name: 'CreatePost' },
    } as unknown as React.ComponentProps<typeof CreatePostScreen>;
    return render(<CreatePostScreen {...props} />);
  }

  function created(body: unknown) {
    return json(201, {
      ...post('new', { pet_id: 'p1' }),
      ...(body as object),
    });
  }

  test('is tagged with the nearest spot and lands on top of the feed', async () => {
    grantLocation();
    const calls = mockFetch({
      ...commonRoutes,
      'GET /walkspots/nearby': () =>
        json(200, { spots: [{ ...spot, distance_m: 120 }] }),
      'POST /posts': call => created(call.body),
    });
    const navigation = fakeNavigation();
    await renderCreate(navigation);

    expect(hasText('📍 Площадка у парка')).toBe(true);
    expect(hasText('Ближайшая площадка · 120 м от вас')).toBe(true);
    expect(
      calls.find(call => call.path === '/walkspots/nearby')?.query,
    ).toEqual({
      lat: String(here.lat),
      lng: String(here.lng),
      radius_m: '500',
    });
    // Location access was granted before: no prompt.
    expect(requestMock).not.toHaveBeenCalled();

    await type('Как прошла прогулка', 'Набегались!');
    await press('Опубликовать');

    expect(calls.find(call => call.method === 'POST')?.body).toEqual({
      pet_id: 'p1',
      text: 'Набегались!',
      spot_id: 's1',
    });
    expect(navigation.popTo).toHaveBeenCalledWith('Tabs', { screen: 'Feed' });
    expect(useFeedStore.getState().posts[0]?.id).toBe('new');
  });

  test('prefers the spot where the pet is checked in; the tag can be removed', async () => {
    useWalkSpotsStore.setState({
      myCheckIns: {
        p1: {
          spot_id: 's1',
          pet_id: 'p1',
          checked_in_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
      },
    });
    const calls = mockFetch({
      ...commonRoutes,
      'POST /posts': call => created(call.body),
    });
    await renderCreate();

    expect(hasText('📍 Площадка у парка')).toBe(true);
    expect(hasText('Вы отметились здесь')).toBe(true);
    expect(calls.some(call => call.path === '/walkspots/nearby')).toBe(false);

    await press('Убрать место');
    expect(hasText('Без места')).toBe(true);

    await type('Как прошла прогулка', 'Без геотега');
    await press('Опубликовать');
    expect(calls.find(call => call.method === 'POST')?.body).toEqual({
      pet_id: 'p1',
      text: 'Без геотега',
    });
  });

  test('without location access there is no tag until one is picked', async () => {
    const calls = mockFetch({
      ...commonRoutes,
      'GET /walkspots/nearby': () =>
        json(200, { spots: [{ ...spot, distance_m: 40 }] }),
      'POST /posts': call => created(call.body),
    });
    await renderCreate();

    expect(hasText('Без места')).toBe(true);
    expect(requestMock).not.toHaveBeenCalled();

    // Choosing a place asks for access only on an explicit tap.
    await press('Отметить место');
    await press('Разрешить геолокацию');
    expect(requestMock).toHaveBeenCalled();
    await press('Площадка у парка');

    expect(hasText('Выбрано вами')).toBe(true);
    await type('Как прошла прогулка', 'Сами выбрали');
    await press('Опубликовать');
    expect(calls.find(call => call.method === 'POST')?.body).toMatchObject({
      spot_id: 's1',
    });
  });

  test('needs text or a photo, and a pet when there are several', async () => {
    useAuthStore.setState({ pets: [bublik, muska] });
    const calls = mockFetch(commonRoutes);
    await renderCreate();

    await press('Опубликовать');

    expect(hasText('Выберите питомца')).toBe(true);
    expect(hasText('Напишите пару слов или добавьте фото')).toBe(true);
    expect(calls.some(call => call.method === 'POST')).toBe(false);

    await press('Муська');
    expect(hasText('Выберите питомца')).toBe(false);
  });

  test('photos upload right away; a failed one blocks sending until removed', async () => {
    let uploads = 0;
    const calls = mockFetch({
      ...commonRoutes,
      'POST /uploads': () =>
        ++uploads === 1
          ? json(201, { url: 'http://host/uploads/1.jpg' })
          : json(415, { msg: 'Upload', error: 'unsupported' }),
      'POST /posts': call => created(call.body),
    });
    libraryMock.mockResolvedValueOnce({
      assets: [
        { uri: 'file:///a.jpg', type: 'image/jpeg', fileName: 'a.jpg' },
        { uri: 'file:///b.gif', type: 'image/gif', fileName: 'b.gif' },
      ],
    });
    const navigation = fakeNavigation();
    await renderCreate(navigation);
    answerAlerts('Выбрать из галереи');

    await press('Добавить фото');

    expect(libraryMock).toHaveBeenCalledWith(
      expect.objectContaining({ selectionLimit: 6, maxWidth: 1600 }),
    );
    expect(calls.filter(call => call.path === '/uploads')).toHaveLength(2);
    expect(hasText('Фото · 2 из 6')).toBe(true);
    expect(hasText('Формат не подходит')).toBe(true);

    await press('Опубликовать');
    expect(hasText('Не все фото загрузились')).toBe(true);
    expect(calls.some(call => call.path === '/posts')).toBe(false);

    await press('Убрать фото 2');
    await press('Опубликовать');

    expect(calls.find(call => call.path === '/posts')?.body).toEqual({
      pet_id: 'p1',
      text: '',
      photo_urls: ['http://host/uploads/1.jpg'],
    });
    expect(navigation.popTo).toHaveBeenCalled();
  });

  test('a failed upload can be retried', async () => {
    let uploads = 0;
    mockFetch({
      ...commonRoutes,
      'POST /uploads': () =>
        ++uploads === 1
          ? json(500, { msg: 'Upload', error: 'boom' })
          : json(201, { url: 'http://host/uploads/2.jpg' }),
    });
    libraryMock.mockResolvedValueOnce({
      assets: [{ uri: 'file:///a.jpg', type: 'image/jpeg', fileName: 'a.jpg' }],
    });
    await renderCreate();
    answerAlerts('Выбрать из галереи');

    await press('Добавить фото');
    expect(hasText('Ошибка сервера')).toBe(true);

    await press('Повторить загрузку фото 1');
    expect(hasText('Ошибка сервера')).toBe(false);
    expect(uploads).toBe(2);
  });
});
