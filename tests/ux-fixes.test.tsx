import { ScrollView, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChipGroup } from '@/components/Chips';
import { LoadError } from '@/components/feedback/LoadError';
import { Sheet } from '@/components/Sheet';
import { TelText } from '@/components/TelText';
import { palettes, type ColorToken, type ThemeName } from '@/theme/colors';
import { canRestartAt, getThemePreference, readThemePreference, setThemePreference, systemThemeToApply } from '@/theme/themeStore';

// Hallazgos de experiencia de uso de la auditoría (UXS-09, 11, 12, 13, 15, 16 y 17).

const mockSecure = new Map<string, string>();
const mockLlavero = { falla: false };
const mockReload = jest.fn(async () => undefined);

jest.mock('expo-secure-store', () => ({
  getItem: (key: string) => mockSecure.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (mockLlavero.falla) throw new Error('llavero no disponible');
    mockSecure.set(key, value);
  },
}));

// La hoja usa la raíz de gestos; en las pruebas basta con un contenedor normal.
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: require('react-native').View }));

jest.mock('expo', () => ({ ...jest.requireActual('expo'), reloadAppAsync: (...args: unknown[]) => mockReload(...(args as [])) }));

beforeEach(() => {
  mockSecure.clear();
  mockLlavero.falla = false;
  mockReload.mockClear();
});

