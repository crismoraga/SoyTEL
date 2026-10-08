// Tipos globales de Expo: `process.env`, los módulos de imágenes y fuentes, y el `require` de Metro.
// `expo-env.d.ts` hace lo mismo, pero lo genera `expo start` y no está en el repositorio: sin esta
// referencia, una copia recién clonada (o CI) comprueba los tipos con un `process.env` distinto.
/// <reference types="expo/types" />
