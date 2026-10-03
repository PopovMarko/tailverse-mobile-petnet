import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { useRealtimeStore } from '../store/realtimeStore';

/** A short drop is not worth a notice; this one is. */
export const UPDATES_PAUSED_AFTER_MS = 5_000;

/**
 * Live presence updates for the map: turns the realtime connection on whenever
 * the screen gains focus (see useRealtimeStore for how long it stays up).
 * Resolves to true once the connection has been down for UPDATES_PAUSED_AFTER_MS,
 * so the screen can say that live updates are paused.
 */
export function usePresenceConnection(): boolean {
  const enable = useRealtimeStore(state => state.enable);
  const disconnectedSince = useRealtimeStore(state => state.disconnectedSince);

  useFocusEffect(
    useCallback(() => {
      enable();
    }, [enable]),
  );

  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (disconnectedSince === null) {
      setPaused(false);
      return;
    }
    const remaining = disconnectedSince + UPDATES_PAUSED_AFTER_MS - Date.now();
    if (remaining <= 0) {
      setPaused(true);
      return;
    }
    setPaused(false);
    const timer = setTimeout(() => setPaused(true), remaining);
    return () => clearTimeout(timer);
  }, [disconnectedSince]);

  return paused;
}
