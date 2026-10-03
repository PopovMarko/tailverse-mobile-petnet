import type { Announcement, WalkSpot } from '../src/types';
import {
  availableCenters,
  buildSuggestions,
  resolveCenterSource,
  sortSuggestions,
  suggestionToPlace,
} from '../src/utils/whereToGo';

const here = { lat: 47.9, lng: 33.39 };
const picked = { lat: 47.95, lng: 33.4 };

function spot(id: string, lat: number, present: number): WalkSpot {
  return {
    id,
    name: `Место ${id}`,
    lat,
    lng: 33.39,
    tags: [],
    present_count: present,
  };
}

function walk(id: string, spotId: string | null): Announcement {
  return {
    id,
    pet_id: 'p9',
    spot_id: spotId,
    custom_point: spotId ? null : here,
    starts_at: '2026-10-03T12:00:00Z',
    duration_min: 60,
    status: 'active',
    created_at: '2026-10-03T10:00:00Z',
  };
}

describe('centre', () => {
  test('position, then the picked place, then the city', () => {
    expect(
      availableCenters({ userPosition: here, manualPoint: picked }),
    ).toEqual(['me', 'manual', 'city']);
    expect(
      resolveCenterSource(null, { userPosition: here, manualPoint: picked }),
    ).toBe('me');
    expect(
      resolveCenterSource(null, { userPosition: null, manualPoint: picked }),
    ).toBe('manual');
    expect(
      resolveCenterSource(null, { userPosition: null, manualPoint: null }),
    ).toBe('city');
  });

  test('the user choice wins while it is available', () => {
    const both = { userPosition: here, manualPoint: picked };
    expect(resolveCenterSource('city', both)).toBe('city');
    expect(resolveCenterSource('manual', both)).toBe('manual');
    expect(
      resolveCenterSource('manual', { userPosition: here, manualPoint: null }),
    ).toBe('me');
  });
});

describe('suggestions', () => {
  const spots = [
    spot('far', 47.94, 0),
    spot('near', 47.901, 1),
    spot('busy', 47.92, 3),
  ];

  test('distance and upcoming walks per spot', () => {
    const list = buildSuggestions(spots, here, [
      walk('a1', 'far'),
      walk('a2', 'far'),
      walk('a3', null),
    ]);
    expect(list.map(item => item.upcoming_walks)).toEqual([2, 0, 0]);
    expect(Math.round(list[1]!.distance_m)).toBe(111);
    expect(buildSuggestions(spots, here, null)[0]!.upcoming_walks).toBeNull();
  });

  test('sorts by distance or by who is there now', () => {
    const list = buildSuggestions(spots, here, [walk('a1', 'far')]);
    expect(sortSuggestions(list, 'near').map(item => item.id)).toEqual([
      'near',
      'busy',
      'far',
    ]);
    expect(sortSuggestions(list, 'busy').map(item => item.id)).toEqual([
      'busy',
      'near',
      'far',
    ]);
  });

  test('as a place, the distance is kept only when it is from the user', () => {
    const [item] = buildSuggestions([spots[1]!], here, []);
    expect(suggestionToPlace(item!, true)).toEqual({
      id: 'near',
      name: 'Место near',
      lat: 47.901,
      lng: 33.39,
      distance_m: 111,
    });
    expect(suggestionToPlace(item!, false)).not.toHaveProperty('distance_m');
  });
});
