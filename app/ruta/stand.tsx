import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { ChipGroup, Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { SignalSpinner } from '@/components/feedback/Loaders';
import { ProgressBar } from '@/components/feedback/Progress';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { PlayerAvatar, RouteProgress } from '@/features/route/parts';
import { Leaderboard, Podium } from '@/features/route/Podium';
import { QrCode } from '@/features/route/QrCode';
import { QuizQuestion, QuizReveal } from '@/features/route/QuizViews';
import { formatNumber } from '@/lib/format';
import { paceFactor, paceLabels } from '@/lib/pace';
import { webAppUrl } from '@/realtime/config';
import { pillarIds, stopInfo } from '@/route/content';
import { settingsForPace } from '@/route/engine';
import { RouteUnavailableError, type HostController, type HostView } from '@/route/host';
import { hostManager } from '@/route/hostManager';
import { useHostView, useRouteForeground } from '@/route/hooks';
import { parseStandCode } from '@/route/joinLink';
import type { HostSummary } from '@/route/storage';
import type { PublicPlayer, RouteSnapshot } from '@/route/types';
import type { GamePace } from '@/storage/settings';
import { colors, font, radius, spacing } from '@/theme';

// Hora del stand para las cuentas regresivas (la de quien conduce, también en solo lectura).
function useStandClock(controller: HostController, intervalMs = 500): number {
  const [now, setNow] = useState(() => controller.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(controller.now()), intervalMs);
    return () => clearInterval(timer);
  }, [controller, intervalMs]);
  return now;
}

interface Opened {
  code: string;
  controller: HostController | null;
}

// Modo stand: crea la ruta, muestra el código/QR y conduce al grupo en vivo.
export default function StandScreen() {
  useKeepAwake();
  useRouteForeground();
  const params = useLocalSearchParams<{ codigo?: string | string[] }>();
  const { code, invalid } = parseStandCode(params.codigo);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [taking, setTaking] = useState(false);
  const current = opened && opened.code === code ? opened : null;
  const view = useHostView(current?.controller ?? null);

  useEffect(() => {
    if (!code) return;
    let active = true;
    hostManager.open(code).then(
      (controller) => {
        if (active) setOpened({ code, controller });
      },
      () => {
        if (active) setOpened({ code, controller: null });
      },
    );
    return () => {
      active = false;
    };
  }, [code]);

  async function takeControl() {
    if (!code || taking) return;
    setTaking(true);
    try {
      const controller = await hostManager.open(code, true);
      setOpened({ code, controller });
    } catch {
      // Queda en solo lectura; el aviso en pantalla sigue ofreciendo tomar el control.
    } finally {
      setTaking(false);
    }
  }

  if (invalid) {
    return (
      <Screen tone="dark" header={<AppHeader transparent compact onBack={() => router.replace('/ruta/stand')} />}>
        <View style={styles.center}>
          <TelText variant="title" color="cream" align="center">
            Ese enlace del stand no es válido
          </TelText>
          <TelText variant="body" color="accentSoft" align="center">
            Abre la ruta desde la lista del modo stand.
          </TelText>
          <TelButton label="Volver al modo stand" variant="cream" onPress={() => router.replace('/ruta/stand')} />
        </View>
      </Screen>
    );
  }
  if (!code) return <StandHome />;
  if (current && !current.controller) {
    return (
      <Screen tone="dark" header={<AppHeader transparent compact onBack={() => router.replace('/ruta/stand')} />}>
        <View style={styles.center}>
          <TelText variant="title" color="cream" align="center">
            La ruta {code} no está en este dispositivo
          </TelText>
          <TelText variant="body" color="accentSoft" align="center">
            Una ruta solo se puede conducir desde el equipo donde se creó (o se guardó con una versión anterior de la app).
          </TelText>
          <TelButton label="Volver al modo stand" variant="cream" onPress={() => router.replace('/ruta/stand')} />
        </View>
      </Screen>
    );
  }
  if (!current?.controller || !view) {
    return (
      <Screen tone="dark" header={<AppHeader transparent compact />}>
        <View style={styles.center}>
          <SignalSpinner size={80} />
          <TelText variant="heading" color="cream">
            Abriendo la ruta {code}…
          </TelText>
        </View>
      </Screen>
    );
  }
  return <StandLive controller={current.controller} view={view} taking={taking} onTakeControl={() => void takeControl()} />;
}

