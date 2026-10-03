import { API_BASE_URL } from '@env';
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';
import { create } from 'zustand';

import {
  PresenceSocket,
  type ConnectionStatus,
} from '../services/presenceSocket';
import type { ServerMessage } from '../types';
import { presenceSocketUrl } from '../utils/realtime';
import { useAnnouncementsStore } from './announcementsStore';
import { useAuthStore } from './authStore';
import { useWalkSpotsStore } from './walkSpotsStore';

export type { ConnectionStatus } from '../services/presenceSocket';

interface RealtimeState {
  status: ConnectionStatus;
  /**
   * Live updates were asked for (the map was opened) in this session. The
   * connection then stays up while signed in and in the foreground, on every
   * tab: the walks list and the open spot card use the same events, and
   * switching tabs doesn't cost a reconnect.
   */
  enabled: boolean;
  /** When the connection was last lost (or first tried), while it isn't open. */
  disconnectedSince: number | null;

  /** Turns live updates on (idempotent); ignored while signed out. */
  enable: () => void;
  /** Closes the connection until the next enable(), e.g. on logout. */
  disable: () => void;
}

/** Puts a server message straight into the store that owns the data. */
export function dispatchServerMessage(message: ServerMessage) {
  switch (message.type) {
    case 'spot_update':
      useWalkSpotsStore
        .getState()
        .applySpotUpdate(message.spot_id, message.present_count);
      break;
    case 'announcement_created':
      useAnnouncementsStore
        .getState()
        .applyAnnouncementCreated(message.announcement);
      break;
  }
}

let connection: PresenceSocket | null = null;
let appStateSubscription: NativeEventSubscription | null = null;

export const useRealtimeStore = create<RealtimeState>()((set, get) => {
  function getConnection(): PresenceSocket {
    // One per enabled session, created on first use.
    connection ??= new PresenceSocket({
      url: presenceSocketUrl(API_BASE_URL),
      getAccessToken: () => useAuthStore.getState().accessToken,
      refreshAccessToken: () => useAuthStore.getState().refreshSession(),
      onMessage: dispatchServerMessage,
      onStatusChange: status =>
        set(state => ({
          status,
          disconnectedSince:
            status === 'open' || status === 'closed' || status === 'idle'
              ? null
              : state.disconnectedSince ?? Date.now(),
        })),
      // Counts may have changed while disconnected: reload the visible markers.
      onReconnected: () => useWalkSpotsStore.getState().refreshSpots(),
    });
    return connection;
  }

  // Background: no socket (iOS would suspend it anyway). Back in the
  // foreground: connect again; the resync catches up on what was missed.
  // "inactive" (iOS control centre, incoming call) keeps the connection.
  function handleAppState(state: AppStateStatus) {
    if (!get().enabled) {
      return;
    }
    if (state === 'active') {
      getConnection().start();
    } else if (state === 'background') {
      getConnection().stop();
    }
  }

  return {
    status: 'idle',
    enabled: false,
    disconnectedSince: null,

    enable: () => {
      if (useAuthStore.getState().status !== 'signedIn') {
        return;
      }
      if (!get().enabled) {
        set({ enabled: true });
        appStateSubscription ??= AppState.addEventListener(
          'change',
          handleAppState,
        );
      }
      if (AppState.currentState !== 'background') {
        getConnection().start();
      }
    },

    disable: () => {
      appStateSubscription?.remove();
      appStateSubscription = null;
      connection?.stop();
      // The next session starts from scratch (no resync on its first open).
      connection = null;
      set({ enabled: false, status: 'idle', disconnectedSince: null });
    },
  };
});

// Never connected while signed out: logging out (or a rejected refresh) closes it.
useAuthStore.subscribe((state, previous) => {
  if (state.status !== 'signedIn' && previous.status === 'signedIn') {
    useRealtimeStore.getState().disable();
  }
});
