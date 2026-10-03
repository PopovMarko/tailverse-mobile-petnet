import {
  isAuthRejection,
  parseServerMessage,
  presenceSocketUrl,
  reconnectDelayMs,
} from '../src/utils/realtime';

const announcement = {
  id: 'a1',
  pet_id: 'p1',
  spot_id: null,
  custom_point: { lat: 47.9, lng: 33.39 },
  starts_at: '2026-10-03T12:00:00Z',
  duration_min: 60,
  status: 'active',
  created_at: '2026-10-03T11:55:00Z',
};

describe('presenceSocketUrl', () => {
  test('swaps http for ws and https for wss', () => {
    expect(presenceSocketUrl('http://localhost:8080/api/v1')).toBe(
      'ws://localhost:8080/api/v1/ws/presence',
    );
    expect(presenceSocketUrl('https://api.tailverse.app/api/v1/')).toBe(
      'wss://api.tailverse.app/api/v1/ws/presence',
    );
  });
});

describe('reconnectDelayMs', () => {
  test('doubles from 1 s up to the 30 s cap, jittering the upper half', () => {
    const lowest = [0, 1, 2, 3, 4, 5, 6, 10].map(n =>
      reconnectDelayMs(n, () => 0),
    );
    const highest = [0, 1, 2, 3, 4, 5, 6, 10].map(n =>
      reconnectDelayMs(n, () => 1),
    );
    expect(highest).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000,
    ]);
    expect(lowest).toEqual(highest.map(ms => ms / 2));
  });

  test('is never zero', () => {
    for (let i = 0; i < 50; i++) {
      expect(reconnectDelayMs(0)).toBeGreaterThanOrEqual(500);
    }
  });
});

describe('isAuthRejection', () => {
  test('recognises a 401 handshake failure on iOS and Android', () => {
    expect(
      isAuthRejection({
        code: 1006,
        reason: 'Received bad response code from server: 401.',
      }),
    ).toBe(true);
    expect(
      isAuthRejection({
        code: 1006,
        reason: "Expected HTTP 101 response but was '401 Unauthorized'",
      }),
    ).toBe(true);
  });

  test('anything else is a plain connection problem', () => {
    expect(
      isAuthRejection({ code: 1006, reason: 'Socket is not connected' }),
    ).toBe(false);
    expect(
      isAuthRejection({
        code: 1006,
        reason: 'Received bad response code from server: 500.',
      }),
    ).toBe(false);
    expect(isAuthRejection({ code: 1000, reason: '401' })).toBe(false);
    expect(isAuthRejection({})).toBe(false);
  });
});

describe('parseServerMessage', () => {
  test('reads spot_update', () => {
    expect(
      parseServerMessage(
        '{"type":"spot_update","spot_id":"s1","present_count":3}',
      ),
    ).toEqual({ type: 'spot_update', spot_id: 's1', present_count: 3 });
  });

  test('passes the announcement of announcement_created through as is', () => {
    const message = parseServerMessage(
      JSON.stringify({ type: 'announcement_created', announcement }),
    );
    expect(message).toEqual({ type: 'announcement_created', announcement });

    const atSpot = { ...announcement, spot_id: 's1', custom_point: null };
    expect(
      parseServerMessage(
        JSON.stringify({ type: 'announcement_created', announcement: atSpot }),
      ),
    ).toEqual({ type: 'announcement_created', announcement: atSpot });
  });

  test.each([
    ['not JSON', 'hello'],
    ['JSON that is not an object', '[1,2]'],
    ['null', 'null'],
    ['an unknown type', '{"type":"post_created","post":{}}'],
    ['no type', '{"spot_id":"s1","present_count":1}'],
    [
      'a count that is not a number',
      '{"type":"spot_update","spot_id":"s1","present_count":"2"}',
    ],
    [
      'a negative count',
      '{"type":"spot_update","spot_id":"s1","present_count":-1}',
    ],
    ['no spot id', '{"type":"spot_update","present_count":2}'],
  ])('ignores %s', (_label, frame) => {
    expect(parseServerMessage(frame)).toBeNull();
  });

  test.each([
    ['without an id', { ...announcement, id: undefined }],
    ['with a bad point', { ...announcement, custom_point: { lat: 'x' } }],
    ['with a bad start', { ...announcement, starts_at: 'soon' }],
    ['with an unknown status', { ...announcement, status: 'deleted' }],
    ['with a fractional duration', { ...announcement, duration_min: 1.5 }],
    ['missing spot_id', { ...announcement, spot_id: undefined }],
  ])('ignores an announcement %s', (_label, body) => {
    expect(
      parseServerMessage(
        JSON.stringify({ type: 'announcement_created', announcement: body }),
      ),
    ).toBeNull();
  });

  test('ignores binary frames', () => {
    expect(parseServerMessage(new ArrayBuffer(4))).toBeNull();
  });
});
