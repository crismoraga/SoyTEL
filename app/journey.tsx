import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { feedbackHeavy, feedbackSuccess } from '@/lib/feedback';
import { isValidJourneyCode, journeyCodeFromSeed } from '@/lib/progression';
import { recordGameResult } from '@/storage/profile';
import { colors, radius, spacing } from '@/theme';
import type { JourneySession } from '@/types/game';

const checkpoints = [
  {
    title: 'Estación 1 · Enlace',
    task: 'Ordena mentalmente la ruta: dispositivo → switch → router → Internet.',
    action: 'Checkpoint validado',
  },
  {
    title: 'Estación 2 · Señal',
    task: 'Identifica una fuente de interferencia y propone una mejora.',
    action: 'Señal estabilizada',
  },
  {
    title: 'Estación 3 · Seguridad',
    task: 'El equipo decide qué tráfico debe bloquear el firewall.',
    action: 'Perímetro seguro',
  },
  {
    title: 'Estación 4 · Software',
    task: 'Define qué dato necesita la app para mostrar el ranking.',
    action: 'Servicio desplegado',
  },
  {
    title: 'Estación 5 · Campus conectado',
    task: 'Completa el recorrido y celebra con tu equipo.',
    action: 'Red restaurada',
  },
];

export default function JourneyScreen() {
  const [session, setSession] = useState<JourneySession | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  async function createSession() {
    const now = Date.now();
    setStartedAt(now);
    const code = journeyCodeFromSeed(now % 10_000_000);
    const created: JourneySession = {
      id: `local-${now}`,
      code,
      createdAt: new Date().toISOString(),
      status: 'lobby',
      participants: [
        { id: 'local-player', alias: 'Tú', score: 0, checkpoint: 0 },
        { id: 'demo-telix', alias: 'Telix', score: 0, checkpoint: 0 },
      ],
    };
    setSession(created);
    setError(null);
    await feedbackHeavy();
  }

  function joinSession() {
    const normalized = joinCode.trim().toUpperCase();
    if (!isValidJourneyCode(normalized)) {
      setError('Ingresa un ID de 6 caracteres, sin ceros ni unos para evitar confusiones.');
      return;
    }

    setSession({
      id: `joined-${normalized}`,
      code: normalized,
      createdAt: new Date().toISOString(),
      status: 'lobby',
      participants: [
        { id: 'local-player', alias: 'Tú', score: 0, checkpoint: 0 },
        { id: 'remote-demo', alias: 'Equipo remoto', score: 0, checkpoint: 0 },
      ],
    });
    setError(null);
  }

  async function shareCode() {
    if (!session) {
      return;
    }
    await Share.share({
      message: `Únete a mi recorrido SoyTEL con el ID ${session.code}.`,
    });
  }

  async function completeCheckpoint() {
    if (!session) {
      return;
    }

    const nextCheckpoint = checkpoint + 1;
    setSession({
      ...session,
      status: nextCheckpoint >= checkpoints.length ? 'finished' : 'running',
      participants: session.participants.map((participant, index) => ({
        ...participant,
        checkpoint: nextCheckpoint,
        score: participant.score + (index === 0 ? 120 : 90),
      })),
    });
    setCheckpoint(nextCheckpoint);
    await feedbackSuccess();

    if (nextCheckpoint >= checkpoints.length) {
      await recordGameResult({
        gameId: 'journey',
        score: 600,
        accuracy: 1,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        completedAt: new Date().toISOString(),
        metadata: { code: session.code, checkpoints: checkpoints.length },
      });
      setCompleted(true);
    }
  }

  if (completed && session) {
    return (
      <Screen dark contentStyle={styles.centered}>
        <Ionicons color={colors.accent} name="flag" size={72} />
        <TelText variant="hero" color="white" align="center">Recorrido completado</TelText>
        <TelText color="accentSoft" align="center">
          El equipo restauró la señal del campus con el ID {session.code}.
        </TelText>
        <TelCard tone="cream">
          {session.participants.map((participant, index) => (
            <View key={participant.id} style={styles.participantRow}>
              <TelText color="primary">#{index + 1} {participant.alias}</TelText>
              <TelText variant="bodyStrong" color="secondary">{participant.score} pts</TelText>
            </View>
          ))}
        </TelCard>
        <TelButton label="Volver al inicio" onPress={() => router.replace('/home')} />
      </Screen>
    );
  }

  if (session) {
    const currentCheckpoint = checkpoints[checkpoint];
    return (
      <Screen>
        <TelCard tone="dark">
          <TelText variant="overline" color="accentSoft">ID de recorrido</TelText>
          <View style={styles.codeRow}>
            <TelText variant="hero" color="white">{session.code}</TelText>
            <TelButton label="Compartir" variant="secondary" fullWidth={false} onPress={() => void shareCode()} />
          </View>
          <TelText variant="caption" color="accentSoft">
            Modo demostración local: la sincronización realtime se conectará mediante Supabase.
          </TelText>
        </TelCard>

        <TelCard tone="cream">
          <TelText variant="overline" color="secondary">Checkpoint {checkpoint + 1}/{checkpoints.length}</TelText>
          <TelText variant="title" color="primary">{currentCheckpoint.title}</TelText>
          <TelText color="primarySoft">{currentCheckpoint.task}</TelText>
          <TelButton label={currentCheckpoint.action} onPress={() => void completeCheckpoint()} />
        </TelCard>

        <TelCard>
          <TelText variant="subtitle" color="primary">Equipo</TelText>
          {session.participants.map((participant) => (
            <View key={participant.id} style={styles.participantRow}>
              <TelText color="primary">{participant.alias}</TelText>
              <TelText variant="caption" color="muted">
                {participant.checkpoint}/{checkpoints.length} estaciones
              </TelText>
            </View>
          ))}
        </TelCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <TelText variant="title" color="primary">Recorrido conjunto</TelText>
      <TelText color="muted">
        Crea una sesión y comparte su ID para que otras personas completen las estaciones contigo.
      </TelText>

      <TelCard tone="dark">
        <TelText variant="overline" color="accentSoft">Crear</TelText>
        <TelText variant="subtitle" color="white">Genera un recorrido de 5 estaciones</TelText>
        <TelButton label="Crear ID de recorrido" onPress={() => void createSession()} />
      </TelCard>

      <TelCard tone="cream">
        <TelText variant="overline" color="secondary">Unirse</TelText>
        <TelText variant="subtitle" color="primary">Ingresa el ID compartido</TelText>
        <View style={styles.joinInput} accessibilityLabel="ID de recorrido">
          {joinCode.padEnd(6, '•').split('').slice(0, 6).map((character, index) => (
            <View key={`${character}-${index}`} style={styles.joinDigit}>
              <TelText variant="subtitle" color="primary" align="center">{character}</TelText>
            </View>
          ))}
        </View>
        <View style={styles.keyboard}>
          {'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('').map((character) => (
            <TelButton
              key={character}
              label={character}
              variant="ghost"
              fullWidth={false}
              style={styles.key}
              onPress={() => setJoinCode((value) => (value + character).slice(0, 6))}
            />
          ))}
          <TelButton label="⌫" variant="secondary" fullWidth={false} style={styles.key} onPress={() => setJoinCode((value) => value.slice(0, -1))} />
        </View>
        {error && <TelText variant="caption" color="danger">{error}</TelText>}
        <TelButton label="Unirme al recorrido" onPress={joinSession} disabled={joinCode.length !== 6} />
      </TelCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  participantRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  joinInput: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  joinDigit: {
    width: 42,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  keyboard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  key: {
    width: 42,
    minHeight: 42,
    paddingHorizontal: 0,
  },
});
