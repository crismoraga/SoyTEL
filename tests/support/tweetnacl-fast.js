// tweetnacl real, sin modificar, para las pruebas.
//
// Dentro del entorno de Jest cada acceso a un global (Math, Float64Array…) pasa por un interceptor del
// contexto aislado, y tweetnacl hace millones de esos accesos: firmar tarda ~37 ms en vez de ~4 ms.
// Aquí se evalúa el MISMO archivo de la librería con esos globales entregados como variables locales.
// No es un reemplazo ni una simulación: es el mismo código y los mismos algoritmos (X25519,
// XSalsa20-Poly1305, Ed25519, SHA-512), solo que a velocidad normal.
const fs = require('fs');

const file = require.resolve('tweetnacl/nacl-fast.js');
const source = fs.readFileSync(file, 'utf8');
const moduleShim = { exports: {} };
// eslint-disable-next-line no-new-func
const factory = new Function('module', 'exports', 'require', 'Math', 'Float64Array', 'Uint8Array', 'Uint32Array', 'Int32Array', 'Array', 'TypeError', 'Error', 'self', source);
// `self` indefinido: la librería toma el generador aleatorio de `crypto` de Node (el del sistema).
factory(moduleShim, moduleShim.exports, require, Math, Float64Array, Uint8Array, Uint32Array, Int32Array, Array, TypeError, Error, undefined);

module.exports = moduleShim.exports;
module.exports.default = moduleShim.exports;
