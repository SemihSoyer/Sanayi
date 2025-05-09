const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configure Node.js polyfills
config.resolver.extraNodeModules = {
  stream: require.resolve('readable-stream'),
};

// Skip problematic node_modules
config.resolver.blockList = [
  /\/node_modules\/.*\/node_modules\/react-native\/.*/,
];

// Disable hierarchical lookup to help with nested node_modules resolution
config.resolver.disableHierarchicalLookup = false;

module.exports = config; 