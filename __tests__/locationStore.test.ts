import Geolocation from '@react-native-community/geolocation';
import { Platform } from 'react-native';
import * as Permissions from 'react-native-permissions';

import { loadPreferences } from '../src/services/preferences';
import { useAuthStore } from '../src/store/authStore';
import {
  selectSearchCenter,
  useLocationStore,
} from '../src/store/locationStore';

const checkMock = jest.mocked(Permissions.check);
const requestMock = jest.mocked(Permissions.request);
const positionMock = jest.mocked(Geolocation.getCurrentPosition);

const here = { lat: 47.9055, lng: 33.3905 };

const initialState = useLocationStore.getState();
const initialAuthState = useAuthStore.getState();

beforeAll(() => {
  Platform.OS = 'ios';
});

beforeEach(() => {
  useLocationStore.setState(initialState, true);
  useAuthStore.setState(initialAuthState, true);
  jest.clearAllMocks();
  positionMock.mockImplementation(success =>
    success({
      coords: {
        latitude: here.lat,
        longitude: here.lng,
        altitude: null,
        accuracy: 10,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 0,
    }),
  );
});

test('checkPermission never prompts and stays put when access is undecided', async () => {
  checkMock.mockResolvedValue(Permissions.RESULTS.DENIED);

  await useLocationStore.getState().checkPermission();

  expect(requestMock).not.toHaveBeenCalled();
  expect(positionMock).not.toHaveBeenCalled();
  expect(useLocationStore.getState().permission).toBe('requestable');
  expect(useLocationStore.getState().userPosition).toBeNull();
});

test('checkPermission locates the user when access was granted earlier', async () => {
  checkMock.mockResolvedValue(Permissions.RESULTS.GRANTED);

  await useLocationStore.getState().checkPermission();

  expect(requestMock).not.toHaveBeenCalled();
  const state = useLocationStore.getState();
  expect(state.permission).toBe('granted');
  expect(state.userPosition).toEqual(here);
});

test('requestPermission asks the system and locates on "allow"', async () => {
  requestMock.mockResolvedValue(Permissions.RESULTS.GRANTED);

  const result = await useLocationStore.getState().requestPermission();

  expect(result).toBe('granted');
  expect(requestMock).toHaveBeenCalledWith(
    Permissions.PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  );
  expect(useLocationStore.getState().userPosition).toEqual(here);
});

test('requestPermission remembers a refusal', async () => {
  requestMock.mockResolvedValue(Permissions.RESULTS.BLOCKED);

  await useLocationStore.getState().requestPermission();

  const state = useLocationStore.getState();
  expect(state.permission).toBe('blocked');
  expect(state.declined).toBe(true);
  expect(positionMock).not.toHaveBeenCalled();
});

test('a failed fix keeps the map usable and records the error', async () => {
  positionMock.mockImplementation((_success, error) =>
    error?.({
      code: 2,
      message: 'unavailable',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    }),
  );

  expect(await useLocationStore.getState().locate()).toBeNull();
  const state = useLocationStore.getState();
  expect(state.locating).toBe(false);
  expect(state.positionError).toBe('unavailable');
});

test('dismissing the prompt is saved for the next launch', async () => {
  useLocationStore.getState().dismissPrompt();
  await new Promise<void>(resolve => setImmediate(resolve));

  expect(useLocationStore.getState().promptDismissed).toBe(true);
  expect(await loadPreferences()).toEqual({ locationPromptDismissed: true });
});

test('the manual point wins over the device position and is cleared on logout', () => {
  useLocationStore.setState({ userPosition: here });
  expect(selectSearchCenter(useLocationStore.getState())).toEqual(here);

  const picked = { lat: 47.91, lng: 33.34 };
  useLocationStore.getState().setManualPoint(picked);
  expect(selectSearchCenter(useLocationStore.getState())).toEqual(picked);

  useAuthStore.setState({ status: 'signedIn' });
  useAuthStore.setState({ status: 'signedOut' });
  expect(useLocationStore.getState().manualPoint).toBeNull();
  expect(selectSearchCenter(useLocationStore.getState())).toEqual(here);
});
