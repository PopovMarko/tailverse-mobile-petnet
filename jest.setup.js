/* eslint-env jest */
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Native modules have no implementation under Jest; stub them.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  class MapView extends React.Component {
    animateToRegion() {}
    render() {
      return React.createElement(View, this.props, this.props.children);
    }
  }
  const Marker = props => React.createElement(View, props, props.children);
  return { __esModule: true, default: MapView, Marker };
});

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn((_success, error) =>
    error?.({ code: 2, message: 'Location unavailable in tests' }),
  ),
}));

// Permission checks/requests resolve to "granted" unless a test overrides them.
jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);

// In-memory Keychain: a Map keyed by service, reset with __resetKeychain().
jest.mock('react-native-keychain', () => {
  const entries = new Map();
  return {
    ACCESSIBLE: {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
        'AccessibleAfterFirstUnlockThisDeviceOnly',
    },
    setGenericPassword: jest.fn(async (username, password, options) => {
      entries.set(options?.service ?? 'default', { username, password });
      return { service: options?.service ?? 'default', storage: 'keychain' };
    }),
    getGenericPassword: jest.fn(async options => {
      const entry = entries.get(options?.service ?? 'default');
      return entry
        ? {
            ...entry,
            service: options?.service ?? 'default',
            storage: 'keychain',
          }
        : false;
    }),
    resetGenericPassword: jest.fn(async options => {
      entries.delete(options?.service ?? 'default');
      return true;
    }),
    __resetKeychain: () => entries.clear(),
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
  launchCamera: jest.fn(async () => ({ didCancel: true })),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  const DateTimePicker = props => React.createElement(View, props);
  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

// No real sockets in tests: the presence connection gets a fake that tests drive
// (see test-utils/fakeWebSocket.ts).
global.WebSocket = require('./test-utils/fakeWebSocket').FakeWebSocket;
