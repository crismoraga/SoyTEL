import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { SignalSpinner } from '@/components/feedback/Loaders';
import { ProgressBar } from '@/components/feedback/Progress';
import { Rutix } from '@/components/graphics/Rutix';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { CoachBubble, useCoachEnabled } from '@/features/coach/CoachBubble';
import { BigCountdown, PlayerAvatar, PlayerChip, RouteProgress } from '@/features/route/parts';
import { Leaderboard, Podium } from '@/features/route/Podium';
import { QuizQuestion, QuizReveal } from '@/features/route/QuizViews';
import { answerNote, isLostEntry as isLost, isOpenEntry as isOpen, pillarState, scoreStatus } from '@/features/route/status';
import { Temple } from '@/features/route/Temple';
import { getStationGame, stationGames } from '@/features/stations/registry';
import type { StationGameResult } from '@/features/stations/kit';
import { now as clockNow } from '@/lib/clock';
import { feedbackHeavy } from '@/lib/feedback';
import { formatNumber } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { currentPaceFactor } from '@/lib/pace';
import { webAppUrl } from '@/realtime/config';
import { checkinCopy, pillarIds, pillars, stationTitles, stopInfo } from '@/route/content';
import { settingsForPace } from '@/route/engine';
import { useHostClock, useHostTimeReached, useMemberView, useRouteForeground } from '@/route/hooks';
import { routeMember, type MemberView, type OutboxView } from '@/route/member';
import { wasRouteRecorded } from '@/route/storage';
import type { CheckinStop, PillarId, PublicPlayer, RouteSnapshot, StationGameId } from '@/route/types';
import { recordGameResult } from '@/storage/profile';
import type { GameResult } from '@/types/game';
import { colors, radius, spacing } from '@/theme';

const PROBLEMS: MemberView['status'][] = ['not-found', 'rejected', 'kicked', 'conflict', 'unreachable', 'incompatible'];

