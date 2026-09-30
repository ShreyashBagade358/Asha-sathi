// NativeWind compiles global.css at build time; the class names it defines are
// not what the tests assert on, so an empty module is the honest stub. Tests
// that care about styling assert on behaviour, not on class strings.
module.exports = {};
