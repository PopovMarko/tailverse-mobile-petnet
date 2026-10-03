import type { ServerMessage } from '../types';
import {
  isAuthRejection,
  parseServerMessage,
  reconnectDelayMs,
} from '../utils/realtime';

/**
 * idle — never started; connecting — first handshake after start();
 * open — receiving events; reconnecting — the connection dropped or failed and
 * a new one is on its way (backoff); closed — stopped (background, logout) or
 * the session is gone.
 */
export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed';

/** A connection that stayed open this long was stable: the backoff starts over. */
export const STABLE_CONNECTION_MS = 30_000;

export interface PresenceSocketOptions {
  /** ws(s)://…/ws/presence */
  url: string;
  /** The access token to connect with, or null when signed out. */
  getAccessToken: () => string | null;
  /**
   * Called when the handshake is refused with 401 (at most once per backoff
   * step). Resolves to a fresh access token, or to null when the session is
   * gone; rejects on network errors.
   */
  refreshAccessToken: () => Promise<string | null>;
  onMessage: (message: ServerMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  /** Open again after having been open before: events may have been missed meanwhile. */
  onReconnected: () => void;
  /** Opens the socket; tests replace it. */
  createSocket?: (url: string, token: string) => WebSocket;
  random?: () => number;
  now?: () => number;
}

/**
 * The token goes in the "Authorization" header (React Native's WebSocket takes
 * headers on iOS and Android), so it never appears in a URL.
 */
function openWebSocket(url: string, token: string): WebSocket {
  return new WebSocket(url, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * One self-healing connection to the presence socket. start() connects and
 * keeps reconnecting with backoff until stop(); a handshake refused with 401
 * refreshes the session once and retries right away. Incoming frames are
 * parsed and handed to onMessage; anything malformed is dropped.
 *
 * Keepalive needs nothing here: the server pings every ~54 s and the native
 * WebSocket (SocketRocket / OkHttp) answers with pongs itself.
 */
export class PresenceSocket {
  private status: ConnectionStatus = 'idle';
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by start() and stop(): callbacks of an older run do nothing. */
  private run = 0;
  private active = false;
  /** Failed attempts in a row; picks the backoff step. */
  private attempt = 0;
  private openedAt: number | null = null;
  private hasBeenOpen = false;
  /**
   * The handshake in progress uses a token just refreshed after a 401: if that
   * one is refused too, back off instead of refreshing again (no refresh loop).
   */
  private afterRefresh = false;

  private readonly createSocket: (url: string, token: string) => WebSocket;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(private readonly options: PresenceSocketOptions) {
    this.createSocket = options.createSocket ?? openWebSocket;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  get currentStatus(): ConnectionStatus {
    return this.status;
  }

  /** Connects unless already connected or reconnecting. */
  start() {
    if (this.active) {
      return;
    }
    this.run++;
    this.active = true;
    this.attempt = 0;
    this.connect('connecting');
  }

  /** Closes the connection and cancels pending reconnects. */
  stop() {
    this.run++;
    this.active = false;
    this.clearRetry();
    this.closeSocket();
    if (this.status !== 'idle') {
      this.setStatus('closed');
    }
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status !== status) {
      this.status = status;
      this.options.onStatusChange(status);
    }
  }

  private connect(status: 'connecting' | 'reconnecting', afterRefresh = false) {
    this.afterRefresh = afterRefresh;
    const token = this.options.getAccessToken();
    if (!token) {
      // Signed out: nothing to connect with.
      this.stop();
      return;
    }
    this.setStatus(status);

    const socket = this.createSocket(this.options.url, token);
    this.socket = socket;
    socket.onopen = () => {
      if (socket !== this.socket) {
        return;
      }
      this.openedAt = this.now();
      const reconnected = this.hasBeenOpen;
      this.hasBeenOpen = true;
      this.setStatus('open');
      if (reconnected) {
        this.options.onReconnected();
      }
    };
    socket.onmessage = event => {
      if (socket !== this.socket) {
        return;
      }
      const message = parseServerMessage(event.data);
      if (message) {
        this.options.onMessage(message);
      }
    };
    // The close event that always follows an error carries the reason.
    socket.onerror = () => {};
    socket.onclose = event => {
      if (socket !== this.socket) {
        return;
      }
      this.socket = null;
      this.handleClose(token, event);
    };
  }

  private handleClose(token: string, event: WebSocketCloseEvent) {
    const openedAt = this.openedAt;
    this.openedAt = null;
    if (openedAt !== null && this.now() - openedAt >= STABLE_CONNECTION_MS) {
      this.attempt = 0;
    }
    if (openedAt === null && isAuthRejection(event) && !this.afterRefresh) {
      this.setStatus('reconnecting');
      this.refreshAndRetry(token);
      return;
    }
    this.scheduleRetry();
  }

  private async refreshAndRetry(rejected: string) {
    const run = this.run;
    let fresh: string | null;
    try {
      // Another part of the app may have refreshed the session already.
      const current = this.options.getAccessToken();
      fresh =
        current && current !== rejected
          ? current
          : await this.options.refreshAccessToken();
    } catch {
      // Offline or server error: try again later with backoff.
      if (run === this.run) {
        this.scheduleRetry();
      }
      return;
    }
    if (run !== this.run) {
      return;
    }
    if (fresh) {
      this.connect('reconnecting', true);
    } else {
      // The session is gone (the auth store has logged out).
      this.stop();
    }
  }

  private scheduleRetry() {
    this.setStatus('reconnecting');
    const delay = reconnectDelayMs(this.attempt++, this.random);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect('reconnecting');
    }, delay);
  }

  private clearRetry() {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    this.openedAt = null;
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close(1000, 'client closed');
  }
}
