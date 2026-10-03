import * as Keychain from 'react-native-keychain';

/**
 * Small device-level preferences that should survive restarts. The app has no
 * AsyncStorage, so they share one Keychain/Keystore entry as JSON. Not per user:
 * logging out keeps them.
 */
export interface Preferences {
  /** The user closed the "why location helps" card without deciding. */
  locationPromptDismissed?: boolean;
}

const SERVICE = 'com.tailverse.mobile.preferences';
const USERNAME = 'preferences';

/** Saved preferences; empty when none are saved or they can't be read. */
export async function loadPreferences(): Promise<Preferences> {
  try {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE });
    if (!credentials) {
      return {};
    }
    const parsed: unknown = JSON.parse(credentials.password);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Preferences)
      : {};
  } catch {
    return {};
  }
}

/** Merges `changes` into the saved preferences. Best effort: failures are ignored. */
export async function savePreferences(changes: Preferences): Promise<void> {
  try {
    const current = await loadPreferences();
    await Keychain.setGenericPassword(
      USERNAME,
      JSON.stringify({ ...current, ...changes }),
      {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      },
    );
  } catch {
    // A preference that isn't saved only means the card may show again next launch.
  }
}
