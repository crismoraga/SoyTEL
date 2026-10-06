import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
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
import { Temple } from '@/features/route/Temple';
import { getStationGame, stationGames } from '@/features/stations/registry';
import type { StationGameResult } from '@/features/stations/kit';
import { now as clockNow } from '@/lib/clock';
import { feedbackHeavy } from '@/lib/feedback';
import { formatNumber } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { checkinCopy, pillarIds, pillars, stationTitles, stopInfo } from '@/route/content';
import { useMemberView, useRouteForeground } from '@/route/hooks';
import { routeMember, type MemberView } from '@/route/member';
import { markRouteRecorded, wasRouteRecorded } from '@/route/storage';
import type { CheckinStop, PillarId, PublicPlayer, RouteSnapshot, StationGameId } from '@/route/types';
import { recordGameResult } from '@/storage/profile';
import { colors, radius, spacing } from '@/theme';

// Reloj del anfitrión (hora del stand). Solo lo usan las vistas con cuenta regresiva, para que los
// juegos no se vuelvan a dibujar en cada tic (importante en teléfonos de gama baja).
function useHostClock(offset: number, intervalMs = 250): number {
  const [now, setNow] = useState(() => clockNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now + offset;
}

// true desde el instante local indicado (un solo cambio, sin reloj que corra).
function useTimeReached(target: number | null): boolean {
  const [reached, setReached] = useState(() => target === null || clockNow() >= target);
  useEffect(() => {
    if (target === null) return;
    const timer = setTimeout(() => setReached(true), Math.max(0, target - Date.now()));
    return () => clearTimeout(timer);
  }, [target]);
  return reached;
}

export default function RouteGameScreen() {
  useKeepAwake();
  useRouteForeground();
  const view = useMemberView();

  if (view.status === 'idle') return <Redirect href="/ruta" />;
  if (view.status === 'not-found' || view.status === 'rejected' || view.status === 'kicked' || view.status === 'conflict') return <ProblemView view={view} />;
  if (!view.snapshot || !view.me) return <ConnectingView view={view} />;
  return <LiveRoute view={view} snapshot={view.snapshot} me={view.me} />;
}

function exit() {
  void routeMember.leave();
  router.replace('/home');
}

function ConnectingView({ view }: { view: MemberView }) {
  return (
    <Screen tone="dark" backdrop="signal" header={<AppHeader transparent compact onBack={exit} />}>
      <View style={styles.center}>
        <SignalSpinner size={96} />
        <TelText variant="title" color="cream" align="center">
          {view.status === 'joining' ? 'Buscando la ruta…' : 'Conectando…'}
        </TelText>
        <TelText variant="body" color="accentSoft" align="center">
          {view.solo ? 'Preparando tu ruta individual.' : `Código ${view.code}. Esto toma unos segundos; mantén la app abierta.`}
        </TelText>
        <TelButton label="Cancelar" variant="outlineLight" fullWidth={false} onPress={exit} />
      </View>
    </Screen>
  );
}

function ProblemView({ view }: { view: MemberView }) {
  const copy =
    view.status === 'conflict'
      ? {
          title: 'Hay dos stands con ese código',
          body: 'Por seguridad no te unimos a ninguno. Escanea el QR de la pantalla del stand (así verificamos que sea el correcto) o pide un código nuevo.',
        }
      : view.status === 'not-found'
      ? { title: 'No encontramos esa ruta', body: `Revisa el código ${view.code} en la pantalla del stand. Si el stand acaba de crearla, reintenta en unos segundos.` }
      : view.status === 'kicked'
        ? { title: 'Saliste de la ruta', body: 'El equipo del stand te quitó de esta ruta. Si fue un error, pídeles que te ayuden a entrar de nuevo.' }
        : view.rejection === 'full'
          ? { title: 'La ruta está llena', body: 'Este grupo ya alcanzó el máximo de participantes. Espera la siguiente ruta en el stand.' }
          : view.rejection === 'finished'
            ? { title: 'Esa ruta ya terminó', body: 'Pide en el stand el código de la próxima ruta.' }
            : { title: 'No pudimos unirte', body: 'Vuelve a intentarlo desde el inicio de la ruta.' };
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
        {(view.status === 'not-found' || view.status === 'conflict') && <TelButton label="Reintentar" variant="cream" icon="refresh" onPress={() => routeMember.retryJoin()} />}
        <TelButton
          label="Usar otro código"
          variant="outlineLight"
          onPress={() => {
            void routeMember.leave(false);
            router.replace('/ruta');
          }}
        />
      </View>
    </Screen>
  );
}

