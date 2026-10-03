import { Platform, Settings } from 'react-native';

const INSTALLED_KEY = 'tailverse.installed';

/**
 * Whether this is the first launch after the app was installed. iOS keeps
 * Keychain items when the app is deleted, but deletes its UserDefaults
 * (`Settings`), so a missing marker there means a fresh install whose Keychain
 * may still hold a session from before. Android removes both with the app
 * (and backups are off), so it never reports a fresh install.
 */
export function isFreshInstall(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return Settings.get(INSTALLED_KEY) !== true;
  } catch {
    return false;
  }
}

/** Remembers that the app has started on this install. */
export function markInstalled(): void {
  if (Platform.OS !== 'ios') {
    return;
  }
  try {
    Settings.set({ [INSTALLED_KEY]: true });
  } catch {
    // Without the marker the next launch just checks again.
  }
}
