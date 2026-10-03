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
