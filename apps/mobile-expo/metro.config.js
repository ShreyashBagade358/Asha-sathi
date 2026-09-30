const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// withNativeWind wires global.css into the Metro CSS pipeline and registers the
// JSX runtime so className works on RN primitives. `input` must match the
// stylesheet declared in app/_layout.tsx via '~/global.css'.
module.exports = withNativeWind(config, { input: './global.css' });