const QUESTION_OPTIONS = [
  { id: '8', label: '8 preguntas' },
  { id: '10', label: '10 preguntas' },
  { id: '12', label: '12 preguntas' },
];

const PACE_OPTIONS: { id: GamePace; label: string }[] = [
  { id: 'calm', label: `Ritmo ${paceLabels.calm.label.toLowerCase()}` },
  { id: 'normal', label: paceLabels.normal.label },
  { id: 'fast', label: paceLabels.fast.label },
];

const PROJECT_OPTIONS = [
  { id: '10', label: '10 min en B213' },
  { id: '15', label: '15 min' },
  { id: '20', label: '20 min' },
];

function StandHome() {
  const [codes, setCodes] = useState<HostSummary[]>([]);
  const [questions, setQuestions] = useState('10');
  const [minutes, setMinutes] = useState('15');
  const [pace, setPace] = useState<GamePace>('calm');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);

  useEffect(() => {
    let active = true;
    hostManager.list().then(
      (list) => {
        if (active) setCodes(list);
      },
      () => {
        if (active) setCodes([]);
      },
    );
    return () => {
      active = false;
    };
  }, [listVersion]);

  async function create() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const controller = await hostManager.create({ ...settingsForPace(paceFactor(pace)), quizQuestions: Number(questions), projectsSeconds: Number(minutes) * 60 });
      router.replace({ pathname: '/ruta/stand', params: { codigo: controller.code } });
    } catch (reason) {
      setError(
        reason instanceof RouteUnavailableError && reason.reason === 'storage'
          ? 'No se pudo guardar la ruta en este dispositivo. Libera espacio (o sal del modo privado del navegador) e inténtalo de nuevo.'
          : 'No hay conexión con los servidores en vivo. Revisa el Wi-Fi o los datos de este dispositivo e inténtalo de nuevo.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function forget(code: string) {
    await hostManager.close(code).catch(() => undefined);
    setListVersion((value) => value + 1);
  }

  return (
    <Screen
      header={<AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/ruta'))} kicker="Modo stand" title="Conduce una ruta" subtitle="Para el equipo del stand de Telemática" />}
    >
      <TelCard style={styles.gap}>
        <Tag tone="sky" icon="flag" label="NUEVA RUTA" />
        <TelText variant="body" color="ink">
          Crea la ruta y muestra el código o el QR en la pantalla del stand. Los participantes se unen desde su teléfono y la ruta avanza sola: B215 → B213 → pasillo.
        </TelText>
        <ChipGroup options={QUESTION_OPTIONS} value={questions} onChange={setQuestions} accessibilityLabel="Preguntas de la trivia" />
        <ChipGroup options={PROJECT_OPTIONS} value={minutes} onChange={setMinutes} accessibilityLabel="Tiempo en la sala B213" />
        <ChipGroup options={PACE_OPTIONS} value={pace} onChange={setPace} accessibilityLabel="Ritmo de los juegos" />
        <TelText variant="caption" color="inkSoft">
          {paceLabels[pace].description} El ritmo es el mismo para todo el grupo.
        </TelText>
        {error && (
          <TelText variant="caption" color="danger" accessibilityLiveRegion="polite">
            {error}
          </TelText>
        )}
        <TelButton label={error ? 'Reintentar' : 'Crear ruta'} icon={error ? 'refresh' : 'plus'} loading={creating} onPress={() => void create()} />
        <TelText variant="caption" color="inkSoft">
          Deja este dispositivo encendido y conectado mientras dure la ruta: es el que lleva el puntaje.
        </TelText>
      </TelCard>
      {codes.length > 0 && (
        <View style={styles.gap}>
          <TelText variant="heading" color="ink">
            Rutas en este dispositivo
          </TelText>
          {codes.map((item) =>
            item.legacy ? (
              <TelCard key={item.code} style={styles.savedRow}>
                <TelText variant="heading" color="inkSoft" style={styles.codeSmall}>
                  {item.code}
                </TelText>
                <View style={styles.flex}>
                  <TelText variant="label" color="inkSoft">
                    De una versión anterior
                  </TelText>
                  <TelText variant="caption" color="inkSoft">
                    No se puede retomar con esta versión de la app.
                  </TelText>
                </View>
                <IconButton icon="trash" size={40} accessibilityLabel={`Borrar la ruta ${item.code}`} onPress={() => void forget(item.code)} />
              </TelCard>
            ) : (
              <TelCard key={item.code} onPress={() => router.replace({ pathname: '/ruta/stand', params: { codigo: item.code } })} accessibilityLabel={`Abrir ruta ${item.code}`} style={styles.savedRow}>
                <TelText variant="heading" color="ink" style={styles.codeSmall}>
                  {item.code}
                </TelText>
                <View style={styles.flex}>
                  <TelText variant="label" color="inkAccent">
                    {item.players} participantes
                  </TelText>
                  <TelText variant="caption" color="inkSoft">
                    {phaseLabel(item.phase, item.stop)}
                  </TelText>
                </View>
                <TelIcon name="chevronRight" size={20} color={colors.primary} />
              </TelCard>
            ),
          )}
        </View>
      )}
    </Screen>
  );
}

function phaseLabel(phase: string, stop?: string): string {
  switch (phase) {
    case 'lobby':
      return 'Esperando participantes';
    case 'checkin':
      return `Llegando a ${stopInfo((stop ?? 'b215') as RouteSnapshot['stop']).place}`;
    case 'play':
      return 'Jugando en B215';
    case 'results':
      return 'Resultados de B215';
    case 'projects':
      return 'Proyectos de B213';
    case 'quiz':
      return 'Trivia en el pasillo';
    case 'podium':
      return 'Ruta terminada';
    default:
      return phase;
  }
}

function linkLabel(view: HostView): { ok: boolean; label: string } {
  // El stand está en todos los servidores a la vez; la ruta funciona mientras quede al menos uno.
  if (view.link === 'online') return { ok: true, label: view.brokerCount > 1 && !view.solo ? `En línea · ${view.brokersOnline}/${view.brokerCount}` : 'En línea' };
  if (view.link === 'denied') return { ok: false, label: 'Servidor no disponible' };
  return { ok: false, label: 'Conectando…' };
}

function StandLive({ controller, view, taking, onTakeControl }: { controller: HostController; view: HostView; taking: boolean; onTakeControl: () => void }) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const snapshot = view.snapshot;
  const readOnly = view.readOnly;
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [copied, setCopied] = useState(false);
  const joinHost = webAppUrl.replace(/^https?:\/\//, '');
  const link = linkLabel(view);

  const codePanel = (
    <TelCard tone="navy" style={[styles.codePanel, wide && styles.codePanelWide]}>
      <View style={styles.rowBetween}>
        <Tag tone={link.ok ? 'success' : 'warning'} icon={link.ok ? 'wifi' : 'wifiOff'} label={link.label} />
        <Tag tone="glass" icon="users" label={`${snapshot.players.length}`} />
      </View>
      <TelText variant="overline" color="accent" align="center">
        Código de la ruta
      </TelText>
      <TelText variant="display" color="cream" align="center" style={[styles.bigCode, wide && styles.bigCodeWide]}>
        {view.code}
      </TelText>
      <View style={styles.qrWrap}>
        <QrCode value={view.joinUrl} size={wide ? 280 : 220} />
      </View>
      <TelText variant="label" color="accentSoft" align="center">
        Escanea o entra a {joinHost}/ruta
      </TelText>
      <View style={styles.verify} accessible accessibilityLabel={`Código de verificación: ${view.verification.split('').join(' ')}`}>
        <TelIcon name="shieldCheck" size={16} color={colors.accent} />
        <TelText variant="small" color="accentSoft">
          Verificación en los teléfonos:
        </TelText>
        <TelText variant="label" color="cream" style={styles.verifyCode}>
          {view.verification}
        </TelText>
      </View>
      <TelButton
        label={copied ? '¡Enlace copiado!' : 'Copiar enlace para unirse'}
        variant="outlineLight"
        size="sm"
        icon="share"
        onPress={() => {
          void Clipboard.setStringAsync(view.joinUrl).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      />
    </TelCard>
  );

  const controlPanel = (
    <View style={[styles.gap, wide && styles.flex]}>
      {view.impostor && (
        <TelCard tone="danger" style={styles.gap}>
          <TelText variant="subtitle" color="dangerInk">
            Otro dispositivo está usando el código {view.code}
          </TelText>
          <TelText variant="caption" color="dangerInk">
            Pide que se unan escaneando el QR (verifica el stand automáticamente) y que revisen que su teléfono muestre la verificación {view.verification}. Si persiste, crea una ruta nueva.
          </TelText>
        </TelCard>
      )}
      {readOnly && (
        <TelCard tone="danger" style={styles.gap}>
          <TelText variant="subtitle" color="dangerInk">
            Solo lectura: esta ruta la conduce otra pantalla
          </TelText>
          <TelText variant="caption" color="dangerInk">
            Aquí la ves en vivo, pero el puntaje lo lleva la otra pantalla. Si esa pantalla se cerró o quedó sin conexión, toma el control aquí.
          </TelText>
          <TelButton label="Tomar el control en esta pantalla" variant="danger" loading={taking} onPress={onTakeControl} />
        </TelCard>
      )}
      {!readOnly && view.storage !== 'ok' && (
        <TelCard tone="danger" style={styles.gap}>
          <TelText variant="subtitle" color="dangerInk">
            {view.storage === 'failing' ? 'Guardando la ruta… (reintentando)' : 'Este dispositivo no puede guardar la ruta'}
          </TelText>
          <TelText variant="caption" color="dangerInk">
            {view.storage === 'failing'
              ? 'Mientras no se guarde, los teléfonos verán sus envíos como pendientes. Se reintenta solo.'
              : 'La ruta sigue funcionando, pero si se cierra esta pantalla se pierde el avance. Libera espacio o evita el modo privado del navegador.'}
          </TelText>
        </TelCard>
      )}
      {!readOnly && view.link === 'denied' && (
        <TelCard tone="danger" style={styles.gap}>
          <TelText variant="subtitle" color="dangerInk">
            El servidor en vivo rechazó la conexión
          </TelText>
          <TelText variant="caption" color="dangerInk">
            La ruta se está mudando a otro servidor; los teléfonos la siguen solos. Si no vuelve, revisa la red de este dispositivo.
          </TelText>
        </TelCard>
      )}
      {view.legacyClient && (
        <TelCard tone="dark" style={styles.gap}>
          <TelText variant="subtitle" color="cream">
            Un teléfono con una versión antigua intentó unirse
          </TelText>
          <TelText variant="caption" color="accentSoft">
            Pídele que escanee el QR con la cámara para entrar desde el navegador, o que actualice la app.
          </TelText>
        </TelCard>
      )}
      <PhasePanel controller={controller} snapshot={snapshot} wide={wide} readOnly={readOnly} />
      {snapshot.phase !== 'podium' && (
        <View style={styles.gap}>
          <TelText variant="heading" color="cream">
            Participantes
          </TelText>
          {snapshot.players.length === 0 && (
            <TelText variant="body" color="accentSoft">
              Aún no se une nadie. Muestra el código o el QR.
            </TelText>
          )}
          {snapshot.players.map((player) => (
            <PlayerRow key={player.id} player={player} snapshot={snapshot} onKick={readOnly ? null : () => controller.dispatch({ type: 'kick', id: player.id })} />
          ))}
        </View>
      )}
      {!readOnly && snapshot.phase !== 'lobby' && snapshot.phase !== 'podium' && (
        <View style={styles.gap}>
          {confirmFinish ? (
            <TelCard tone="dark" style={styles.gap}>
              <TelText variant="subtitle" color="cream">
                ¿Terminar la ruta ahora y mostrar el podio?
              </TelText>
              <TelText variant="caption" color="accentSoft">
                Los puntajes se mantienen, pero una ruta cerrada antes del final de la trivia no cuenta como completada (no entrega los logros de ruta).
              </TelText>
              <TelButton label="Sí, mostrar podio" variant="danger" onPress={() => controller.dispatch({ type: 'finish' })} />
              <TelButton label="Cancelar" variant="outlineLight" onPress={() => setConfirmFinish(false)} />
            </TelCard>
          ) : (
            <TelButton label="Terminar ruta ahora" variant="outlineLight" icon="flag" size="sm" onPress={() => setConfirmFinish(true)} />
          )}
        </View>
      )}
      <StatusPanel controller={controller} view={view} />
    </View>
  );

  return (
    <Screen
      tone="dark"
      backdrop="stars"
      header={
        <AppHeader
          compact
          onBack={() => router.replace('/ruta/stand')}
          right={<IconButton icon="home" tone="dark" accessibilityLabel="Ir al inicio" onPress={() => router.replace('/home')} />}
        >
          <RouteProgress stop={snapshot.stop} finished={snapshot.phase === 'podium'} />
        </AppHeader>
      }
    >
      {snapshot.phase === 'podium' && <Celebration burstKey={snapshot.code} count={60} />}
      <View style={[styles.layout, wide && styles.layoutWide]}>
        {codePanel}
        {controlPanel}
      </View>
    </Screen>
  );
}

// Estado de la conexión y del guardado, para saber de un vistazo si la ruta está sana (y poder
// copiarlo al pedir ayuda). No incluye llaves, alias ni el código.
function StatusPanel({ controller, view }: { controller: HostController; view: HostView }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!open) {
    return <TelButton label="Estado de la conexión" variant="ghostLight" size="sm" icon="info" onPress={() => setOpen(true)} />;
  }
  const info = controller.getDiagnostics();
  const rows: [string, string][] = [
    ['Conexión', view.link === 'online' ? `En línea en ${info.brokersOnline} de ${info.brokers} servidores` : linkLabel(view).label],
    ['Guardado', view.storage === 'ok' ? `Al día (${info.counters.saves} guardados)` : view.storage === 'failing' ? 'Reintentando' : 'No disponible en este dispositivo'],
    ['Conducción', view.readOnly ? 'Otra pantalla (aquí, solo lectura)' : `Esta pantalla · época ${info.epoch}`],
    ['Participantes', `${info.online} en línea de ${info.players}`],
    ['Estados publicados', `${info.publications}`],
  ];
  return (
    <TelCard tone="dark" style={styles.gap}>
      <View style={styles.rowBetween}>
        <TelText variant="subtitle" color="cream">
          Estado de la conexión
        </TelText>
        <IconButton icon="close" tone="dark" size={36} accessibilityLabel="Cerrar el estado de la conexión" onPress={() => setOpen(false)} />
      </View>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.rowBetween}>
          <TelText variant="caption" color="accentSoft">
            {label}
          </TelText>
          <TelText variant="caption" color="cream" style={styles.statusValue}>
            {value}
          </TelText>
        </View>
      ))}
      <TelButton
        label={copied ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}
        variant="outlineLight"
        size="sm"
        icon="share"
        onPress={() => {
          void Clipboard.setStringAsync(JSON.stringify({ app: 'SoyTEL', pantalla: 'stand', ...controller.getDiagnostics() }, null, 2)).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      />
      <TelText variant="small" color="accentSoft">
        No incluye nombres, llaves ni el código de la ruta.
      </TelText>
    </TelCard>
  );
}

