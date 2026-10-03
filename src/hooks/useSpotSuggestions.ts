import { useCallback, useEffect, useRef, useState } from 'react';

import { listAnnouncements, listWalkSpots } from '../api';
import type { LoadStatus } from '../store/walkSpotsStore';
import type { Announcement } from '../types';
import { describeError } from '../utils/errors';
import {
  SUGGESTIONS_RADIUS_M,
  UPCOMING_WALKS_HOURS,
  buildSuggestions,
  type SpotSuggestion,
} from '../utils/whereToGo';

export interface SpotSuggestions {
  /** Spots around the centre, unsorted; kept while reloading. */
  suggestions: SpotSuggestion[];
  status: LoadStatus;
  error: string | null;
  /** Pull-to-refresh in progress. */
  refreshing: boolean;
  /** Loads again with the loading state (e.g. "Повторить"). */
  reload: () => void;
  /** Loads again keeping the list (pull-to-refresh). */
  refresh: () => void;
}

/**
 * Walk spots within SUGGESTIONS_RADIUS_M of (lat, lng) — GET /walkspots — with
 * the number of walks announced there for the next hours (GET /announcements;
 * if that fails, the spots are still shown without it). Reloads when the centre
 * moves; only the latest request may write.
 */
export function useSpotSuggestions(lat: number, lng: number): SpotSuggestions {
  const [suggestions, setSuggestions] = useState<SpotSuggestion[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latestRequest = useRef(0);

  const load = useCallback(
    async (asRefresh: boolean) => {
      const requestId = ++latestRequest.current;
      if (asRefresh) {
        setRefreshing(true);
      } else {
        setStatus('loading');
        setError(null);
      }
      const center = { lat, lng };
      const now = new Date();
      const [spotsResult, walksResult] = await Promise.allSettled([
        listWalkSpots(center, SUGGESTIONS_RADIUS_M),
        listAnnouncements(center, SUGGESTIONS_RADIUS_M, {
          to: new Date(now.getTime() + UPCOMING_WALKS_HOURS * 3600_000),
        }),
      ]);
      if (requestId !== latestRequest.current) {
        return;
      }
      if (spotsResult.status === 'fulfilled') {
        const walks: Announcement[] | null =
          walksResult.status === 'fulfilled'
            ? walksResult.value.announcements
            : null;
        setSuggestions(
          buildSuggestions(spotsResult.value.spots, center, walks),
        );
        setStatus('success');
        setError(null);
      } else {
        setStatus('error');
        setError(describeError(spotsResult.reason));
      }
      setRefreshing(false);
    },
    [lat, lng],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // Responses that arrive after the screen is gone are dropped.
  useEffect(
    () => () => {
      latestRequest.current++;
    },
    [],
  );

  return {
    suggestions,
    status,
    error,
    refreshing,
    reload: useCallback(() => load(false), [load]),
    refresh: useCallback(() => load(true), [load]),
  };
}