export default function RouteGameScreen() {
  useKeepAwake();
  useRouteForeground();
  const view = useMemberView();
  // Al recargar la página (o reabrir la app) en medio de la ruta, primero se recupera lo guardado:
  // recién entonces se sabe si hay una ruta que seguir o hay que volver al inicio.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let active = true;
    void routeMember.restore().finally(() => {
      if (active) setRestored(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (view.status === 'idle') {
    if (restored) return <Redirect href="/ruta" />;
    return (
      <Screen tone="dark" backdrop="signal" header={<AppHeader transparent compact />}>
        <View style={styles.center}>
          <SignalSpinner size={96} />
        </View>
      </Screen>
    );
  }
  if (view.status === 'elsewhere') return <ElsewhereView view={view} />;
  if (PROBLEMS.includes(view.status)) return <ProblemView view={view} />;
  if (!view.snapshot || !view.me) return <ConnectingView view={view} />;
  return <LiveRoute view={view} snapshot={view.snapshot} me={view.me} />;
}

function exit() {
  void routeMember.leave();
  router.replace('/home');
}

// Copia el estado de la conexión para pedir ayuda (no incluye nombres, llaves ni el código).
function DiagnosticsButton() {
  const [copied, setCopied] = useState(false);
  return (
    <TelButton
      label={copied ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}
      variant="ghostLight"
      size="sm"
      fullWidth={false}
      onPress={() => {
        void Clipboard.setStringAsync(JSON.stringify({ app: 'SoyTEL', pantalla: 'participante', ...routeMember.getDiagnostics() }, null, 2)).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    />
  );
}

function ConnectingView({ view }: { view: MemberView }) {
  const offline = view.link !== 'online' && !view.solo;
  const title =
    view.status === 'joined'
      ? 'Recuperando tu lugar…'
      : view.status === 'connecting'
        ? 'Volviendo a tu ruta…'
        : view.verification
          ? 'Entrando al grupo…'
          : 'Buscando la ruta…';
  return (
    <Screen tone="dark" backdrop="signal" header={<AppHeader transparent compact onBack={exit} />}>
      <View style={styles.center}>
        <SignalSpinner size={96} />
        <TelText variant="title" color="cream" align="center">
          {title}
        </TelText>
        <TelText variant="body" color="accentSoft" align="center" accessibilityLiveRegion="polite">
          {view.solo
            ? 'Preparando tu ruta individual.'
            : offline
              ? `Sin conexión a Internet. Seguimos intentando con el código ${view.code}; revisa el Wi-Fi o los datos.`
              : `Código ${view.code}. Esto toma unos segundos; mantén la app abierta.`}
        </TelText>
        <TelButton label="Cancelar" variant="outlineLight" fullWidth={false} onPress={exit} />
        {!view.solo && (
          <TelButton
            label="Jugar sin grupo"
            variant="ghostLight"
            size="sm"
            fullWidth={false}
            onPress={() => routeMember.startSolo({ alias: view.alias.trim() || 'Explorador', avatar: view.avatar, settings: settingsForPace(currentPaceFactor()) })}
          />
        )}
        {!view.solo && <DiagnosticsButton />}
      </View>
    </Screen>
  );
}

// La ruta quedó abierta en otra pestaña del mismo navegador (por ejemplo, al escanear el QR otra vez).
// Solo una puede estar conectada; esta ofrece volver a tomarla con un toque.
function ElsewhereView({ view }: { view: MemberView }) {
  const [resuming, setResuming] = useState(false);
  return (
    <Screen tone="dark" backdrop="stars" header={<AppHeader transparent compact onBack={() => router.replace('/home')} />}>
      <View style={styles.center}>
        <Rutix size={150} expression="think" />
        <TelText variant="title" color="cream" align="center">
          La ruta sigue en otra pestaña
        </TelText>
        <TelText variant="body" color="accentSoft" align="center" accessibilityLiveRegion="polite">
          Abriste SoyTEL en otra pestaña de este navegador y la ruta {view.code} continúa ahí. Tu lugar y tus puntos están a salvo: puedes seguir jugando aquí cuando quieras.
        </TelText>
        <TelButton
          label="Seguir en esta pestaña"
          variant="cream"
          icon="refresh"
          loading={resuming}
          onPress={() => {
            setResuming(true);
            void routeMember.resumeHere().finally(() => setResuming(false));
          }}
        />
        <TelButton label="Ir al inicio" variant="outlineLight" onPress={() => router.replace('/home')} />
      </View>
    </Screen>
  );
}

function problemCopy(view: MemberView): { title: string; body: string } {
  switch (view.status) {
    case 'conflict':
      return {
        title: 'Hay dos stands con ese código',
        body: 'Por seguridad no te unimos a ninguno. Escanea el QR de la pantalla del stand (así verificamos que sea el correcto) o pide un código nuevo.',
      };
    case 'not-found':
      return { title: 'No encontramos esa ruta', body: `Revisa el código ${view.code} en la pantalla del stand. Si el stand acaba de crearla, reintenta en unos segundos.` };
    case 'unreachable':
      return {
        title: 'El stand no responde',
        body: `Encontramos la ruta ${view.code}, pero su pantalla no contesta. Revisa tu conexión y pide al equipo que confirme que la pantalla del stand sigue abierta y en línea.`,
      };
    case 'incompatible':
      return view.incompatible === 'client-old'
        ? { title: 'Necesitas actualizar SoyTEL', body: `Esta ruta usa una versión más nueva de la app. Actualízala o entra desde el navegador en ${webAppUrl.replace(/^https?:\/\//, '')}/ruta.` }
        : { title: 'El stand usa una versión anterior', body: 'Pide al equipo del stand que actualice su pantalla (basta con recargarla) y vuelve a intentar.' };
    case 'kicked':
      return { title: 'Saliste de la ruta', body: 'El equipo del stand te quitó de esta ruta. Si fue un error, pídeles que te ayuden a entrar de nuevo.' };
    default:
      if (view.rejection === 'full') return { title: 'La ruta está llena', body: 'Este grupo ya alcanzó el máximo de participantes. Espera la siguiente ruta en el stand.' };
      if (view.rejection === 'finished') return { title: 'Esa ruta ya terminó', body: 'Pide en el stand el código de la próxima ruta.' };
      return { title: 'No pudimos unirte', body: 'Vuelve a intentarlo desde el inicio de la ruta.' };
  }
}

function ProblemView({ view }: { view: MemberView }) {
  const copy = problemCopy(view);
  const canRetry = view.status === 'not-found' || view.status === 'conflict' || view.status === 'unreachable' || view.status === 'incompatible';
  return (
    <Screen tone="dark" backdrop="stars" header={<AppHeader transparent compact onBack={exit} />}>
      <View style={styles.center}>
        <Rutix size={150} expression="sad" />
        <TelText variant="title" color="cream" align="center">
          {copy.title}
        </TelText>
        <TelText variant="body" color="accentSoft" align="center">
          {copy.body}
        </TelText>
        {canRetry && <TelButton label="Reintentar" variant="cream" icon="refresh" onPress={() => routeMember.retryJoin()} />}
        <TelButton
          label="Usar otro código"
          variant="outlineLight"
          onPress={() => {
            void routeMember.leave(false);
            router.replace('/ruta');
          }}
        />
        {/* Nadie se queda sin jugar: la misma ruta se puede recorrer sin grupo, incluso sin Internet. */}
        <TelButton
          label="Jugar la ruta sin grupo"
          variant="ghostLight"
          icon="user"
          onPress={() => routeMember.startSolo({ alias: view.alias.trim() || 'Explorador', avatar: view.avatar, settings: settingsForPace(currentPaceFactor()) })}
        />
        {view.status !== 'kicked' && view.status !== 'rejected' && <DiagnosticsButton />}
      </View>
    </Screen>
  );
}

function LiveRoute({ view, snapshot, me }: { view: MemberView; snapshot: RouteSnapshot; me: PublicPlayer }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Juegos en curso que deben sobrevivir al cambio de fase (si el stand avanza, se envía lo logrado).
  const [b215Started, setB215Started] = useState(false);
  const [activeProject, setActiveProject] = useState<PillarId | null>(null);
  const b215Pending = b215Started && me.games['red-b215'] === undefined && !view.outbox['score:red-b215'];
  const waiting = view.pending.length;
  const noSignal = !view.solo && (view.link !== 'online' || !view.hostAlive);

  const header = (
    <AppHeader
      compact
      onBack={() => router.back()}
      right={
        <View style={styles.headerRight}>
          {!view.solo && view.link !== 'online' && <Tag tone="warning" icon="wifiOff" label="Reconectando" />}
          {!view.solo && view.link === 'online' && !view.hostAlive && <Tag tone="warning" icon="wifiOff" label="Sin señal del stand" />}
          {me.total > 0 && <Tag tone="glass" icon="star" label={`${formatNumber(me.total)} pts`} />}
          <IconButton icon="close" tone="dark" size={40} accessibilityLabel="Salir de la ruta" onPress={() => setConfirmLeave(true)} />
        </View>
      }
    >
      <RouteProgress stop={snapshot.stop} finished={snapshot.phase === 'podium'} />
      {noSignal && waiting > 0 && (
        <TelText variant="small" color="accentSoft" align="center" accessibilityLiveRegion="polite">
          {waiting === 1 ? 'Tienes 1 envío guardado en el teléfono.' : `Tienes ${waiting} envíos guardados en el teléfono.`} Se mandan solos al volver la señal.
        </TelText>
      )}
    </AppHeader>
  );

  if (confirmLeave) {
    return (
      <Screen tone="dark" backdrop="stars" header={header}>
        <View style={styles.center}>
          <Rutix size={130} expression="think" />
          <TelText variant="title" color="cream" align="center">
            ¿Salir de la ruta?
          </TelText>
          <TelText variant="body" color="accentSoft" align="center">
            Perderás tu lugar en el ranking de este grupo.
          </TelText>
          <TelButton label="Seguir jugando" variant="cream" onPress={() => setConfirmLeave(false)} />
          <TelButton label="Salir de la ruta" variant="dangerOutline" onPress={exit} />
          {!view.solo && <DiagnosticsButton />}
        </View>
      </Screen>
    );
  }

  const b215 = (
    <B215View header={header} snapshot={snapshot} me={me} offset={view.offset} entry={view.outbox['score:red-b215']} forceFinish={snapshot.phase !== 'play'} onStarted={() => setB215Started(true)} />
  );
  const projects = <ProjectsView header={header} snapshot={snapshot} me={me} outbox={view.outbox} active={activeProject} onActive={setActiveProject} />;

  switch (snapshot.phase) {
    case 'lobby':
      return <LobbyView header={header} snapshot={snapshot} me={me} solo={view.solo} verification={view.verification} warning={view.warning} />;
    case 'checkin':
      // Si alguien sigue en un proyecto de B213 cuando el grupo sale al pasillo, puede terminarlo.
      if (activeProject && snapshot.stop === 'hall') return projects;
      return <CheckinView header={header} snapshot={snapshot} me={me} entry={view.outbox[`checkin:${snapshot.stop}`]} />;
    case 'play':
      return b215;
    case 'results':
      if (b215Pending) return b215;
      return <ResultsView header={header} snapshot={snapshot} me={me} />;
    case 'projects':
      return projects;
    case 'quiz':
      // La trivia ya partió: el proyecto que quedó abierto se cierra solo y envía lo logrado (una vez).
      if (activeProject) return projects;
      return <QuizView header={header} snapshot={snapshot} me={me} outbox={view.outbox} />;
    case 'podium':
      return <PodiumView header={header} snapshot={snapshot} me={me} solo={view.solo} />;
    default:
      return null;
  }
}

const guideLines: Record<CheckinStop, string> = {
  b215: '¡Sígueme! En la B215 hay routers, switches y access points de verdad: míralos bien, te servirán en el juego.',
  b213: 'En la B213 cada proyecto tiene su juego. Pregúntale a quienes lo presentan: ¡dan buenas pistas!',
  hall: 'Última parada: la trivia. Suma más quien responde bien y rápido. ¡Tú puedes!',
};

// Rutix guía al grupo entre paradas (si está activado en Ajustes).
function Guide({ children }: { children: string }) {
  const coach = useCoachEnabled();
  if (!coach) return null;
  return (
    <CoachBubble mood="tip" size={60}>
      {children}
    </CoachBubble>
  );
}

interface PhaseProps {
  header: React.ReactNode;
  snapshot: RouteSnapshot;
  me: PublicPlayer;
}

function LobbyView({ header, snapshot, me, solo, verification, warning }: PhaseProps & { solo: boolean; verification: string | null; warning: MemberView['warning'] }) {
  const entering = useEntering();
  return (
    <Screen tone="dark" backdrop="signal" header={header}>
      <Animated.View entering={entering.fadeUp()} style={styles.hero}>
        <PlayerAvatar avatar={me.avatar} size={84} />
        <TelText variant="overline" color="accent" align="center">
          {solo ? 'Modo individual' : `Ruta ${snapshot.code}`}
        </TelText>
        <TelText variant="title" color="cream" align="center">
          ¡Estás dentro, {me.alias}!
        </TelText>
        <TelText variant="body" color="accentSoft" align="center">
          Espera a que el equipo del stand inicie la ruta. Mantén esta pantalla abierta.
        </TelText>
      </Animated.View>
      <Guide>{solo ? 'Jugaremos la ruta completa tú y yo. ¡Vamos partiendo!' : 'Ya estás en el grupo. Cuando el stand inicie la ruta te llevo a la primera sala.'}</Guide>
      {warning === 'impostor' && (
        <TelCard tone="danger" style={styles.verifyCard}>
          <TelIcon name="alert" size={22} color={colors.dangerInk} />
          <TelText variant="caption" color="dangerInk" style={styles.flex}>
            Apareció otro dispositivo usando este código. Revisa que el código de verificación coincida con el del stand; si no, sal y escanea su QR.
          </TelText>
        </TelCard>
      )}
      {verification && (
        <View style={styles.verifyRow} accessible accessibilityLabel={`Código de verificación del stand: ${verification.split('').join(' ')}`}>
          <TelIcon name="shieldCheck" size={18} color={colors.accent} />
          <TelText variant="caption" color="accentSoft" style={styles.flex}>
            Verificación del stand
          </TelText>
          <TelText variant="heading" color="cream" style={styles.verifyCode}>
            {verification}
          </TelText>
        </View>
      )}
      <TelCard tone="dark" style={styles.gap}>
        <TelText variant="label" color="cream">
          Grupo · {snapshot.players.length} {snapshot.players.length === 1 ? 'participante' : 'participantes'}
        </TelText>
        <View style={styles.playerGrid}>
          {snapshot.players.map((player) => (
            <Animated.View key={player.id} entering={entering.pop()} style={styles.playerCell}>
              <PlayerAvatar avatar={player.avatar} size={48} online={player.online} />
              <TelText variant="small" color={player.id === me.id ? 'accent' : 'cream'} align="center" numberOfLines={1}>
                {player.alias}
              </TelText>
            </Animated.View>
          ))}
        </View>
      </TelCard>
    </Screen>
  );
}

function CheckinView({ header, snapshot, me, entry }: PhaseProps & { entry: OutboxView | undefined }) {
  const entering = useEntering();
  const stop = snapshot.stop as CheckinStop;
  const copy = checkinCopy[stop];
  const info = stopInfo(stop);
  const confirmed = snapshot.players.filter((player) => player.checkedIn);
  const waitingFor = snapshot.players.filter((player) => !player.checkedIn && player.online);
  const sending = !me.checkedIn && isOpen(entry);
  return (
    <Screen tone="dark" backdrop="stars" header={header}>
      <Animated.View key={stop} entering={entering.fadeUp()} style={styles.hero}>
        <View style={styles.roomBadge}>
          <TelIcon name={info.icon} size={44} color={colors.primary} />
        </View>
        <TelText variant="overline" color="accent" align="center">
          Próxima parada · {info.place}
        </TelText>
        <TelText variant="title" color="cream" align="center">
          {copy.heading}
        </TelText>
        <TelText variant="body" color="accentSoft" align="center">
          {copy.hint}
        </TelText>
      </Animated.View>
      <Guide>{guideLines[stop]}</Guide>
      {me.checkedIn ? (
        <TelCard tone="success" style={styles.confirmedCard}>
          <TelIcon name="checkCircle" size={26} color={colors.success} />
          <View style={styles.flex}>
            <TelText variant="subtitle" color="successInk">
              ¡Llegada confirmada!
            </TelText>
            <TelText variant="caption" color="successInk">
              {waitingFor.length ? `Esperando a ${waitingFor.length} ${waitingFor.length === 1 ? 'persona' : 'personas'} más.` : 'Todo el grupo está aquí. ¡Comenzamos!'}
            </TelText>
          </View>
        </TelCard>
      ) : (
        <>
          <TelButton
            label={sending ? 'Confirmando con el stand…' : copy.confirm}
            variant="cream"
            size="lg"
            icon="door"
            loading={sending}
            onPress={() => {
              routeMember.checkin(stop);
              void feedbackHeavy();
            }}
          />
          {sending && entry?.state === 'queued' && (
            <TelText variant="caption" color="accentSoft" align="center" accessibilityLiveRegion="polite">
              Sin conexión: tu llegada quedó guardada y se enviará sola al volver la señal.
            </TelText>
          )}
        </>
      )}
      <View style={styles.gap}>
        <TelText variant="label" color="cream">
          En la sala: {confirmed.length} de {snapshot.players.length}
        </TelText>
        <ProgressBar progress={snapshot.players.length ? confirmed.length / snapshot.players.length : 0} color={colors.accent} trackColor={colors.primarySoft} />
        {snapshot.players.map((player) => (
          <PlayerChip
            key={player.id}
            player={player}
            me={player.id === me.id}
            trailing={<TelIcon name={player.checkedIn ? 'checkCircle' : 'clock'} size={20} color={player.checkedIn ? colors.success : colors.slate} />}
          />
        ))}
      </View>
    </Screen>
  );
}

function StationGameHost({ game, seed, deadline, pace, onDone }: { game: StationGameId; seed: number; deadline?: number | null; pace: number; onDone: (result: StationGameResult) => void }) {
  const info = getStationGame(game);
  if (!info) return null;
  const Component = info.Component;
  return <Component seed={seed} deadline={deadline} pace={pace} onComplete={onDone} />;
}

function seedFor(code: string, playerId: string, game: string): number {
  let hash = 2166136261;
  const text = `${code}:${playerId}:${game}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function B215Countdown({ header, startsAt }: { header: React.ReactNode; startsAt: number }) {
  const hostNow = useHostClock(250);
  return (
    <Screen tone="dark" backdrop="signal" header={header}>
      <BigCountdown seconds={Math.ceil((startsAt - hostNow) / 1000)} label="Operación Red B215 comienza en" />
      <TelCard tone="dark" style={styles.gap}>
        <TelText variant="subtitle" color="cream">
          Mira los equipos de la sala
        </TelText>
        <TelText variant="body" color="accentSoft">
          Routers, switches y access points: en 2 minutos tendrás que armar la red, enrutar paquetes y ordenar los canales Wi-Fi.
        </TelText>
      </TelCard>
    </Screen>
  );
}

function B215View({ header, snapshot, me, offset, entry, forceFinish, onStarted }: PhaseProps & { offset: number; entry: OutboxView | undefined; forceFinish: boolean; onStarted: () => void }) {
  const submitted = me.games['red-b215'] !== undefined;
  const startsAt = snapshot.startsAt;
  const started = useHostTimeReached(startsAt);
  const resolved = submitted || Boolean(entry);
  const playing = !resolved && started;

  useEffect(() => {
    if (playing) onStarted();
  }, [onStarted, playing]);

  if (resolved) return <WaitingView header={header} snapshot={snapshot} me={me} game="red-b215" entry={entry} />;

  if (!started && startsAt !== null) return <B215Countdown header={header} startsAt={startsAt} />;

  return (
    <Screen tone="dark" backdrop="stars" scroll={false} header={header} contentStyle={styles.gameContent}>
      <StationGameHost
        game="red-b215"
        pace={snapshot.settings.pace ?? 1}
        seed={seedFor(snapshot.code, me.id, 'red-b215')}
        // El juego mide con la hora del teléfono: el plazo del stand se traduce a esa hora.
        deadline={forceFinish || snapshot.deadline === null ? 1 : snapshot.deadline - offset - 2500}
        onDone={(result) => routeMember.submitScore('red-b215', result.score, result.accuracy)}
      />
    </Screen>
  );
}

function WaitingView({ header, snapshot, me, game, entry }: PhaseProps & { game: StationGameId; entry: OutboxView | undefined }) {
  const finished = snapshot.players.filter((player) => player.games[game] !== undefined);
  // Qué pasó con el puntaje: en el teléfono, en camino, guardado en el stand o perdido (con motivo).
  const status = scoreStatus(me.games[game], entry);
  return (
    <Screen tone="dark" backdrop="orbits" header={header}>
      <View style={styles.hero}>
        <Rutix size={120} expression={status.lost ? 'sad' : 'happy'} pose="wave" />
        <TelText variant="title" color="cream" align="center" accessibilityLiveRegion="polite">
          {status.title}
        </TelText>
        <TelText variant="caption" color="accentSoft" align="center">
          {status.note}
        </TelText>
        {status.canRetry && <TelButton label="Enviar otra vez" variant="cream" icon="refresh" fullWidth={false} onPress={() => routeMember.retry(`score:${game}`)} />}
        <TelText variant="body" color="accentSoft" align="center">
          Esperando al resto del grupo: {finished.length} de {snapshot.players.length} terminaron {stationTitles[game]}.
        </TelText>
      </View>
      <ProgressBar progress={snapshot.players.length ? finished.length / snapshot.players.length : 0} color={colors.accent} trackColor={colors.primarySoft} />
      <View style={styles.gap}>
        {snapshot.players.map((player) => (
          <PlayerChip
            key={player.id}
            player={player}
            me={player.id === me.id}
            trailing={
              player.games[game] !== undefined ? (
                <TelText variant="label" color="cream" tabular>
                  {formatNumber(player.games[game] ?? 0)}
                </TelText>
              ) : (
                <SignalSpinner size={22} />
              )
            }
          />
        ))}
      </View>
    </Screen>
  );
}

function ResultsView({ header, snapshot, me }: PhaseProps) {
  const hostNow = useHostClock(500);
  const ranking = [...snapshot.players].sort((a, b) => (b.games['red-b215'] ?? 0) - (a.games['red-b215'] ?? 0));
  const seconds = snapshot.deadline ? Math.max(0, Math.ceil((snapshot.deadline - hostNow) / 1000)) : 0;
  return (
    <Screen tone="dark" backdrop="orbits" header={header}>
      <View style={styles.hero}>
        <TelText variant="overline" color="accent" align="center">
          Resultados · Sala B215
        </TelText>
        <TelText variant="title" color="cream" align="center">
          ¡La red quedó operativa!
        </TelText>
        <TelText variant="body" color="accentSoft" align="center">
          Próxima parada: sala B213 en {seconds}s
        </TelText>
      </View>
      <View style={styles.gap}>
        {ranking.map((player, index) => (
          <Animated.View key={player.id} entering={FadeInDown.delay(index * 80)}>
            <PlayerChip
              player={player}
              me={player.id === me.id}
              trailing={
                <TelText variant="label" color="cream" tabular>
                  {index + 1}º · {formatNumber(player.games['red-b215'] ?? 0)}
                </TelText>
              }
            />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

function MinutesLeft({ deadline }: { deadline: number }) {
  const hostNow = useHostClock(10_000);
  const minutes = Math.max(0, Math.ceil((deadline - hostNow) / 60000));
  return <>{` Quedan ~${minutes} min.`}</>;
}

function ProjectsView({ header, snapshot, me, outbox, active, onActive }: PhaseProps & { outbox: MemberView['outbox']; active: PillarId | null; onActive: (id: PillarId | null) => void }) {
  // Un pilar se enciende cuando su puntaje ya está en camino o guardado en el stand.
  const entryOf = (id: PillarId) => outbox[`score:${id}`];
  const lit = Object.fromEntries(pillarIds.map((id) => [id, me.games[id] !== undefined || (Boolean(entryOf(id)) && !isLost(entryOf(id)))])) as Record<PillarId, boolean>;
  const doneCount = pillarIds.filter((id) => lit[id]).length;
  const groupDone = snapshot.players.filter((player) => pillarIds.every((id) => player.games[id] !== undefined)).length;
  const moved = snapshot.phase !== 'projects';

  if (active) {
    return (
      <Screen tone="dark" backdrop="stars" scroll={false} header={header} contentStyle={styles.gameContent}>
        {moved && (
          <View style={styles.movedBar} accessible accessibilityLiveRegion="polite">
            <TelIcon name="alert" size={18} color={colors.primary} />
            <TelText variant="caption" color="primary" style={styles.flex}>
              {snapshot.phase === 'quiz' ? 'La trivia ya empezó: cerramos este juego y enviamos lo que lograste.' : 'El grupo ya va al pasillo. Termina este juego para alcanzarlos.'}
            </TelText>
          </View>
        )}
        <StationGameHost
          game={active}
          pace={snapshot.settings.pace ?? 1}
          seed={seedFor(snapshot.code, me.id, active)}
          // Al partir la trivia el juego se cierra en el acto y entrega su resultado una sola vez.
          deadline={snapshot.phase === 'quiz' || snapshot.phase === 'podium' ? 1 : null}
          onDone={(result) => {
            routeMember.submitScore(active, result.score, result.accuracy);
            onActive(null);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen tone="dark" backdrop="stars" header={header}>
      <View style={styles.hero}>
        <TelText variant="overline" color="accent" align="center">
          Sala B213 · Pilares de Telemática
        </TelText>
        <TelText variant="title" color="cream" align="center">
          {doneCount === 5 ? '¡Templo restaurado!' : 'Enciende los 5 pilares'}
        </TelText>
        <TelText variant="body" color="accentSoft" align="center">
          {doneCount === 5
            ? `Esperando al grupo: ${groupDone} de ${snapshot.players.length} listos.`
            : 'Cada proyecto de la sala tiene su juego. Acércate al proyecto y juega en el orden que quieras.'}
          {snapshot.deadline !== null && doneCount < 5 ? <MinutesLeft deadline={snapshot.deadline} /> : null}
        </TelText>
      </View>
      <Temple lit={lit} />
      {doneCount < 5 && <Guide>{doneCount === 0 ? 'Elige cualquier proyecto para empezar. Cada juego enciende un pilar del templo.' : `¡Van ${doneCount} de 5 pilares! Sigue con el que quieras.`}</Guide>}
      <View style={styles.gap}>
        {pillars.map((pillar, index) => {
          const done = lit[pillar.id];
          const score = me.games[pillar.id];
          const entry = entryOf(pillar.id);
          const lost = score === undefined && isLost(entry);
          const state = pillarState(score, entry);
          return (
            <Animated.View key={pillar.id} entering={FadeInDown.delay(index * 70)}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${pillar.pillar}: ${pillar.game}${done ? `, completado, ${state}` : lost ? ', el puntaje anterior no se registró' : ''}`}
                disabled={done}
                onPress={() => onActive(pillar.id)}
                scaleTo={0.97}
                style={[styles.project, { borderColor: pillar.color }, done && styles.projectDone]}
              >
                <View style={[styles.projectIcon, { backgroundColor: pillar.color }]}>
                  <TelIcon name={pillar.icon} size={26} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <TelText variant="small" color="accentSoft">
                    {pillar.pillar.toUpperCase()} · {pillar.project}
                  </TelText>
                  <TelText variant="subtitle" color="cream">
                    {pillar.game}
                  </TelText>
                  <TelText variant="caption" color="accentSoft" numberOfLines={2}>
                    {lost ? 'Tu puntaje anterior no alcanzó a registrarse. Puedes jugarlo de nuevo.' : pillar.summary}
                  </TelText>
                </View>
                {done ? (
                  <View style={styles.projectScore}>
                    <TelIcon name={score !== undefined || entry?.state === 'accepted' ? 'checkCircle' : 'clock'} size={22} color={score !== undefined || entry?.state === 'accepted' ? colors.success : colors.cream} />
                    <TelText variant="small" color="cream" tabular>
                      {state}
                    </TelText>
                  </View>
                ) : (
                  <TelIcon name="play" size={22} color={colors.cream} />
                )}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </Screen>
  );
}

function QuizView({ header, snapshot, me, outbox }: PhaseProps & { outbox: MemberView['outbox'] }) {
  const hostNow = useHostClock(200);
  const quiz = snapshot.quiz;
  const [chosen, setChosen] = useState<{ index: number; option: number } | null>(null);
  if (!quiz) return null;
  const entry = outbox[`answer:${quiz.index}`];
  const lost = !me.answered && isLost(entry);
  const myChoice = chosen && chosen.index === quiz.index ? chosen.option : null;
  const online = snapshot.players.filter((player) => player.online).length;
  // Honesto con lo que pasó: en el teléfono, en camino, registrada o perdida.
  const note = answerNote(me.answered, entry);
  return (
    <Screen tone="dark" backdrop="signal" header={header}>
      {quiz.step === 'question' ? (
        <QuizQuestion
          quiz={quiz}
          hostNow={hostNow}
          // Si la respuesta se perdió y la pregunta sigue abierta, se puede volver a elegir.
          chosen={lost ? null : (myChoice ?? (me.answered || entry ? -1 : null))}
          answeredCount={quiz.answered}
          playerCount={online || snapshot.players.length}
          note={note}
          onAnswer={(option) => {
            setChosen({ index: quiz.index, option });
            routeMember.answer(quiz.index, option);
          }}
        />
      ) : (
        <QuizReveal quiz={quiz} players={snapshot.players} meId={me.id} />
      )}
    </Screen>
  );
}

type Reward = { state: 'saving' } | { state: 'saved'; xp: number | null } | { state: 'failed' };

function PodiumView({ header, snapshot, me, solo }: PhaseProps & { solo: boolean }) {
  const top = me.rank <= 3 && snapshot.players.length > 1;
  // La ruta solo cuenta como completada si la trivia terminó y respondiste en ella.
  const completed = snapshot.completed && me.answeredCount > 0;
  // El resultado final se arma una vez (el podio ya no cambia) y lleva un id propio de esta ruta y
  // este participante: abrir el podio dos veces, o reintentar tras un error, suma una sola vez.
  const [result] = useState<GameResult>(() => ({
    id: `route:${snapshot.code}:${me.id}`,
    gameId: 'route',
    score: me.total,
    accuracy: snapshot.quiz?.total ? me.quizCorrect / snapshot.quiz.total : me.quizCorrect / 10,
    durationSeconds: 1200,
    completedAt: new Date(clockNow()).toISOString(),
    metadata: { rank: me.rank, players: snapshot.players.length, pillars: pillarIds.filter((id) => me.games[id] !== undefined).length, solo, code: snapshot.code, completed },
  }));
  const [reward, setReward] = useState<Reward>({ state: 'saving' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        // Rutas ya sumadas con una versión anterior de la app.
        const before = await wasRouteRecorded(snapshot.code);
        const outcome = before ? null : await recordGameResult(result);
        if (active) setReward({ state: 'saved', xp: outcome ? outcome.xpGained : null });
      } catch {
        if (active) setReward({ state: 'failed' });
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt, result, snapshot.code]);

  const winners = snapshot.players.slice(0, 3).map((player) => player.alias);

  return (
    <Screen tone="dark" backdrop="orbits" header={header}>
      <Celebration burstKey={snapshot.code} count={48} />
      <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
        <TelText variant="overline" color="accent" align="center">
          Cierre de la ruta
        </TelText>
        <TelText variant="title" color="cream" align="center">
          {snapshot.players.length > 1 ? `¡Felicitaciones, ${winners.join(', ')}!` : '¡Completaste la Ruta Telemática!'}
        </TelText>
      </Animated.View>
      {snapshot.players.length > 1 && <Podium players={snapshot.players} meId={me.id} />}
      <TelCard tone={top ? 'cream' : 'dark'} style={styles.myResult}>
        <PlayerAvatar avatar={me.avatar} size={52} />
        <View style={styles.flex}>
          <TelText variant="small" color={top ? 'secondary' : 'accentSoft'}>
            TU RESULTADO
          </TelText>
          <TelText variant="heading" color={top ? 'primary' : 'cream'}>
            {me.rank}º lugar · {formatNumber(me.total)} pts
          </TelText>
          <TelText variant="caption" color={top ? 'muted' : 'accentSoft'}>
            Trivia: {me.quizCorrect} correctas{reward.state === 'saved' && reward.xp !== null ? ` · +${reward.xp} XP` : ''}
          </TelText>
        </View>
      </TelCard>
      {reward.state === 'failed' && (
        <TelCard tone="danger" style={styles.gap}>
          <TelText variant="caption" color="dangerInk" accessibilityLiveRegion="polite">
            No pudimos guardar este resultado en tu perfil. Tu puntaje en la ruta está a salvo en el stand; reintenta para sumar la XP.
          </TelText>
          <TelButton
            label="Reintentar"
            variant="danger"
            size="sm"
            icon="refresh"
            onPress={() => {
              setReward({ state: 'saving' });
              setAttempt((value) => value + 1);
            }}
          />
        </TelCard>
      )}
      {!completed && (
        <TelCard tone="dark" style={styles.verifyCard}>
          <TelIcon name="info" size={20} color={colors.accentSoft} />
          <TelText variant="caption" color="accentSoft" style={styles.flex}>
            El stand cerró la ruta antes de terminar la trivia: tus puntos suman XP, pero no cuenta como ruta completada para los logros.
          </TelText>
        </TelCard>
      )}
      {snapshot.players.length > 1 && <Leaderboard players={snapshot.players} meId={me.id} />}
      <View style={styles.gap}>
        <TelButton
          label="Compartir mi resultado"
          variant="outlineLight"
          icon="share"
          onPress={() => void Share.share({ message: `Terminé la Ruta Telemática de Ingeniería Civil Telemática USM en ${me.rank}º lugar con ${formatNumber(me.total)} puntos. ¡Juega SoyTEL!` }).catch(() => undefined)}
        />
        <TelButton
          label="Terminar y volver al inicio"
          variant="cream"
          iconRight="arrowRight"
          onPress={() => {
            void routeMember.leave(false);
            router.replace('/home');
          }}
        />
        <TelButton label="Ver otros juegos" variant="ghostLight" size="sm" onPress={() => router.push('/games')} />
      </View>
      <View style={styles.footerSpace}>
        <TelText variant="caption" color="accentSoft" align="center">
          {stationGames.length} juegos de la ruta disponibles para practicar en la pestaña Jugar.
        </TelText>
      </View>
    </Screen>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  gap: {
    gap: spacing.xs,
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  playerCell: {
    width: '25%',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  roomBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  confirmedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gameContent: {
    flex: 1,
  },
  movedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    marginBottom: spacing.xs,
  },
  project: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 5,
  },
  projectDone: {
    opacity: 0.8,
  },
  projectIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectScore: {
    alignItems: 'center',
    gap: 2,
  },
  myResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerSpace: {
    paddingBottom: spacing.md,
  },
  verifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  verifyCode: {
    letterSpacing: 4,
  },
});
