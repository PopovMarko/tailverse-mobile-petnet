import { create } from 'zustand';

import {
  ApiError,
  createPet,
  getMe,
  listMyPets,
  login as loginRequest,
  refreshTokens,
  register as registerRequest,
  setSessionHandler,
  updateMe,
  uploadImage,
} from '../api';
import {
  clearTokens,
  loadTokens,
  saveTokens,
  type StoredTokens,
} from '../services/tokenStorage';
import type {
  Gender,
  Owner,
  OwnerVisibility,
  Pet,
  PetCreateRequest,
  UploadFile,
} from '../types';
import { describeError } from '../utils/errors';

/**
 * restoring — reading the saved session on app start (splash screen);
 * signedOut — auth screens; signedIn — the app (or pet onboarding first).
 */
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

export interface RegisterInput {
  email: string;
  password: string;
  nickname: string;
  gender: Gender | null;
  visibility: OwnerVisibility;
  /** Local photo; uploaded right after the account is created. */
  avatar: UploadFile | null;
}

export interface RegisterResult {
  /** False when a photo was chosen but could not be uploaded (the account exists anyway). */
  avatarUploaded: boolean;
}

interface AuthState {
  status: AuthStatus;
  /** Set when the saved session could not be checked (e.g. no network) on start. */
  restoreError: string | null;

  accessToken: string | null;
  refreshToken: string | null;

  owner: Owner | null;
  /** The signed-in owner's pets. */
  pets: Pet[];
  /** Signed in but still has to add pets before reaching the main tabs. */
  needsOnboarding: boolean;

  /** Restores the session from secure storage; called once on app start. */
  restoreSession: () => Promise<void>;
  /** Throws ApiError (401 = wrong email or password) or a network error. */
  login: (email: string, password: string) => Promise<void>;
  /** Throws ApiError (409 = email taken, 400 = invalid data) or a network error. */
  register: (input: RegisterInput) => Promise<RegisterResult>;
  /** POST /pets for the signed-in owner; the pet is appended to `pets`. */
  addPet: (pet: PetCreateRequest) => Promise<Pet>;
  /** Reloads `pets` from GET /pets. */
  reloadPets: () => Promise<void>;
  /** Leaves pet onboarding for the main tabs (needs at least one pet). */
  finishOnboarding: () => void;
  /**
   * Exchanges the refresh token for a new pair (one request at a time).
   * Resolves to the new access token, or null after logging out when the
   * refresh token is rejected. Rejects on network/server errors.
   */
  refreshSession: () => Promise<string | null>;
  /** Forgets the session (memory + secure storage) and returns to the auth screens. */
  logout: () => Promise<void>;
}

const signedOutState = {
  status: 'signedOut',
  restoreError: null,
  accessToken: null,
  refreshToken: null,
  owner: null,
  pets: [],
  needsOnboarding: false,
} satisfies Partial<AuthState>;

// Keychain writes and deletes run one after another, so a refresh that
// finishes after logout cannot write the old session back.
let storageQueue: Promise<void> = Promise.resolve();

function persist(operation: () => Promise<void>): Promise<void> {
  storageQueue = storageQueue.then(operation).catch(() => {
    // Secure storage is best effort: the session still works in memory and
    // the user just has to log in again on the next app start.
  });
  return storageQueue;
}

let refreshInFlight: Promise<string | null> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => {
  async function startSession(tokens: StoredTokens) {
    set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });
    await persist(() => saveTokens(tokens));
  }

  /** Loads the profile and pets, then enters the app. */
  async function loadAccount() {
    const [owner, { pets }] = await Promise.all([getMe(), listMyPets()]);
    set({
      status: 'signedIn',
      restoreError: null,
      owner,
      pets,
      needsOnboarding: pets.length === 0,
    });
  }

  return {
    ...signedOutState,
    status: 'restoring',

    restoreSession: async () => {
      set({ status: 'restoring', restoreError: null });
      const tokens = await loadTokens();
      if (!tokens) {
        set(signedOutState);
        return;
      }
      set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      try {
        await loadAccount();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await get().logout();
        } else if (get().refreshToken) {
          // Session may still be valid (e.g. offline): keep it and offer a retry.
          set({ restoreError: describeError(error) });
        }
      }
    },

    login: async (email, password) => {
      const tokens = await loginRequest({ email: email.trim(), password });
      await startSession(tokens);
      try {
        await loadAccount();
      } catch (error) {
        await get().logout();
        throw error;
      }
    },

    register: async ({
      email,
      password,
      nickname,
      gender,
      visibility,
      avatar,
    }) => {
      const created = await registerRequest({
        email: email.trim(),
        password,
        nickname: nickname.trim(),
        ...(gender ? { gender } : {}),
        visibility,
      });
      await startSession(created);

      // The account exists from here on: later failures must not fail registration.
      let owner: Owner | null = null;
      let avatarUploaded = true;
      if (avatar) {
        try {
          const { url } = await uploadImage(avatar);
          owner = await updateMe({ avatar_url: url });
        } catch {
          avatarUploaded = false;
        }
      }
      if (!owner) {
        owner = await getMe().catch(() => null);
      }

      set({
        status: 'signedIn',
        restoreError: null,
        owner,
        pets: [],
        needsOnboarding: true,
      });
      return { avatarUploaded };
    },

    addPet: async pet => {
      const created = await createPet(pet);
      set(state => ({ pets: [...state.pets, created] }));
      return created;
    },

    reloadPets: async () => {
      const { pets } = await listMyPets();
      set({ pets });
    },

    finishOnboarding: () => {
      if (get().pets.length > 0) {
        set({ needsOnboarding: false });
      }
    },

    refreshSession: () => {
      if (refreshInFlight) {
        return refreshInFlight;
      }
      const refreshToken = get().refreshToken;
      if (!refreshToken) {
        return Promise.resolve(null);
      }

      refreshInFlight = (async () => {
        try {
          const tokens = await refreshTokens(refreshToken);
          if (get().refreshToken !== refreshToken) {
            // Logged out (or logged in again) while refreshing.
            return get().accessToken;
          }
          await startSession(tokens);
          return tokens.access_token;
        } catch (error) {
          if (
            error instanceof ApiError &&
            (error.status === 400 || error.status === 401)
          ) {
            if (get().refreshToken === refreshToken) {
              await get().logout();
            }
            return null;
          }
          throw error;
        } finally {
          refreshInFlight = null;
        }
      })();
      return refreshInFlight;
    },

    logout: async () => {
      set(signedOutState);
      await persist(clearTokens);
    },
  };
});

// Let the API client attach the access token and refresh it on 401.
setSessionHandler({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: () => useAuthStore.getState().refreshSession(),
});
