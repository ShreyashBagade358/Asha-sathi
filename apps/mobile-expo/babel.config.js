module.exports = function babelConfig(api) {
  // Jest must not use NativeWind's JSX runtime: it injects an import into every
  // module, including the jest.mock() factories in jest.setup.js, which then
  // fails Jest's out-of-scope-variable guard. The tests assert on behaviour and
  // rendered text, never on class strings (global.css is stubbed), so nothing is
  // lost by using the plain React runtime there.
  const isTest = api.env('test');
  api.cache.using(() => (isTest ? 'test' : 'app'));

  return {
    presets: isTest
      ? ['babel-preset-expo']
      : [
          // jsxImportSource: 'nativewind' makes Metro use NativeWind's JSX
          // runtime, which is what turns className on React Native primitives
          // into styles. Without this preset the app bundles fine but every
          // className is inert, so screens paint with no background or text
          // colour at all - a white screen with no error.
          ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
          'nativewind/babel',
        ],
  };
};
