// Web shim — react-native-worklets has no web implementation
const noop = () => {};
const identity = (v) => v;

const worklets = {
  createWorklet: () => noop,
  makeShareableCloneRecursive: identity,
  makeShareable: identity,
  isWorklet: () => false,
  runOnUI: (fn) => fn,
  runOnJS: (fn) => fn,
  WorkletsModule: {},
};

module.exports = worklets;
module.exports.default = worklets;
