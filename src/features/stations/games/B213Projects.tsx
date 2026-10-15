import { StyleSheet, View } from 'react-native';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { seededShuffle } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import type { StationGameProps } from '../kit';
import { MiniBars, Panel, ProjectGame, Readings, type ProjectQuestion, type ProjectSpec } from './ProjectGame';

// Juegos de los proyectos que se muestran en la sala B213 (hechos por estudiantes de Telemática).

const pickN = <T,>(items: T[], count: number, random: () => number) => seededShuffle(items, random).slice(0, count);

// Arma una pregunta: la respuesta correcta y `count - 1` distractores al azar.
function choice(correct: string, distractors: string[], random: () => number, count = 4) {
  const options = [correct, ...pickN(distractors.filter((item) => item !== correct), count - 1, random)];
  return { options, answer: 0 };
}

// ——— Aqua Sense: monitor de pecera (pH y temperatura → dashboard web) ———

type Tank = { ph: number; temp: number; verdict: string; why: string };
const VERDICTS = ['Todo bien', 'Agua muy ácida (pH bajo)', 'Agua muy básica (pH alto)', 'Agua muy caliente', 'Agua muy fría'];

function tankCase(kind: number, random: () => number): Tank {
  const r = (min: number, max: number, digits = 1) => Number((min + random() * (max - min)).toFixed(digits));
  const okPh = r(6.6, 7.4);
  const okTemp = r(24.5, 27.5);
  switch (kind) {
    case 1:
      return { ph: r(5.2, 6.2), temp: okTemp, verdict: VERDICTS[1], why: 'Un pH bajo 6,5 es ácido: los peces sufren.' };
    case 2:
      return { ph: r(7.9, 8.8), temp: okTemp, verdict: VERDICTS[2], why: 'Sobre 7,5 el agua es básica: hay que corregirla.' };
    case 3:
      return { ph: okPh, temp: r(29.5, 32), verdict: VERDICTS[3], why: 'Sobre 28 °C el agua tiene menos oxígeno.' };
    case 4:
      return { ph: okPh, temp: r(19, 22.5), verdict: VERDICTS[4], why: 'Bajo 24 °C los peces tropicales se enfrían.' };
    default:
      return { ph: okPh, temp: okTemp, verdict: VERDICTS[0], why: 'pH entre 6,5 y 7,5 y 24–28 °C: pecera feliz.' };
  }
}

const aquaSense: ProjectSpec = {
  title: 'Aqua Sense',
  accent: '#4FB3C8',
  learned: 'Aqua Sense mide pH y temperatura con sensores, un ESP32 los envía por Wi-Fi y un dashboard web los muestra en vivo: eso es Internet de las Cosas.',
  stages: [
    {
      kind: 'quiz',
      key: 'lecturas',
      label: 'Lecturas de la pecera',
      title: 'Lee los sensores',
      goal: 'Mira el pH y la temperatura y di cómo está la pecera.',
      body: 'Los peces viven bien con pH entre 6,5 y 7,5 y agua entre 24 y 28 °C. Fuera de eso, ¡alerta!',
      icon: 'wave',
      seconds: 45,
      questions: (random) =>
        seededShuffle([0, 1, 2, 3, 4], random)
          .slice(0, 4)
          .map((kind): ProjectQuestion => {
            const tank = tankCase(kind, random);
            const { options, answer } = choice(tank.verdict, VERDICTS, random);
            return {
              visual: (
                <Readings
                  items={[
                    { icon: 'flask', label: 'pH', value: tank.ph.toFixed(1).replace('.', ','), tone: kind === 1 || kind === 2 ? 'bad' : 'plain' },
                    { icon: 'flame', label: 'Temperatura', value: `${tank.temp.toFixed(1).replace('.', ',')} °C`, tone: kind === 3 || kind === 4 ? 'bad' : 'plain' },
                  ]}
                />
              ),
              prompt: '¿Cómo está la pecera?',
              options,
              answer,
              why: tank.why,
            };
          }),
    },
    {
      kind: 'quiz',
      key: 'piezas',
      label: 'Piezas del prototipo',
      title: 'Arma el monitor',
      goal: 'Elige la pieza que hace cada trabajo.',
      body: 'Un prototipo IoT tiene sensores que miden, una placa que piensa y Wi-Fi para enviar los datos.',
      icon: 'cpu',
      seconds: 40,
      questions: (random) => {
        const parts = ['Sensor de pH', 'Sensor de temperatura', 'ESP32 con Wi-Fi', 'Dashboard web', 'Bomba de agua', 'Pantalla LCD'];
        const asks: [string, string, string][] = [
          ['¿Qué mide si el agua es ácida?', 'Sensor de pH', 'La sonda de pH mide la acidez del agua.'],
          ['¿Qué mide el calor del agua?', 'Sensor de temperatura', 'Un sensor sumergible (como el DS18B20) mide los °C.'],
          ['¿Qué envía los datos a Internet?', 'ESP32 con Wi-Fi', 'El ESP32 es una placa pequeña con Wi-Fi incluido.'],
          ['¿Dónde ves los datos desde tu celular?', 'Dashboard web', 'El dashboard es una página web con gráficos en vivo.'],
        ];
        return seededShuffle(asks, random).map(([prompt, correct, why]) => ({ ...choice(correct, parts, random), prompt, why, visual: <DeviceRow /> }));
      },
    },
    {
      kind: 'quiz',
      key: 'dashboard',
      label: 'Dashboard',
      title: 'Lee el dashboard',
      goal: 'Mira el gráfico del día y encuentra la alerta.',
      body: 'El dashboard guarda una lectura cada hora. Un buen ingeniero detecta el problema mirando el gráfico.',
      icon: 'chart',
      seconds: 40,
      questions: (random) => {
        const hours = ['8h', '10h', '12h', '14h', '16h', '18h'];
        return [0, 1, 2].map(() => {
          const hot = Math.floor(random() * hours.length);
          const temps = hours.map((_, index) => (index === hot ? 29 + Math.round(random() * 3) : 24 + Math.round(random() * 3)));
          const { options, answer } = choice(hours[hot], hours, random);
          return {
            visual: <MiniBars values={temps} labels={hours} unit="°" />,
            prompt: '¿A qué hora el agua se calentó de más?',
            options,
            answer,
            why: `A las ${hours[hot]} pasó los 28 °C: el dashboard debería avisar.`,
          };
        });
      },
    },
  ],
};

