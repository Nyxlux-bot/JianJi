const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'wasm' to asset extensions to resolve SQLite for web
config.resolver.assetExts.push('wasm');

module.exports = config;
