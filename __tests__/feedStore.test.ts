import { useAuthStore } from '../src/store/authStore';
import { useFeedStore } from '../src/store/feedStore';
import type { Pet, Post } from '../src/types';
import { json, mockFetch, type MockReply } from '../test-utils/mockFetch';

const myPet: Pet = {
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

function post(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    pet_id: 'p9',
    spot_id: null,
    text: `Пост ${id}`,
    photo_urls: [],
    created_at: '2026-10-03T10:00:00Z',
    ...overrides,
  };
}

const spot = {
  id: 's1',
  name: 'Площадка у парка',
  lat: 47.9055,
  lng: 33.3905,
  tags: [],
  present: [],
};

const sharik = { ...myPet, id: 'p9', owner_id: 'o9', name: 'Шарик' };

/** A promise resolved by hand, to hold a fake response back. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

const initialAuth = useAuthStore.getState();
const initialState = useFeedStore.getState();

/** Lets the background name requests finish. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState(
    {
      ...initialAuth,
      status: 'signedIn',
      accessToken: 'access',
      pets: [myPet],
    },
    true,
  );
  useFeedStore.getState().reset();
  useFeedStore.setState(initialState, true);
});

test('the first page is global and loads the names of pets and spots once', async () => {
  const calls = mockFetch({
    'GET /posts': () =>
      json(200, {
        posts: [
          post('a', { spot_id: 's1' }),
          post('b', { spot_id: 's1' }),
          post('c', { pet_id: 'p1' }),
        ],
        next_cursor: 'cur1',
      }),
    'GET /pets/p9': () => json(200, sharik),
    'GET /walkspots/s1': () => json(200, spot),
  });

  await useFeedStore.getState().loadFirstPage();
  await flush();

  const state = useFeedStore.getState();
  expect(state.status).toBe('success');
  expect(state.posts.map(item => item.id)).toEqual(['a', 'b', 'c']);
  expect(state.nextCursor).toBe('cur1');
  expect(calls[0]?.query).toEqual({ limit: '20' });
  expect(state.petNames).toEqual({ p9: 'Шарик' });
  expect(state.spots).toEqual({
    s1: { name: 'Площадка у парка', lat: 47.9055, lng: 33.3905 },
  });
  // Own pets come from the auth store; each id is requested once.
  expect(calls.map(call => call.path).sort()).toEqual([
    '/pets/p9',
    '/posts',
    '/walkspots/s1',
  ]);
});

test('loadMore appends the next page by cursor until the last one', async () => {
  const calls = mockFetch({
    'GET /posts': call =>
      call.query.cursor === 'cur1'
        ? json(200, { posts: [post('c'), post('b')], next_cursor: null })
        : json(200, { posts: [post('a'), post('b')], next_cursor: 'cur1' }),
    'GET /pets/p9': () => json(200, sharik),
  });

  await useFeedStore.getState().loadFirstPage();
  await useFeedStore.getState().loadMore();

  const state = useFeedStore.getState();
  // "b" came twice (e.g. a page shift): it is kept once.
  expect(state.posts.map(item => item.id)).toEqual(['a', 'b', 'c']);
  expect(state.nextCursor).toBeNull();
  expect(state.loadingMore).toBe(false);

  await useFeedStore.getState().loadMore();
  expect(calls.filter(call => call.path === '/posts')).toHaveLength(2);
});

test('concurrent loadMore calls share one request', async () => {
  const page2 = deferred<MockReply>();
  const calls = mockFetch({
    'GET /posts': call =>
      call.query.cursor
        ? page2.promise
        : json(200, { posts: [post('a')], next_cursor: 'cur1' }),
    'GET /pets/p9': () => json(200, sharik),
  });
  await useFeedStore.getState().loadFirstPage();

  const first = useFeedStore.getState().loadMore();
  const second = useFeedStore.getState().loadMore();
  expect(useFeedStore.getState().loadingMore).toBe(true);
  page2.resolve(json(200, { posts: [post('b')], next_cursor: null }));
  await Promise.all([first, second]);

  expect(calls.filter(call => call.query.cursor === 'cur1')).toHaveLength(1);
  expect(useFeedStore.getState().posts.map(item => item.id)).toEqual([
    'a',
    'b',
  ]);
});

test('a page that arrives after the filter changed is dropped', async () => {
  const oldPage = deferred<MockReply>();
  const calls = mockFetch({
    'GET /posts': call => {
      if (call.query.spot_id === 's1') {
        return json(200, {
          posts: [post('s', { spot_id: 's1' })],
          next_cursor: null,
        });
      }
      return call.query.cursor
        ? oldPage.promise
        : json(200, { posts: [post('a')], next_cursor: 'cur1' });
    },
    'GET /pets/p9': () => json(200, sharik),
    'GET /walkspots/s1': () => json(200, spot),
  });
  await useFeedStore.getState().loadFirstPage();

  const more = useFeedStore.getState().loadMore();
  await useFeedStore
    .getState()
    .setSpotFilter('s1', { name: 'Площадка у парка', lat: 1, lng: 2 });
  oldPage.resolve(json(200, { posts: [post('old')], next_cursor: 'cur2' }));
  await more;

  const state = useFeedStore.getState();
  expect(state.spotId).toBe('s1');
  expect(state.posts.map(item => item.id)).toEqual(['s']);
  expect(state.nextCursor).toBeNull();
  expect(state.loadingMore).toBe(false);
  expect(state.spots.s1?.name).toBe('Площадка у парка');
  // The name was known: no GET /walkspots/s1.
  expect(calls.some(call => call.path === '/walkspots/s1')).toBe(false);
});

test('refresh replaces the list and resets the cursor; a failure keeps the posts', async () => {
  let version = 1;
  mockFetch({
    'GET /posts': () =>
      version === 3
        ? json(500, { msg: 'boom', error: 'boom' })
        : json(200, {
            posts: version === 1 ? [post('a')] : [post('new'), post('a')],
            next_cursor: version === 1 ? 'cur1' : null,
          }),
    'GET /pets/p9': () => json(200, sharik),
  });
  await useFeedStore.getState().loadFirstPage();

  version = 2;
  const refreshing = useFeedStore.getState().refresh();
  expect(useFeedStore.getState().refreshing).toBe(true);
  await refreshing;
  expect(useFeedStore.getState().posts.map(item => item.id)).toEqual([
    'new',
    'a',
  ]);
  expect(useFeedStore.getState().nextCursor).toBeNull();

  version = 3;
  await useFeedStore.getState().refresh();
  const state = useFeedStore.getState();
  expect(state.status).toBe('error');
  expect(state.error).toBe('Ошибка сервера, попробуйте позже');
  expect(state.refreshing).toBe(false);
  expect(state.posts).toHaveLength(2);
});

test('createPost sends the post and puts it on top', async () => {
  const calls = mockFetch({
    'GET /posts': () => json(200, { posts: [post('a')], next_cursor: null }),
    'GET /pets/p9': () => json(200, sharik),
    'POST /posts': () =>
      json(201, post('mine', { pet_id: 'p1', spot_id: 's1', text: 'Гуляли' })),
  });
  await useFeedStore.getState().loadFirstPage();

  await useFeedStore.getState().createPost({
    petId: 'p1',
    text: '  Гуляли  ',
    photoUrls: ['http://host/uploads/1.jpg'],
    spot: { id: 's1', name: 'Площадка у парка', lat: 1, lng: 2 },
  });

  expect(calls.find(call => call.method === 'POST')?.body).toEqual({
    pet_id: 'p1',
    text: 'Гуляли',
    spot_id: 's1',
    photo_urls: ['http://host/uploads/1.jpg'],
  });
  const state = useFeedStore.getState();
  expect(state.posts.map(item => item.id)).toEqual(['mine', 'a']);
  expect(state.spots.s1).toEqual({
    name: 'Площадка у парка',
    lat: 1,
    lng: 2,
  });
});

test('a post about another place drops the filter so it is visible', async () => {
  const calls = mockFetch({
    'GET /posts': call =>
      json(200, {
        posts: call.query.spot_id
          ? [post('s', { spot_id: 's1' })]
          : [post('mine', { pet_id: 'p1' }), post('s', { spot_id: 's1' })],
        next_cursor: null,
      }),
    'GET /pets/p9': () => json(200, sharik),
    'GET /walkspots/s1': () => json(200, spot),
    'POST /posts': () => json(201, post('mine', { pet_id: 'p1' })),
  });
  await useFeedStore.getState().setSpotFilter('s1');

  await useFeedStore
    .getState()
    .createPost({ petId: 'p1', text: 'Без места', photoUrls: [], spot: null });
  await flush();

  const state = useFeedStore.getState();
  expect(state.spotId).toBeNull();
  expect(state.posts.map(item => item.id)).toEqual(['mine', 's']);
  expect(calls.find(call => call.method === 'POST')?.body).toEqual({
    pet_id: 'p1',
    text: 'Без места',
  });
});

test('deletePost removes the post; a post already gone counts as deleted', async () => {
  const calls = mockFetch({
    'GET /posts': () =>
      json(200, {
        posts: [post('a', { pet_id: 'p1' }), post('b', { pet_id: 'p1' })],
        next_cursor: null,
      }),
    'DELETE /posts/a': () => ({ status: 204 }),
    'DELETE /posts/b': () =>
      json(404, { msg: 'DeletePost', error: 'not found' }),
  });
  await useFeedStore.getState().loadFirstPage();

  await useFeedStore.getState().deletePost('a');
  await useFeedStore.getState().deletePost('b');

  expect(useFeedStore.getState().posts).toEqual([]);
  expect(calls.find(call => call.path === '/posts/a')?.headers).toMatchObject({
    Authorization: 'Bearer access',
  });
});

test('deletePost rejects on 403 and keeps the post', async () => {
  mockFetch({
    'GET /posts': () => json(200, { posts: [post('a')], next_cursor: null }),
    'GET /pets/p9': () => json(200, sharik),
    'DELETE /posts/a': () =>
      json(403, { msg: 'DeletePost', error: 'forbidden' }),
  });
  await useFeedStore.getState().loadFirstPage();

  await expect(useFeedStore.getState().deletePost('a')).rejects.toMatchObject({
    status: 403,
  });
  expect(useFeedStore.getState().posts).toHaveLength(1);
});

test('logging out forgets the feed, and late responses are dropped', async () => {
  const page = deferred<MockReply>();
  mockFetch({
    'GET /posts': () => page.promise,
  });
  useFeedStore.setState({ spotId: 's1', petNames: { p9: 'Шарик' } });

  const loading = useFeedStore.getState().loadFirstPage();
  await useAuthStore.getState().logout();
  page.resolve(json(200, { posts: [post('a')], next_cursor: 'cur1' }));
  await loading;

  const state = useFeedStore.getState();
  expect(state.posts).toEqual([]);
  expect(state.status).toBe('idle');
  expect(state.spotId).toBeNull();
  expect(state.petNames).toEqual({});
});
