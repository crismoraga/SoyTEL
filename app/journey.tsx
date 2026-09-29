import { useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { SectionHeader } from '@/components/Blocks';
import { Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { SegmentedProgress } from '@/components/feedback/Progress';
import { PulseRings } from '@/components/feedback/PulseRings';
import { Illustration } from '@/components/graphics/Illustration';
import { Medallion } from '@/components/graphics/Medallion';
import { IconButton } from '@/components/IconButton';
import { FeedbackPanel, OptionButton, type OptionState } from '@/components/Quiz';
import { Screen, ScreenFooter } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { journeyStations } from '@/data/journey';
import { feedbackHeavy, feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useEntering } from '@/lib/motion';
import { useScrollToEnd } from '@/lib/useScrollToEnd';
import { isValidJourneyCode, journeyCodeFromSeed, sanitizeJourneyCode } from '@/lib/progression';
import { loadProfile, recordGameResult } from '@/storage/profile';
import { colors, font, radius, spacing } from '@/theme';
import type { GameOutcome, JourneySession } from '@/types/game';

const LETTERS = ['A', 'B', 'C', 'D'];
const TEAM_NAMES = ['Nodo Valparaíso', 'Equipo Fibra', 'Los Routers'];

export default function JourneyScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [session, setSession] = useState<JourneySession | null>(null);
  const [station, setStation] = useState(0);
  const [inChallenge, setInChallenge] = useState(false);
  const [finished, setFinished] = useState<GameOutcome | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [firstTry, setFirstTry] = useState(0);

  async function begin(code: string, joined: boolean) {
    const profile = await loadProfile();
    const now = Date.now();
    setStartedAt(now);
    setStation(0);
    setFirstTry(0);
    setSession({
      id: `${joined ? 'joined' : 'local'}-${now}`,
      code,
      createdAt: new Date(now).toISOString(),
      status: 'running',
      participants: [
        { id: 'me', alias: profile.alias, score: 0, checkpoint: 0 },
        { id: 'telix', alias: 'Telix', score: 0, checkpoint: 0 },
        { id: 'team', alias: TEAM_NAMES[now % TEAM_NAMES.length], score: 0, checkpoint: 0 },
      ],
    });
    await feedbackHeavy();
  }

  async function stationCleared(onFirstTry: boolean) {
    if (!session) return;
    const current = journeyStations[station];
    const bonus = onFirstTry ? 25 : 0;
    const next = station + 1;
    const participants = session.participants.map((participant, index) => ({
      ...participant,
      checkpoint: next,
      score: participant.score + (index === 0 ? current.points + bonus : 35 + ((index * 17 + station * 11) % 30)),
    }));
    setSession({ ...session, participants, status: next >= journeyStations.length ? 'finished' : 'running' });
    setFirstTry((value) => value + (onFirstTry ? 1 : 0));
    setInChallenge(false);
    setStation(next);
    if (next >= journeyStations.length) {
      const myScore = participants[0].score;
      const outcome = await recordGameResult({
        gameId: 'journey',
        score: myScore,
        accuracy: (firstTry + (onFirstTry ? 1 : 0)) / journeyStations.length,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        completedAt: new Date().toISOString(),
        metadata: { code: session.code, checkpoints: journeyStations.length },
      });
      setFinished(outcome);
    }
  }

  if (session && finished) {
    return <FinishedView session={session} outcome={finished} />;
  }

  if (session && inChallenge) {
    return <StationChallenge index={station} onBack={() => setInChallenge(false)} onCleared={(first) => void stationCleared(first)} />;
  }

  if (session) {
    return <RouteView session={session} station={station} onStart={() => setInChallenge(true)} onExit={() => setSession(null)} />;
  }

  return <LobbyView initialMode={mode === 'join' ? 'join' : 'create'} onBegin={(code, joined) => void begin(code, joined)} />;
}

function LobbyView({ initialMode, onBegin }: { initialMode: 'create' | 'join'; onBegin: (code: string, joined: boolean) => void }) {
  const entering = useEntering();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  function join() {
    if (!isValidJourneyCode(code)) {
      setError('El ID tiene 6 caracteres. No usa 0, 1, I ni O para evitar confusiones.');
      return;
    }
    setError(null);
    onBegin(code, true);
  }

  return (
    <Screen
      keyboard
      header={<AppHeader onBack={() => router.back()} kicker="Recorrido conjunto" title="Mi ruta" subtitle="5 estaciones para recorrer en grupo" />}
    >
      <Animated.View entering={entering.fade()} style={styles.lobbyArt}>
        <Illustration name="route" width={240} />
      </Animated.View>

      <TelCard tone="navy" style={styles.createCard}>
        <Tag tone="glass" icon="sparkle" label="CREAR" />
        <TelText variant="heading" color="cream">
          Genera un recorrido nuevo
        </TelText>
        <TelText variant="caption" color="accentSoft">
          Obtén un ID de 6 caracteres para compartir con tu grupo. Cada estación tiene una actividad y un reto.
        </TelText>
        <TelButton label="Crear ID de recorrido" variant="cream" icon="plus" onPress={() => onBegin(journeyCodeFromSeed(Date.now() % 10_000_000), false)} />
      </TelCard>

      <TelCard style={[styles.joinCard, initialMode === 'join' && styles.joinHighlight]}>
        <Tag tone="sky" icon="qr" label="UNIRME" />
        <TelText variant="heading" color="primary">
          Ingresa el ID compartido
        </TelText>
        <Pressable accessibilityRole="button" accessibilityLabel={`ID de recorrido: ${code || 'vacío'}. Toca para escribir`} onPress={() => inputRef.current?.focus()} style={styles.codeBoxes}>
          {Array.from({ length: 6 }, (_, index) => {
            const character = code[index];
            const active = index === code.length;
            return (
              <View key={index} style={[styles.codeBox, active && styles.codeBoxActive, Boolean(character) && styles.codeBoxFilled]}>
                <TelText variant="title" color="primary" align="center">
                  {character ?? ''}
                </TelText>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(value) => {
            setCode(sanitizeJourneyCode(value));
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={initialMode === 'join'}
          maxLength={6}
          returnKeyType="go"
          onSubmitEditing={join}
          accessibilityLabel="ID de recorrido"
          style={[styles.hiddenInput, font('bodyBold')]}
        />
        {error && (
          <TelText variant="caption" color="danger" accessibilityLiveRegion="polite">
            {error}
          </TelText>
        )}
        <TelButton label="Unirme al recorrido" iconRight="arrowRight" disabled={code.length !== 6} onPress={join} />
      </TelCard>

      <View style={styles.note}>
        <TelIcon name="info" size={18} color={colors.muted} />
        <TelText variant="caption" color="muted" style={styles.flex}>
          Modo demostración local: el ranking del grupo se simula en este teléfono. La sincronización en tiempo real llegará en una próxima versión.
        </TelText>
      </View>
    </Screen>
  );
}

function RouteView({ session, station, onStart, onExit }: { session: JourneySession; station: number; onStart: () => void; onExit: () => void }) {
  const entering = useEntering();
  const me = session.participants[0];

  async function share() {
    await Share.share({ message: `Únete a mi recorrido SoyTEL con el ID ${session.code}.` });
  }

  return (
    <Screen
      header={
        <AppHeader
          onBack={onExit}
          kicker="Ruta telemática"
          title="Mi ruta"
          right={<IconButton icon="share" tone="dark" accessibilityLabel="Compartir ID" onPress={() => void share()} />}
        >
          <View style={styles.codeRow}>
            <TelText variant="small" color="accentSoft" style={styles.kicker}>
              ID DE RECORRIDO
            </TelText>
            <TelText variant="heading" color="cream" style={styles.code}>
              {session.code}
            </TelText>
          </View>
          <View style={styles.routeProgress}>
            <View style={styles.progressLabels}>
              <TelText variant="label" color="cream">
                {station} de {journeyStations.length} completadas
              </TelText>
              <TelText variant="label" color="accentSoft" tabular>
                +{me.score} pts
              </TelText>
            </View>
            <SegmentedProgress total={journeyStations.length} done={station} />
          </View>
        </AppHeader>
      }
    >
      <View>
        {journeyStations.map((item, index) => {
          const done = index < station;
          const current = index === station;
          return (
            <Animated.View key={item.number} entering={entering.fadeUp(index)} style={styles.stationRow}>
              <View style={styles.timeline}>
                <Medallion glyph={item.glyph} state={done || current ? 'unlocked' : 'locked'} size={56} />
                {index < journeyStations.length - 1 && <View style={[styles.line, done ? styles.lineDone : styles.linePending]} />}
              </View>
              <View style={[styles.stationCard, current && styles.stationCurrent]}>
                <View style={styles.stationHead}>
                  <TelText variant="small" color="muted" style={styles.kicker}>
                    ESTACIÓN {item.number}
                  </TelText>
                  <Tag tone={done ? 'success' : current ? 'navy' : 'neutral'} label={done ? 'Completada' : current ? 'Aquí ahora' : 'Pendiente'} />
                </View>
                <TelText variant="subtitle" color="primary">
                  {item.name}
                </TelText>
                <View style={styles.place}>
                  <TelIcon name="pin" size={15} color={colors.muted} />
                  <TelText variant="caption" color="muted">
                    {item.place}
                  </TelText>
                </View>
                {current && <TelButton label="Comenzar reto" size="sm" iconRight="arrowRight" onPress={onStart} style={styles.startButton} />}
              </View>
            </Animated.View>
          );
        })}
      </View>

      <SectionHeader title="Equipo" subtitle="Puntajes en vivo del recorrido" />
      <TelCard>
        {[...session.participants]
          .sort((a, b) => b.score - a.score)
          .map((participant, index) => (
            <View key={participant.id} style={styles.participant}>
              <View style={[styles.rank, index === 0 && styles.rankFirst]}>
                <TelText variant="label" color={index === 0 ? 'primary' : 'secondary'}>
                  {index + 1}
                </TelText>
              </View>
              <TelText variant="bodyStrong" color="primary" style={styles.flex}>
                {participant.alias}
                {participant.id === 'me' ? ' (tú)' : ''}
              </TelText>
              <TelText variant="label" color="secondary" tabular>
                {participant.score} pts
              </TelText>
            </View>
          ))}
      </TelCard>
    </Screen>
  );
}

function StationChallenge({ index, onBack, onCleared }: { index: number; onBack: () => void; onCleared: (firstTry: boolean) => void }) {
  const entering = useEntering();
  const station = journeyStations[index];
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const correct = answered && picked === station.challenge.answerIndex;
  const next = journeyStations[index + 1];
  const scroller = useScrollToEnd();

  async function submit() {
    if (picked === null) return;
    setAnswered(true);
    setAttempts((value) => value + 1);
    scroller.scrollToEnd();
    if (picked === station.challenge.answerIndex) {
      await feedbackSuccess();
    } else {
      await feedbackWarning();
    }
  }

  return (
    <Screen
      scrollRef={scroller.ref}
      header={
        <AppHeader onBack={onBack} right={<Tag tone="glass" icon="sparkle" label={`${station.points} pts`} />}>
          <View style={styles.stationHero}>
            <View style={styles.stationMedal}>
              <PulseRings size={110} color={colors.accent} style={StyleSheet.absoluteFill} />
              <Medallion glyph={station.glyph} size={88} />
            </View>
            <View style={styles.flex}>
              <TelText variant="overline" color="accent">
                Estación {station.number}
              </TelText>
              <TelText variant="title" color="cream">
                {station.name}
              </TelText>
            </View>
          </View>
        </AppHeader>
      }
      footer={
        <ScreenFooter>
          {!answered && <TelButton label="Responder" disabled={picked === null} onPress={() => void submit()} />}
          {answered && !correct && (
            <TelButton
              label="Intentar de nuevo"
              variant="outline"
              icon="refresh"
              onPress={() => {
                setPicked(null);
                setAnswered(false);
              }}
            />
          )}
          {correct && (
            <TelButton
              label={next ? `Ir a la estación ${next.number}` : 'Terminar recorrido'}
              iconRight="arrowRight"
              onPress={() => onCleared(attempts === 1)}
            />
          )}
        </ScreenFooter>
      }
    >
      <TelCard tone="cream" style={styles.task}>
        <View style={styles.place}>
          <TelIcon name="users" size={18} color={colors.primary} />
          <TelText variant="small" color="primary" style={styles.kicker}>
            ACTIVIDAD EN GRUPO
          </TelText>
        </View>
        <TelText variant="body" color="primary">
          {station.task}
        </TelText>
      </TelCard>
      <TelText variant="subtitle" color="primary">
        {station.challenge.prompt}
      </TelText>
      <View style={styles.options}>
        {station.challenge.options.map((option, optionIndex) => {
          let state: OptionState = 'idle';
          if (!answered && picked === optionIndex) state = 'selected';
          if (correct && optionIndex === station.challenge.answerIndex) state = 'correct';
          if (answered && !correct && picked === optionIndex) state = 'wrong';
          return (
            <OptionButton
              key={option}
              letter={LETTERS[optionIndex]}
              label={option}
              state={state}
              disabled={answered}
              mono={index === 2}
              onPress={() => setPicked(optionIndex)}
            />
          );
        })}
      </View>
      {correct && (
        <Animated.View entering={entering.fadeUp()}>
          <FeedbackPanel kind="success" title={`¡Correcto! +${station.points}${attempts === 1 ? ' +25' : ''} pts`} body={station.challenge.explanation} />
        </Animated.View>
      )}
      {answered && !correct && <FeedbackPanel kind="error" title="Casi… inténtalo otra vez" body={`Pista: ${station.challenge.hint}`} />}
    </Screen>
  );
}

function FinishedView({ session, outcome }: { session: JourneySession; outcome: GameOutcome }) {
  const ranking = [...session.participants].sort((a, b) => b.score - a.score);
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  return (
    <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact />}>
      <Celebration burstKey={session.code} count={36} />
      <View style={styles.finishHero}>
        <Medallion glyph="route" tier="plata" size={110} ribbon />
        <TelText variant="overline" color="accent" align="center">
          Recorrido {session.code}
        </TelText>
        <TelText variant="title" color="cream" align="center">
          ¡Ruta completada!
        </TelText>
        <View style={styles.rewards}>
          <Tag tone="glass" icon="sparkle" label={`+${outcome.xpGained} XP`} />
          {outcome.newAchievements.length > 0 && <Tag tone="cream" icon="trophy" label={`${outcome.newAchievements.length} logro nuevo`} />}
        </View>
      </View>
      <View style={styles.podium}>
        {podium.map((participant) => {
          const place = ranking.indexOf(participant) + 1;
          const height = place === 1 ? 120 : place === 2 ? 92 : 72;
          return (
            <View key={participant.id} style={styles.podiumCol}>
              <TelText variant="label" color="cream" align="center" numberOfLines={1}>
                {participant.alias}
              </TelText>
              <TelText variant="caption" color="accentSoft" align="center" tabular>
                {participant.score} pts
              </TelText>
              <View style={[styles.podiumBar, { height }, place === 1 && styles.podiumFirst]}>
                {place === 1 && <TelIcon name="crown" size={22} color={colors.primary} />}
                <TelText variant="heading" color={place === 1 ? 'primary' : 'cream'}>
                  {place}
                </TelText>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.finishActions}>
        <TelButton label="Volver al inicio" variant="cream" onPress={() => router.replace('/home')} />
        <TelButton label="Ver mis logros" variant="outlineLight" icon="trophy" onPress={() => router.replace('/achievements')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    letterSpacing: 1.2,
    fontSize: 11,
  },
  lobbyArt: {
    alignItems: 'center',
  },
  createCard: {
    gap: spacing.sm,
  },
  joinCard: {
    gap: spacing.sm,
  },
  joinHighlight: {
    borderColor: colors.secondary,
    borderWidth: 2,
  },
  codeBoxes: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  codeBox: {
    flex: 1,
    height: 58,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    justifyContent: 'center',
  },
  codeBoxActive: {
    borderColor: colors.secondary,
    borderWidth: 2,
  },
  codeBoxFilled: {
    backgroundColor: colors.highlight,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  codeRow: {
    gap: 2,
  },
  code: {
    letterSpacing: 6,
  },
  routeProgress: {
    gap: spacing.xs,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stationRow: {
    flexDirection: 'row',
    gap: 14,
  },
  timeline: {
    width: 56,
    alignItems: 'center',
  },
  line: {
    flex: 1,
    width: 0,
    minHeight: 20,
    marginVertical: 4,
    borderLeftWidth: 3,
  },
  lineDone: {
    borderColor: colors.accent,
  },
  linePending: {
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  stationCard: {
    flex: 1,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stationCurrent: {
    borderWidth: 2,
    borderColor: colors.secondary,
    boxShadow: '0px 10px 24px rgba(11, 45, 69, 0.12)',
  },
  stationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startButton: {
    marginTop: 6,
  },
  participant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankFirst: {
    backgroundColor: colors.cream,
  },
  stationHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stationMedal: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  task: {
    gap: spacing.xs,
  },
  options: {
    gap: 10,
  },
  finishHero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  rewards: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  podiumCol: {
    flex: 1,
    gap: 4,
  },
  podiumBar: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  podiumFirst: {
    backgroundColor: colors.cream,
  },
  finishActions: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