function PlayerRow({ player, snapshot, onKick }: { player: PublicPlayer; snapshot: RouteSnapshot; onKick: (() => void) | null }) {
  const [confirm, setConfirm] = useState(false);
  let status = '';
  if (snapshot.phase === 'lobby') status = 'En el stand';
  else if (snapshot.phase === 'checkin') status = player.checkedIn ? 'Llegó' : 'En camino';
  else if (snapshot.phase === 'play' || snapshot.phase === 'results') status = player.games['red-b215'] !== undefined ? `B215: ${player.games['red-b215']}` : 'Jugando';
  else if (snapshot.phase === 'projects') status = `${pillarIds.filter((id) => player.games[id] !== undefined).length}/5 pilares`;
  else if (snapshot.phase === 'quiz') status = player.answered ? 'Respondió' : '…';
  return (
    <View style={styles.playerRow}>
      <PlayerAvatar avatar={player.avatar} size={38} online={player.online} />
      <View style={styles.flex}>
        <TelText variant="label" color="cream" numberOfLines={1}>
          {player.alias}
        </TelText>
        <TelText variant="small" color={player.online ? 'accentSoft' : 'slate'}>
          {player.online ? status : 'Sin conexión'} · {formatNumber(player.total)} pts
        </TelText>
      </View>
      {player.flagged && (
        <View style={styles.flag} accessible accessibilityLabel="Envió un puntaje en un tiempo imposible">
          <TelIcon name="alert" size={16} color={colors.warning} />
        </View>
      )}
      {onKick &&
        (confirm ? (
          <View style={styles.kickRow}>
            <TelButton label="Quitar" variant="danger" size="sm" fullWidth={false} onPress={onKick} />
            <IconButton icon="close" tone="dark" size={36} accessibilityLabel="Cancelar" onPress={() => setConfirm(false)} />
          </View>
        ) : (
          <IconButton icon="trash" tone="dark" size={36} accessibilityLabel={`Quitar a ${player.alias}`} onPress={() => setConfirm(true)} />
        ))}
    </View>
  );
}

