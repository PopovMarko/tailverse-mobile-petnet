module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // React Native, React Navigation and react-native-maps ship untranspiled ESM/TS,
  // so they must go through Babel too. `.pnpm` is skipped so the check applies to
  // the real package folder inside pnpm's node_modules/.pnpm/<pkg>/node_modules/.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm|(jest-)?react-native[^/]*|@react-native(-community)?|@react-navigation)/)',
  ],
};
