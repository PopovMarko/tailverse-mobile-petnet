import type { Announcement, GeoPoint, WalkSpot } from '../types';
import type { PlaceSpot } from './announcements';
import { distanceM } from './geo';

/** How far from the centre «Куда пойти» looks for walk spots. */
export const SUGGESTIONS_RADIUS_M = 5_000;
/** Walks starting within this many hours count as "upcoming" at a spot. */
export const UPCOMING_WALKS_HOURS = 24;

/**
 * What the suggestions are built around: the device position (with location
 * access), the place picked on the map (long press), or the city centre.
 * The pets' areas in the profile are free text and the app has no geocoding,
 * so they can't be a centre yet.
 */
export type CenterSource = 'me' | 'manual' | 'city';

export const CENTER_LABELS: Record<CenterSource, string> = {
  me: 'Рядом со мной',
  manual: 'Место на карте',
  city: 'Центр города',
};

export interface CenterCandidates {
  userPosition: GeoPoint | null;
  manualPoint: GeoPoint | null;
}

/** The centres that can be used now, in order of preference (the city centre always). */
export function availableCenters({
  userPosition,
  manualPoint,
}: CenterCandidates): CenterSource[] {
  return [
    ...(userPosition ? (['me'] as const) : []),
    ...(manualPoint ? (['manual'] as const) : []),
    'city',
  ];
}

/**
 * The centre to use: the user's choice while it is available, otherwise the
 * first available one (the position, then the picked place, then the city).
 */
export function resolveCenterSource(
  chosen: CenterSource | null,
  candidates: CenterCandidates,
): CenterSource {
  const available = availableCenters(candidates);
  return chosen && available.includes(chosen) ? chosen : available[0]!;
}

export type SuggestionSort = 'near' | 'busy';

export const SORT_LABELS: Record<SuggestionSort, string> = {
  near: 'Ближе',
  busy: 'Сейчас гуляют',
};

/** A walk spot suggested by «Куда пойти». */
export interface SpotSuggestion extends WalkSpot {
  /** Metres from the centre. */
  distance_m: number;
  /** Active walks announced at the spot for the next hours; null — unknown. */
  upcoming_walks: number | null;
}

/**
 * The spots with their distance from `center` and the number of walks announced
 * there (`announcements` null — that list failed to load).
 */
export function buildSuggestions(
  spots: WalkSpot[],
  center: GeoPoint,
  announcements: Announcement[] | null,
): SpotSuggestion[] {
  const walks = new Map<string, number>();
  for (const announcement of announcements ?? []) {
    if (announcement.spot_id && announcement.status === 'active') {
      walks.set(
        announcement.spot_id,
        (walks.get(announcement.spot_id) ?? 0) + 1,
      );
    }
  }
  return spots.map(spot => ({
    ...spot,
    distance_m: distanceM(center, spot),
    upcoming_walks: announcements ? walks.get(spot.id) ?? 0 : null,
  }));
}

/**
 * «Ближе» — closest first; «Сейчас гуляют» — most pets there now first, then
 * the most upcoming walks, then the closest.
 */
export function sortSuggestions(
  suggestions: SpotSuggestion[],
  sort: SuggestionSort,
): SpotSuggestion[] {
  const byDistance = (a: SpotSuggestion, b: SpotSuggestion) =>
    a.distance_m - b.distance_m;
  if (sort === 'near') {
    return [...suggestions].sort(byDistance);
  }
  return [...suggestions].sort(
    (a, b) =>
      b.present_count - a.present_count ||
      (b.upcoming_walks ?? 0) - (a.upcoming_walks ?? 0) ||
      byDistance(a, b),
  );
}

/** The suggestion as a place for other screens (distance only when it is from the user). */
export function suggestionToPlace(
  suggestion: SpotSuggestion,
  fromUser: boolean,
): PlaceSpot {
  return {
    id: suggestion.id,
    name: suggestion.name,
    lat: suggestion.lat,
    lng: suggestion.lng,
    ...(fromUser ? { distance_m: Math.round(suggestion.distance_m) } : {}),
  };
}