function PhasePanel({ controller, snapshot, wide, readOnly }: { controller: HostController; snapshot: RouteSnapshot; wide: boolean; readOnly: boolean }) {
  const hostNow = useStandClock(controller, snapshot.phase === 'quiz' ? 200 : 1000);
  const players = snapshot.players;
  const online = players.filter((player) => player.online);
  const seconds = snapshot.deadline ? Math.max(0, Math.ceil((snapshot.deadline - hostNow) / 1000)) : null;
  const advance = () => controller.dispatch({ type: 'advance' });

  if (snapshot.phase === 'podium') {
    return (
      <Animated.View entering={FadeIn} style={styles.gap}>
        <TelText variant="title" color="cream" align="center">
          ¡Felicitaciones a los ganadores!
        </TelText>
        {players.length > 0 && <Podium players={players} large={wide} />}
        <Leaderboard players={players} />
        {!readOnly && (
          <TelButton
            label="Cerrar y crear otra ruta"
            variant="cream"
            icon="plus"
            onPress={() => {
              void hostManager
                .close(snapshot.code)
                .catch(() => undefined)
                .then(() => router.replace('/ruta/stand'));
            }}
          />
        )}
      </Animated.View>
    );
  }

  if (snapshot.phase === 'quiz' && snapshot.quiz) {
    return (
      <View style={styles.gap}>
        {snapshot.quiz.step === 'question' ? (
          <QuizQuestion quiz={snapshot.quiz} hostNow={hostNow} chosen={null} answeredCount={snapshot.quiz.answered} playerCount={online.length || players.length} large={wide} />
        ) : (
          <QuizReveal quiz={snapshot.quiz} players={players} large={wide} />
        )}
        {!readOnly && <TelButton label={snapshot.quiz.step === 'question' ? 'Revelar respuesta' : 'Siguiente pregunta'} variant="outlineLight" icon="arrowRight" size="sm" onPress={advance} />}
      </View>
    );
  }

  const copy: Record<string, { title: string; body: string; action: string }> = {
    lobby: { title: 'Esperando participantes', body: 'Cuando el grupo esté listo, inicia la ruta: todos recibirán la indicación de ir a la sala B215.', action: `Iniciar ruta (${players.length})` },
    checkin:
      snapshot.stop === 'b215'
        ? { title: 'Rumbo a la sala B215', body: 'El juego parte cuando todos confirmen que llegaron.', action: 'Comenzar sin esperar' }
        : snapshot.stop === 'b213'
          ? { title: 'Rumbo a la sala B213', body: 'Los proyectos se desbloquean cuando todos confirman su llegada.', action: 'Abrir proyectos sin esperar' }
          : { title: 'Rumbo al pasillo', body: 'La trivia final parte cuando todos confirman su llegada. Quien siga en un proyecto lo cierra solo al partir.', action: 'Iniciar trivia sin esperar' },
    play: { title: 'Operación Red B215 en curso', body: 'Cada participante juega en su teléfono. Termina solo al acabar el tiempo o cuando todos envían su puntaje.', action: 'Cerrar el juego ahora' },
    results: { title: 'Resultados de B215', body: 'En unos segundos el grupo sigue a la sala B213.', action: 'Ir a B213 ahora' },
    projects: { title: 'Proyectos de la sala B213', body: 'Cada participante enciende los 5 pilares jugando el juego de cada proyecto.', action: 'Pasar al pasillo ahora' },
  };
  const current = copy[snapshot.phase];
  const ready =
    snapshot.phase === 'checkin'
      ? players.filter((player) => player.checkedIn).length
      : snapshot.phase === 'play' || snapshot.phase === 'results'
        ? players.filter((player) => player.games['red-b215'] !== undefined).length
        : snapshot.phase === 'projects'
          ? players.filter((player) => pillarIds.every((id) => player.games[id] !== undefined)).length
          : players.length;

  return (
    <Animated.View key={`${snapshot.phase}-${snapshot.stop}`} entering={FadeInDown} style={styles.phaseCard}>
      <TelText variant="overline" color="accent">
        {phaseLabel(snapshot.phase, snapshot.stop)}
      </TelText>
      <TelText variant="title" color="cream">
        {current.title}
      </TelText>
      <TelText variant="body" color="accentSoft">
        {current.body}
      </TelText>
      {snapshot.phase !== 'lobby' && (
        <>
          <View style={styles.rowBetween}>
            <TelText variant="label" color="cream">
              Listos: {ready} de {players.length}
            </TelText>
            {seconds !== null && (
              <TelText variant="label" color="cream" tabular>
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
              </TelText>
            )}
          </View>
          <ProgressBar progress={players.length ? ready / players.length : 0} color={colors.accent} trackColor={colors.primary} />
        </>
      )}
      {!readOnly && (
        <TelButton
          label={current.action}
          variant={snapshot.phase === 'lobby' ? 'cream' : 'outlineLight'}
          icon={snapshot.phase === 'lobby' ? 'play' : 'arrowRight'}
          disabled={snapshot.phase === 'lobby' && players.length === 0}
          onPress={() => controller.dispatch(snapshot.phase === 'lobby' ? { type: 'start' } : { type: 'advance' })}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  gap: {
    gap: spacing.sm,
  },
  layout: {
    gap: spacing.md,
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  codePanel: {
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  codePanelWide: {
    width: 360,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  bigCode: {
    letterSpacing: 5,
    fontSize: 46,
    lineHeight: 54,
  },
  bigCodeWide: {
    letterSpacing: 6,
    fontSize: 54,
    lineHeight: 62,
  },
  qrWrap: {
    alignSelf: 'center',
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeSmall: {
    letterSpacing: 3,
    ...font('display'),
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  kickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verify: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  verifyCode: {
    letterSpacing: 3,
  },
  flag: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 160, 23, 0.18)',
  },
  phaseCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(167,212,237,0.25)',
  },
});