function DeviceRow() {
  return (
    <View style={styles.row}>
      {(['flask', 'cpu', 'wifi', 'chart'] as const).map((icon, index) => (
        <View key={icon} style={styles.row}>
          {index > 0 && <TelIcon name="arrowRight" size={16} color={colors.accentSoft} />}
          <View style={styles.chip}>
            <TelIcon name={icon} size={24} color={colors.cream} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ——— Corrector de postura: sensor de inclinación en la nuca que suena ———

function Head({ angle, alarm, caption = true }: { angle: number; alarm: boolean; caption?: boolean }) {
  return (
    <View style={styles.headBox}>
      <View style={[styles.neck, { transform: [{ rotate: `${angle}deg` }] }]}>
        <View style={[styles.head, alarm && styles.headAlarm]}>
          <TelIcon name="user" size={34} color={colors.primary} />
        </View>
        <View style={[styles.sensor, alarm && styles.sensorOn]} />
      </View>
      {caption && (
        <TelText variant="caption" color={alarm ? 'dangerLight' : 'accentSoft'} align="center">
          {alarm ? '¡Bip, bip! Endereza la espalda' : 'Silencio: postura correcta'}
        </TelText>
      )}
    </View>
  );
}

const postura: ProjectSpec = {
  title: 'Corrector de postura',
  accent: '#E0B84A',
  learned: 'El corrector usa un acelerómetro en la nuca: cuando el ángulo pasa el umbral, la placa hace sonar un buzzer. Hardware que cuida tu salud.',
  stages: [
    {
      kind: 'quiz',
      key: 'alarma',
      label: '¿Suena o no?',
      title: '¿Suena la alarma?',
      goal: 'La alarma suena si la cabeza se inclina más de 20°.',
      body: 'El sensor mide el ángulo de tu cuello. Si te encorvas más de 20°, el buzzer suena para avisarte.',
      icon: 'alert',
      seconds: 40,
      questions: (random) =>
        seededShuffle([5, 12, 18, 26, 34, 41], random)
          .slice(0, 4)
          .map((angle) => ({
            visual: <Head angle={angle} alarm={false} caption={false} />,
            prompt: `El sensor marca ${angle}°. ¿Qué hace el prototipo?`,
            options: ['¡Suena la alarma!', 'Se queda en silencio'],
            answer: angle > 20 ? 0 : 1,
            why: angle > 20 ? `${angle}° pasa el umbral de 20°: suena.` : `${angle}° está bajo 20°: postura aceptable.`,
          })),
    },
    {
      kind: 'quiz',
      key: 'piezas',
      label: 'Piezas',
      title: 'Las piezas del corrector',
      goal: 'Elige la pieza que hace cada trabajo.',
      body: 'Todo prototipo tiene algo que mide (sensor), algo que decide (placa) y algo que avisa (actuador).',
      icon: 'board',
      seconds: 40,
      questions: (random) => {
        const parts = ['Acelerómetro', 'Buzzer', 'Batería', 'Microcontrolador', 'Cámara', 'Parlante bluetooth'];
        const asks: [string, string, string][] = [
          ['¿Qué mide la inclinación del cuello?', 'Acelerómetro', 'El acelerómetro (o giroscopio) sabe hacia dónde se inclina.'],
          ['¿Qué hace el pitido de aviso?', 'Buzzer', 'El buzzer es un parlante pequeñito que pita.'],
          ['¿Qué compara el ángulo con el umbral?', 'Microcontrolador', 'La placa ejecuta el programa: si ángulo > umbral, suena.'],
          ['¿Qué lo hace funcionar sin cables?', 'Batería', 'Una batería pequeña lo deja usarlo en la nuca.'],
        ];
        return seededShuffle(asks, random).map(([prompt, correct, why]) => ({ ...choice(correct, parts, random), prompt, why }));
      },
    },
    {
      kind: 'dial',
      key: 'calibra',
      label: 'Calibración',
      title: 'Calibra el umbral',
      goal: 'Elige un umbral que suene al encorvarse, pero no al estar derecho.',
      body: 'Si el umbral es muy bajo, suena todo el rato; si es muy alto, nunca avisa. Busca el punto justo.',
      icon: 'settings',
      seconds: 40,
      unit: '°',
      min: 0,
      max: 50,
      step: 5,
      start: 0,
      target: [10, 25],
      visual: (value) => <Head angle={value < 10 ? 8 : 30} alarm={value < 10 || value <= 25} />,
      status: (value) => (value < 10 ? 'Suena incluso sentado derecho (8°): ¡molesta!' : value > 25 ? 'Te encorvas 30° y no suena: no sirve.' : 'Derecho no suena y encorvado sí: ¡perfecto!'),
    },
  ],
};

// ——— Wi-Fi trampa: un ESP32 crea un access point falso que pide tu contraseña ———

function WifiList({ networks }: { networks: { name: string; open: boolean }[] }) {
  return (
    <Panel>
      {networks.map((network) => (
        <View key={network.name} style={styles.wifiRow}>
          <TelIcon name="wifi" size={20} color={colors.cream} />
          <TelText variant="bodyStrong" color="cream" style={styles.grow}>
            {network.name}
          </TelText>
          <TelIcon name={network.open ? 'unlock' : 'lock'} size={18} color={network.open ? '#E58A5A' : colors.accentSoft} />
        </View>
      ))}
    </Panel>
  );
}

function PortalMock({ ask }: { ask: string }) {
  return (
    <Panel tone="warn">
      <TelText variant="bodyStrong" color="cream" align="center">
        📶 Wi-Fi GRATIS
      </TelText>
      <TelText variant="caption" color="cream" align="center">
        {ask}
      </TelText>
      <View style={styles.fakeInput}>
        <TelText variant="caption" color="accentSoft">
          correo@ejemplo.com
        </TelText>
      </View>
      <View style={styles.fakeInput}>
        <TelText variant="caption" color="accentSoft">
          ••••••••
        </TelText>
      </View>
    </Panel>
  );
}

const wifiTrampa: ProjectSpec = {
  title: 'Wi-Fi trampa',
  accent: '#E58A5A',
  learned: 'Con un ESP32 cualquiera puede crear un Wi-Fi abierto que imita uno real y pide tu clave. Por eso en Telemática estudiamos ciberseguridad: para detectar y frenar estos ataques.',
  stages: [
    {
      kind: 'quiz',
      key: 'redes',
      label: 'Elige tu red',
      title: '¿A cuál te conectas?',
      goal: 'Detecta la red sospechosa antes de conectarte.',
      body: 'Los atacantes crean redes abiertas con nombres llamativos. El candado indica que la red tiene contraseña (WPA2/WPA3).',
      icon: 'wifi',
      seconds: 40,
      questions: (random) => {
        const real = ['USM-Estudiantes', 'Casa_Pérez', 'Biblioteca_USM', 'Cafetería Campus'];
        const fake = ['WiFi_GRATIS_USM', 'USM-Estudiantes FREE', 'Internet Gratis 5G', 'Biblioteca_USM_Libre'];
        return [0, 1, 2].map(() => {
          const trap = fake[Math.floor(random() * fake.length)];
          const others = pickN(real, 2, random).map((name) => ({ name, open: false }));
          const networks = seededShuffle([...others, { name: trap, open: true }], random);
          return {
            visual: <WifiList networks={networks} />,
            prompt: '¿Cuál red es probablemente una trampa?',
            options: [trap, ...others.map((item) => item.name)],
            answer: 0,
            why: `«${trap}» está abierta y su nombre promete gratis: típico access point falso.`,
          };
        });
      },
    },
    {
      kind: 'quiz',
      key: 'portal',
      label: 'El portal falso',
      title: 'Te pide iniciar sesión',
      goal: 'Decide qué hacer cuando el Wi-Fi gratis te pide datos.',
      body: 'Al conectarte, el ESP32 muestra una página que imita un inicio de sesión. Todo lo que escribas le llega al atacante.',
      icon: 'shieldLock',
      seconds: 40,
      questions: (random) => {
        const asks = ['Ingresa con tu correo y contraseña de Instagram para navegar gratis.', 'Inicia sesión con tu cuenta de Google para obtener 2 horas gratis.', 'Confirma tu clave del banco para activar el Wi-Fi.', 'Escribe tu correo y contraseña de la USM para conectarte.'];
        return pickN(asks, 3, random).map((ask) => ({
          visual: <PortalMock ask={ask} />,
          prompt: '¿Qué haces?',
          options: ['Cerrar y desconectarme', 'Escribir mis datos, total es gratis', 'Escribir una clave inventada y seguir', 'Compartir la red con mis amigos'],
          answer: 0,
          why: 'Un Wi-Fi nunca necesita la clave de otra cuenta: ciérralo y usa tus datos móviles.',
        }));
      },
    },
    {
      kind: 'quiz',
      key: 'defensa',
      label: 'Defensa',
      title: 'Atrapa al atacante',
      goal: 'Elige la mejor defensa para cada situación.',
      body: 'Saber cómo funciona el ataque es la mejor forma de defenderse. Eso hace un ingeniero en ciberseguridad.',
      icon: 'shieldCheck',
      seconds: 40,
      questions: (random) => {
        const asks: [string, string, string[], string][] = [
          ['¿Qué aparato usó el atacante para crear el Wi-Fi falso?', 'Una placa ESP32', ['Un router de la USM', 'Un satélite', 'Una impresora'], 'El ESP32 es barato, tiene Wi-Fi y cabe en un bolsillo.'],
          ['¿Qué indica que una web es segura?', 'HTTPS y el dominio correcto', ['Que tenga muchos colores', 'Que diga «gratis»', 'Que cargue rápido'], 'Revisa el candado y que el dominio sea el real (usm.cl).'],
          ['Ya escribiste tu clave en un portal falso. ¿Qué haces?', 'Cambiar la contraseña ya', ['Esperar a ver qué pasa', 'Borrar la app', 'Apagar el celular'], 'Cámbiala de inmediato y activa la verificación en dos pasos.'],
          ['¿Qué protege más tu cuenta?', 'Verificación en dos pasos', ['Una clave corta', 'Usar la misma clave en todo', 'Anotarla en el celular'], 'Aunque roben tu clave, sin el segundo paso no entran.'],
        ];
        return pickN(asks, 3, random).map(([prompt, correct, wrong, why]) => ({ options: [correct, ...wrong], answer: 0, prompt, why }));
      },
    },
  ],
};

export function AquaSenseGame(props: StationGameProps) {
  return <ProjectGame spec={aquaSense} {...props} />;
}

export function PosturaGame(props: StationGameProps) {
  return <ProjectGame spec={postura} {...props} />;
}

export function WifiTrampaGame(props: StationGameProps) {
  return <ProjectGame spec={wifiTrampa} {...props} />;
}

export const b213Specs = { aquaSense, postura, wifiTrampa };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(167,212,237,0.15)' },
  headBox: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  neck: { alignItems: 'center', transformOrigin: 'bottom' },
  head: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  headAlarm: { backgroundColor: '#F2B8B8' },
  sensor: { width: 18, height: 10, borderRadius: 3, marginTop: 4, backgroundColor: colors.accent },
  sensorOn: { backgroundColor: '#E07A7A' },
  wifiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  grow: { flex: 1 },
  fakeInput: { borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: spacing.sm, paddingVertical: 6 },
});
