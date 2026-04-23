const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const NATIVE_ONLY_MODULES = [
  'react-native-worklets',
  'react-native-worklets-core',
];

const workletsShim = path.resolve(__dirname, 'src/shims/react-native-worklets.web.js');

const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NATIVE_ONLY_MODULES.includes(moduleName)) {
    return { filePath: workletsShim, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
