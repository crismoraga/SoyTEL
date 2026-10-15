// https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Fuentes recortadas de la versión web (assets/fonts-web).
config.resolver.assetExts.push('woff2');
const emptyModule = path.resolve(__dirname, 'src/shims/empty.js');
const upstreamResolve = config.resolver.resolveRequest;

// tweetnacl referencia el módulo 'crypto' de Node solo como respaldo; en la app se reemplaza por un módulo vacío.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'crypto' && context.originModulePath.includes(`${path.sep}tweetnacl${path.sep}`)) {
    return { type: 'sourceFile', filePath: emptyModule };
  }
  return upstreamResolve ? upstreamResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