describe('UXS-11 / UXS-12 · tema', () => {
  it('la preferencia tiene una sola fuente: lo que se guarda es lo que se lee al arrancar', async () => {
    expect(readThemePreference()).toBe('system');
    expect(await setThemePreference('dark')).toBe(true);
    expect(readThemePreference()).toBe('dark');
    expect(getThemePreference()).toBe('dark');
    // Cambió el tema visible: la interfaz se reinicia para recrear los estilos.
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('si no se puede guardar, no dice que cambió ni reinicia la app', async () => {
    expect(await setThemePreference('light')).toBe(true);
    mockReload.mockClear();
    mockLlavero.falla = true;
    expect(await setThemePreference('dark')).toBe(false);
    expect(getThemePreference()).toBe('light');
    expect(readThemePreference()).toBe('light');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('con "Del teléfono" sigue al sistema; con un tema elegido, no', () => {
    expect(systemThemeToApply('system', 'dark', 'light')).toBe('dark');
    expect(systemThemeToApply('system', 'light', 'dark')).toBe('light');
    expect(systemThemeToApply('system', 'dark', 'dark')).toBeNull();
    expect(systemThemeToApply('system', null, 'light')).toBeNull();
    expect(systemThemeToApply('light', 'dark', 'light')).toBeNull();
    expect(systemThemeToApply('dark', 'light', 'dark')).toBeNull();
  });

  it('el cambio del sistema solo se aplica en pantallas donde reiniciar no interrumpe nada', () => {
    ['/', '/home', '/games', '/career', '/achievements', '/inbox', '/profile', '/ajustes', '/ranking'].forEach((path) => expect(canRestartAt(path)).toBe(true));
    ['/burst', '/runner', '/puzzle', '/estacion', '/millionaire', '/story', '/ruta', '/ruta/juego', '/ruta/stand', '/cuenta', '/cuenta/recuperar', '/practice', '/mascot'].forEach((path) => expect(canRestartAt(path)).toBe(false));
  });
});

// Contraste según WCAG 2.x.
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (index: number) => {
    const raw = parseInt(value.slice(index, index + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('UXS-13 · contraste en los dos temas', () => {
  // Texto sobre el fondo donde realmente se dibuja.
  const text: [ColorToken, ColorToken, string][] = [
    ['ink', 'paper', 'texto principal'],
    ['ink', 'surface', 'texto en tarjeta'],
    ['inkSoft', 'paper', 'texto secundario'],
    ['inkSoft', 'surface', 'texto secundario en tarjeta'],
    ['inkAccent', 'surface', 'enlaces y etiquetas'],
    ['dangerText', 'paper', 'error sobre la pantalla (borrar datos)'],
    ['dangerText', 'surface', 'error en tarjeta (alias, unión a la ruta)'],
    ['dangerText', 'surfaceAlt', 'error en bloque alterno'],
    ['dangerInk', 'dangerSoft', 'aviso de error'],
    ['successInk', 'successSoft', 'aviso de éxito'],
    ['warningInk', 'warningSoft', 'aviso de atención'],
    ['actionInk', 'action', 'botón principal'],
    ['white', 'danger', 'botón destructivo relleno'],
    ['dangerLight', 'primary', 'acción destructiva sobre azul noche (salir de la ruta)'],
    ['dangerLight', 'primarySoft', 'error en tarjeta azul'],
    ['cream', 'primary', 'títulos sobre azul noche'],
    ['accentSoft', 'primary', 'texto secundario sobre azul noche'],
    ['primary', 'cream', 'texto e icono de Rutix sobre crema'],
  ];

  (['light', 'dark'] as ThemeName[]).forEach((theme) => {
    it(`tema ${theme}: todo texto llega a 4,5:1`, () => {
      const colors = palettes[theme];
      const failing = text.map(([fg, bg, what]) => ({ what, ratio: Math.round(contrast(colors[fg], colors[bg]) * 100) / 100 })).filter((item) => item.ratio < 4.5);
      expect(failing).toEqual([]);
    });
  });

  it('el rojo de marca sigue sirviendo como relleno, pero ya no es el color de texto de error', () => {
    // Era el defecto: rojo de marca como texto sobre la superficie oscura.
    expect(contrast(palettes.dark.danger, palettes.dark.surface)).toBeLessThan(4.5);
    expect(contrast(palettes.dark.dangerText, palettes.dark.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('UXS-15 · tamaño de texto del sistema', () => {
  it('el texto crece al menos hasta el 200%', () => {
    render(<TelText>Hola</TelText>);
    expect(screen.getByText('Hola').props.maxFontSizeMultiplier).toBeGreaterThanOrEqual(2);
  });

  it('un límite puntual sigue siendo posible donde no cabe más', () => {
    render(<TelText maxFontSizeMultiplier={1.3}>Pestaña</TelText>);
    expect(screen.getByText('Pestaña').props.maxFontSizeMultiplier).toBe(1.3);
  });
});

describe('UXS-16 · hojas con contenido largo', () => {
  it('el contenido de toda hoja se puede desplazar', () => {
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 320, height: 320 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <Sheet visible onClose={() => undefined} accessibilityLabel="Prueba">
          <Text>Contenido</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    const scrollers = screen.UNSAFE_getAllByType(ScrollView);
    expect(scrollers.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Contenido')).toBeTruthy();
    expect(screen.getByLabelText('Cerrar hoja')).toBeTruthy();
  });
});

describe('UXS-17 · selección exclusiva', () => {
  const options = [
    { id: 'a', label: 'Claro' },
    { id: 'b', label: 'Oscuro' },
  ];

  it('un ajuste se anuncia como grupo de opciones con una marcada', () => {
    const onChange = jest.fn();
    render(<ChipGroup kind="choice" accessibilityLabel="Tema de la app" options={options} value="b" onChange={onChange} />);
    // El grupo lleva su nombre y su rol (no es un solo elemento: cada opción se lee por separado).
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'radiogroup' }).props.accessibilityLabel).toBe('Tema de la app');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Oscuro' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('radio', { name: 'Claro' }).props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(screen.getByRole('radio', { name: 'Claro' }));
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('un filtro de lista sigue siendo un grupo de pestañas', () => {
    render(<ChipGroup accessibilityLabel="Filtrar" options={options} value="a" onChange={() => undefined} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Claro' }).props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('UXS-09 · una carga que falla se puede reintentar', () => {
  it('muestra el aviso y llama a reintentar', () => {
    const retry = jest.fn();
    render(<LoadError onRetry={retry} />);
    expect(screen.getByText('No pudimos leer tus datos')).toBeTruthy();
    fireEvent.press(screen.getByText('Reintentar'));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
