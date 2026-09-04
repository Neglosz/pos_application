// @testing-library/react-native v13 registers its matchers automatically; only the
// noisy Expo native-module warnings need silencing here.
jest.spyOn(console, 'warn').mockImplementation(() => {});

// @expo/vector-icons pulls in expo-font -> expo-asset, which is not installed and has
// nothing to do with the behaviour under test. Every icon set renders as a plain Text.
jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    const Icon = ({ name, ...rest }) => React.createElement(Text, rest, name || 'icon');
    return new Proxy({}, { get: () => Icon });
});
