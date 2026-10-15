import { Redirect } from 'expo-router';

// Cualquier ruta desconocida (un enlace viejo o mal escrito) vuelve al inicio en vez de mostrar
// la pantalla "Unmatched Route" de Expo Router.
export default function NotFoundScreen() {
  return <Redirect href="/home" />;
}
