import * as Keychain from 'react-native-keychain';

import type { TokensResponse } from '../types';
import { isFreshInstall, markInstalled } from './installMarker';

// One Keychain/Keystore entry holds both tokens as JSON.
const SERVICE = 'com.tailverse.mobile.session';
const USERNAME = 'tokens';

export type StoredTokens = TokensResponse;

function isStoredTokens(value: unknown): value is StoredTokens {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { access_token, refresh_token } = value as Record<string, unknown>;
  return typeof access_token === 'string' && typeof refresh_token === 'string';
}

/** Saves the token pair to secure storage (iOS Keychain / Android Keystore). */
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  const result = await Keychain.setGenericPassword(
    USERNAME,
    JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    }),
    {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    },
  );
  if (result === false) {
    throw new Error('Не удалось сохранить сессию в защищённом хранилище');
  }
}

/** Reads the saved token pair; null when there is none or it is unreadable. */
export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE });
    if (!credentials) {
      return null;
    }
    const parsed: unknown = JSON.parse(credentials.password);
    return isStoredTokens(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * On the first launch after (re)installing, drops a session left in the
 * Keychain by a deleted copy of the app (iOS keeps Keychain items), so a
 * reinstall starts signed out. Call before loadTokens on app start.
 */
export async function forgetPreviousInstallSession(): Promise<void> {
  if (!isFreshInstall()) {
    return;
  }
  try {
    await clearTokens();
  } catch {
    // Nothing to clear, or the Keychain is unavailable: loadTokens copes.
  }
  markInstalled();
}

/** Removes the saved tokens (logout). */
export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