function LiveRoute({ view, snapshot, me }: { view: MemberView; snapshot: RouteSnapshot; me: PublicPlayer }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Juegos en curso que deben sobrevivir al cambio de fase (si el stand avanza, se envía lo logrado).
  const [b215Started, setB215Started] = useState(false);
  const [activeProject, setActiveProject] = useState<PillarId | null>(null);
  const b215Pending = b215Started && me.games['red-b215'] === undefined;

  const header = (
    <AppHeader
      compact
      onBack={() => router.back()}
      right={
        <View style={styles.headerRight}>
          {view.link !== 'online' && !view.solo && <Tag tone="warning" icon="wifiOff" label="Reconectando" />}
          {me.total > 0 && <Tag tone="glass" icon="star" label={`${formatNumber(me.total)} pts`} />}
          <IconButton icon="close" tone="dark" size={40} accessibilityLabel="Salir de la ruta" onPress={() => setConfirmLeave(true)} />
        </View>
      }
    >
      <RouteProgress stop={snapshot.stop} finished={snapshot.phase === 'podium'} />
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
        </View>
      </Screen>
    );
  }

  const b215 = (
    <B215View
      header={header}
      snapshot={snapshot}
      me={me}
      offset={view.offset}
      pending={view.pending}
      forceFinish={snapshot.phase !== 'play'}
      onStarted={() => setB215Started(true)}
    />
  );
  const projects = <ProjectsView header={header} snapshot={snapshot} me={me} offset={view.offset} pending={view.pending} active={activeProject} onActive={setActiveProject} />;

  switch (snapshot.phase) {
    case 'lobby':
      return <LobbyView header={header} snapshot={snapshot} me={me} solo={view.solo} verification={view.verification} warning={view.warning} />;
    case 'checkin':
      // Si alguien sigue en un proyecto de B213 cuando el grupo sale al pasillo, termina y envía su puntaje.
      if (activeProject && snapshot.stop === 'hall') return projects;
      return <CheckinView header={header} snapshot={snapshot} me={me} pending={view.pending} />;
    case 'play':
      return b215;
    case 'results':
      if (b215Pending) return b215;
      return <ResultsView header={header} snapshot={snapshot} me={me} offset={view.offset} />;
    case 'projects':
      return projects;
    case 'quiz':
      return <QuizView header={header} snapshot={snapshot} me={me} offset={view.offset} />;
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

function CheckinView({ header, snapshot, me, pending }: PhaseProps & { pending: string[] }) {
  const entering = useEntering();
  const stop = snapshot.stop as CheckinStop;
  const copy = checkinCopy[stop];
  const info = stopInfo(stop);
  const confirmed = snapshot.players.filter((player) => player.checkedIn);
  const waitingFor = snapshot.players.filter((player) => !player.checkedIn && player.online);
  const sending = pending.includes(`checkin:${stop}`) && !me.checkedIn;
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
        <TelButton
          label={copy.confirm}
          variant="cream"
          size="lg"
          icon="door"
          loading={sending}
          onPress={() => {
            routeMember.checkin(stop);
            void feedbackHeavy();
          }}
        />
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

function B215Countdown({ header, startsAt, offset }: { header: React.ReactNode; startsAt: number; offset: number }) {
  const hostNow = useHostClock(offset, 250);
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

function B215View({
  header,
  snapshot,
  me,
  offset,
  pending,
  forceFinish,
  onStarted,
}: PhaseProps & { offset: number; pending: string[]; forceFinish: boolean; onStarted: () => void }) {
  const [done, setDone] = useState(false);
  const submitted = me.games['red-b215'] !== undefined;
  const startsAt = snapshot.startsAt;
  const started = useTimeReached(startsAt === null ? null : startsAt - offset);
  const playing = !submitted && !done && started;

  useEffect(() => {
    if (playing) onStarted();
  }, [onStarted, playing]);

  if (submitted || done) {
    return <WaitingView header={header} snapshot={snapshot} me={me} game="red-b215" sending={pending.includes('score:red-b215')} />;
  }

  if (!started && startsAt !== null) return <B215Countdown header={header} startsAt={startsAt} offset={offset} />;

  return (
    <Screen tone="dark" backdrop="stars" scroll={false} header={header} contentStyle={styles.gameContent}>
      <StationGameHost
        game="red-b215"
        pace={snapshot.settings.pace ?? 1}
        seed={seedFor(snapshot.code, me.id, 'red-b215')}
        deadline={forceFinish || snapshot.deadline === null ? 1 : snapshot.deadline - offset - 2500}
        onDone={(result) => {
          setDone(true);
          routeMember.submitScore('red-b215', result.score, result.accuracy);
        }}
      />
    </Screen>
  );
}

function WaitingView({ header, snapshot, me, game, sending }: PhaseProps & { game: StationGameId; sending: boolean }) {
  const finished = snapshot.players.filter((player) => player.games[game] !== undefined);
  const score = me.games[game];
  return (
    <Screen tone="dark" backdrop="orbits" header={header}>
      <View style={styles.hero}>
        <Rutix size={120} expression="happy" pose="wave" />
        <TelText variant="title" color="cream" align="center">
          {sending ? 'Enviando tu puntaje…' : `¡${formatNumber(score ?? 0)} puntos!`}
        </TelText>
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

function ResultsView({ header, snapshot, me, offset }: PhaseProps & { offset: number }) {
  const hostNow = useHostClock(offset, 500);
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

function MinutesLeft({ deadline, offset }: { deadline: number; offset: number }) {
  const hostNow = useHostClock(offset, 10_000);
  const minutes = Math.max(0, Math.ceil((deadline - hostNow) / 60000));
  return <>{` Quedan ~${minutes} min.`}</>;
}

function ProjectsView({
  header,
  snapshot,
  me,
  offset,
  pending,
  active,
  onActive,
}: PhaseProps & { offset: number; pending: string[]; active: PillarId | null; onActive: (id: PillarId | null) => void }) {
  const [localDone, setLocalDone] = useState<Partial<Record<PillarId, boolean>>>({});
  const lit = Object.fromEntries(pillarIds.map((id) => [id, me.games[id] !== undefined || Boolean(localDone[id])])) as Record<PillarId, boolean>;
  const doneCount = pillarIds.filter((id) => lit[id]).length;
  const groupDone = snapshot.players.filter((player) => pillarIds.every((id) => player.games[id] !== undefined)).length;

  if (active) {
    return (
      <Screen tone="dark" backdrop="stars" scroll={false} header={header} contentStyle={styles.gameContent}>
        <StationGameHost
          game={active}
          pace={snapshot.settings.pace ?? 1}
          seed={seedFor(snapshot.code, me.id, active)}
          onDone={(result) => {
            setLocalDone((current) => ({ ...current, [active]: true }));
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
          {snapshot.deadline !== null && doneCount < 5 ? <MinutesLeft deadline={snapshot.deadline} offset={offset} /> : null}
        </TelText>
      </View>
      <Temple lit={lit} />
      {doneCount < 5 && <Guide>{doneCount === 0 ? 'Elige cualquier proyecto para empezar. Cada juego enciende un pilar del templo.' : `¡Van ${doneCount} de 5 pilares! Sigue con el que quieras.`}</Guide>}
      <View style={styles.gap}>
        {pillars.map((pillar, index) => {
          const done = lit[pillar.id];
          const score = me.games[pillar.id];
          const sending = pending.includes(`score:${pillar.id}`) && score === undefined;
          return (
            <Animated.View key={pillar.id} entering={FadeInDown.delay(index * 70)}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${pillar.pillar}: ${pillar.game}${done ? ', completado' : ''}`}
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
                    {pillar.summary}
                  </TelText>
                </View>
                {done ? (
                  <View style={styles.projectScore}>
                    <TelIcon name="checkCircle" size={22} color={colors.success} />
                    <TelText variant="small" color="cream" tabular>
                      {sending ? '…' : formatNumber(score ?? 0)}
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

function QuizView({ header, snapshot, me, offset }: PhaseProps & { offset: number }) {
  const hostNow = useHostClock(offset, 200);
  const quiz = snapshot.quiz;
  const [chosen, setChosen] = useState<{ index: number; option: number } | null>(null);
  if (!quiz) return null;
  const myChoice = chosen && chosen.index === quiz.index ? chosen.option : null;
  const online = snapshot.players.filter((player) => player.online).length;
  return (
    <Screen tone="dark" backdrop="signal" header={header}>
      {quiz.step === 'question' ? (
        <QuizQuestion
          quiz={quiz}
          hostNow={hostNow}
          chosen={myChoice ?? (me.answered ? -1 : null)}
          answeredCount={quiz.answered}
          playerCount={online || snapshot.players.length}
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

function PodiumView({ header, snapshot, me, solo }: PhaseProps & { solo: boolean }) {
  const [xp, setXp] = useState<number | null>(null);
  const recording = useRef(false);
  const top = me.rank <= 3 && snapshot.players.length > 1;
  // La ruta solo cuenta como completada si la trivia terminó y respondiste en ella.
  const completed = snapshot.completed && me.answeredCount > 0;

  useEffect(() => {
    if (recording.current) return;
    recording.current = true;
    void (async () => {
      if (await wasRouteRecorded(snapshot.code)) return;
      await markRouteRecorded(snapshot.code);
      const pillarsDone = pillarIds.filter((id) => me.games[id] !== undefined).length;
      const outcome = await recordGameResult({
        gameId: 'route',
        score: me.total,
        accuracy: snapshot.quiz?.total ? me.quizCorrect / snapshot.quiz.total : me.quizCorrect / 10,
        durationSeconds: 1200,
        completedAt: new Date().toISOString(),
        metadata: { rank: me.rank, players: snapshot.players.length, pillars: pillarsDone, solo, code: snapshot.code, completed },
      });
      setXp(outcome.xpGained);
    })();
  }, [completed, me, snapshot, solo]);

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
            Trivia: {me.quizCorrect} correctas{xp !== null ? ` · +${xp} XP` : ''}
          </TelText>
        </View>
      </TelCard>
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
          onPress={() => void Share.share({ message: `Terminé la Ruta Telemática de Ingeniería Civil Telemática USM en ${me.rank}º lugar con ${formatNumber(me.total)} puntos. ¡Juega SoyTEL!` })}
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
