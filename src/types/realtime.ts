import type { AnnouncementCreatedMessage } from './announcement';
import type { Id } from './common';

/**
 * Sent to every client when a spot's live pet count changes (check-in,
 * check-out, expiry).
 */
export interface SpotUpdateMessage {
  type: 'spot_update';
  spot_id: Id;
  present_count: number;
}

/**
 * What the server pushes over GET /ws/presence. Every message is complete on
 * its own: the app applies it as is, without extra requests.
 */
export type ServerMessage = SpotUpdateMessage | AnnouncementCreatedMessage;
