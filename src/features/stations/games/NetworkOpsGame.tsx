import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, FadeIn, FadeInRight, FadeOut, useAnimatedProps, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { now as clockNow } from '@/lib/clock';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { usePanHandlers } from '@/lib/usePanHandlers';
import { mulberry32 } from '@/route/random';
import { colors, font, radius, spacing } from '@/theme';
import { clamp, GameBoard, Hint, StageBanner, StationHud, StationSummary, useAskContinue, useNow, type StationGameProps } from '../kit';
import {
  deviceLabels,
  initialChannels,
  interference,
  makePacket,
  MAX_INTERFERENCE,
  packetPoints,
  packetTtlMs,
  placementHint,
  ROUTING_MAX,
  routingTable,
  slotNeeds,
  TOPOLOGY_MAX,
  WIFI_MAX,
  wifiScore,
  type DeviceKind,
  type Interface,
  type Packet,
  type SlotId,
} from '../logic/network';

type StageKey = 'topology' | 'routing' | 'wifi';

const STAGES: { key: StageKey; title: string; body: string; icon: IconName; seconds: number }[] = [
  {
    key: 'topology',
    title: 'Arma la red',
    body: 'Arrastra cada equipo a su lugar: el router hacia Internet, el switch para los PCs y el access point para el Wi-Fi.',
    icon: 'router',
    seconds: 35,
  },
  {
    key: 'routing',
    title: 'Enruta los paquetes',
    body: 'Ahora tú eres el router: envía cada paquete por la interfaz correcta según su IP de destino. ¡Cada vez más rápido!',
    icon: 'send',
    seconds: 45,
  },
  {
    key: 'wifi',
    title: 'Afina el Wi-Fi',
    body: 'Tres access points comparten el aire. Elige canales que no se solapen para que no haya interferencia.',
    icon: 'wifi',
    seconds: 30,
  },
];

const ACCENT = '#6FB3D9';

interface StageProps {
  seed: number;
  endsAt: number;
  onPoints: (points: number) => void;
  onAccuracy: (accuracy: number) => void;
  onFinish: () => void;
}

// B215 · telecomunicaciones y redes: topología, enrutamiento y canales Wi-Fi en ~2 minutos.
export function NetworkOpsGame({ seed, deadline, onComplete }: StationGameProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [banner, setBanner] = useState(true);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [points, setPoints] = useState<Record<StageKey, number>>({ topology: 0, routing: 0, wifi: 0 });
  const [accuracy, setAccuracy] = useState<Record<StageKey, number>>({ topology: 0, routing: 0, wifi: 0 });
  const [finished, setFinished] = useState(false);
  const submitted = useRef(false);
  const now = useNow(true);
  const stage = STAGES[stageIndex];
  const total = points.topology + points.routing + points.wifi;
  const averageAccuracy = (accuracy.topology + accuracy.routing + accuracy.wifi) / 3;

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    onComplete({ score: Math.min(1000, total), accuracy: averageAccuracy });
  }, [averageAccuracy, onComplete, total]);

  useEffect(() => {
    if (deadline && now >= deadline) submit();
  }, [deadline, now, submit]);

  const startStage = useCallback(() => {
    setBanner(false);
    setEndsAt(Date.now() + STAGES[stageIndex].seconds * 1000);
  }, [stageIndex]);

  const finishStage = useCallback(() => {
    setEndsAt(null);
    if (stageIndex < STAGES.length - 1) {
      setStageIndex(stageIndex + 1);
      setBanner(true);
    } else {
      setFinished(true);
    }
  }, [stageIndex]);

  const setStagePoints = useCallback((value: number) => setPoints((current) => ({ ...current, [stage.key]: value })), [stage.key]);
  const setStageAccuracy = useCallback((value: number) => setAccuracy((current) => ({ ...current, [stage.key]: value })), [stage.key]);

  if (finished) {
    return (
      <StationSummary
        title="Operación Red B215"
        total={Math.min(1000, total)}
        message={total >= 750 ? '¡La red del laboratorio quedó impecable!' : total >= 450 ? 'Red funcionando: ¡buen trabajo de equipo!' : 'La red sobrevivió… ¡a practicar más!'}
        accent={ACCENT}
        rows={[
          { label: 'Topología', value: points.topology, max: TOPOLOGY_MAX, icon: 'router' },
          { label: 'Enrutamiento', value: points.routing, max: ROUTING_MAX, icon: 'send' },
          { label: 'Canales Wi-Fi', value: points.wifi, max: WIFI_MAX, icon: 'wifi' },
        ]}
        learned="El router une redes y decide rutas, el switch conecta equipos de la misma LAN y el access point da Wi-Fi. En 2,4 GHz, los canales 1, 6 y 11 no se interfieren."
        onSubmit={submit}
      />
    );
  }

  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  return (
    <View style={styles.container}>
      <StationHud stage={stageIndex + 1} stages={STAGES.length} title={stage.title} score={total} secondsLeft={secondsLeft} totalSeconds={stage.seconds} accent={ACCENT} />
      {endsAt && stage.key === 'topology' && (
        <TopologyStage seed={seed} endsAt={endsAt} onPoints={setStagePoints} onAccuracy={setStageAccuracy} onFinish={finishStage} />
      )}
      {endsAt && stage.key === 'routing' && (
        <RoutingStage seed={seed} endsAt={endsAt} onPoints={setStagePoints} onAccuracy={setStageAccuracy} onFinish={finishStage} />
      )}
      {endsAt && stage.key === 'wifi' && <WifiStage seed={seed} endsAt={endsAt} onPoints={setStagePoints} onAccuracy={setStageAccuracy} onFinish={finishStage} />}
      {banner && <StageBanner key={stage.key} index={stageIndex + 1} title={stage.title} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={startStage} />}
      {banner && <View style={styles.bannerSpace} />}
    </View>
  );
}

// ——— Etapa 1: topología ———

const BOARD_H = 290;
const TRAY_Y = 336;
const AREA_H = 382;
const DROP_RADIUS = 58;
const CHIPS: DeviceKind[] = ['switch', 'router', 'hub', 'ap'];
const deviceIcons: Record<DeviceKind, IconName> = { router: 'router', switch: 'lanSwitch', ap: 'accessPoint', hub: 'grid' };

const AnimatedLine = Animated.createAnimatedComponent(Line);

function FlowLine({ x1, y1, x2, y2, active }: { x1: number; y1: number; x2: number; y2: number; active: boolean }) {
  const motionEnabled = useMotionEnabled();
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!active || !motionEnabled) return;
    offset.set(withRepeat(withTiming(-24, { duration: 700, easing: Easing.linear }), -1, false));
  }, [active, motionEnabled, offset]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <AnimatedLine
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={active ? colors.accent : 'rgba(167,212,237,0.28)'}
      strokeWidth={active ? 3.5 : 2}
      strokeDasharray={active ? '10 14' : '4 7'}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

function TopologyStage({ endsAt, onPoints, onAccuracy, onFinish }: StageProps) {
  const [width, setWidth] = useState(0);
  const [placed, setPlaced] = useState<Partial<Record<SlotId, DeviceKind>>>({});
  const [mistakes, setMistakes] = useState({ edge: 0, core: 0, wifi: 0, hub: 0 });
  const [drag, setDrag] = useState<{ device: DeviceKind; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<DeviceKind | null>(null);
  const [hint, setHint] = useState<{ text: string; tone: 'good' | 'bad' | 'info' }>({ text: 'Arrastra (o toca y luego elige el lugar) cada equipo.', tone: 'info' });
  const [flash, setFlash] = useState<SlotId | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();
  const now = useNow(true, 300);

  const slots: Record<SlotId, { x: number; y: number }> = {
    edge: { x: width * 0.5, y: 100 },
    core: { x: width * 0.3, y: 184 },
    wifi: { x: width * 0.76, y: 184 },
  };
  const chipPos = (index: number) => ({ x: width * (0.125 + index * 0.25), y: TRAY_Y });

  const scoreFor = (current: Partial<Record<SlotId, DeviceKind>>, errors: typeof mistakes) => {
    let total = 0;
    (Object.keys(slotNeeds) as SlotId[]).forEach((slot) => {
      if (current[slot]) total += errors[slot] === 0 ? 100 : 60;
    });
    return Math.max(0, total - errors.hub * 20);
  };

  const finish = useCallback(
    (current: Partial<Record<SlotId, DeviceKind>>, errors: typeof mistakes) => {
      if (done.current) return;
      done.current = true;
      const clean = (Object.keys(slotNeeds) as SlotId[]).filter((slot) => current[slot] && errors[slot] === 0).length;
      onAccuracy(clean / 3);
      askContinue(onFinish);
    },
    [askContinue, onAccuracy, onFinish],
  );

  useEffect(() => {
    if (now >= endsAt) finish(placed, mistakes);
  }, [endsAt, finish, mistakes, now, placed]);

  function drop(device: DeviceKind, slot: SlotId) {
    if (done.current || placed[slot]) return;
    if (slotNeeds[slot] === device) {
      const next = { ...placed, [slot]: device };
      setPlaced(next);
      onPoints(scoreFor(next, mistakes));
      void feedbackSuccess();
      const complete = Object.keys(next).length === 3;
      setHint({ text: complete ? '¡Red en línea! Los paquetes ya fluyen hacia Internet.' : `¡${deviceLabels[device]} conectado!`, tone: 'good' });
      if (complete) finish(next, mistakes);
    } else {
      const key = device === 'hub' ? 'hub' : slot;
      const errors = { ...mistakes, [key]: mistakes[key] + 1 };
      setMistakes(errors);
      onPoints(scoreFor(placed, errors));
      void feedbackWarning();
      setFlash(slot);
      setTimeout(() => setFlash(null), 450);
      setHint({ text: placementHint(device, slot), tone: 'bad' });
    }
  }

  function nearestSlot(point: { x: number; y: number }): SlotId | null {
    let best: SlotId | null = null;
    let bestDistance = DROP_RADIUS;
    (Object.keys(slots) as SlotId[]).forEach((slot) => {
      const distance = Math.hypot(slots[slot].x - point.x, slots[slot].y - point.y);
      if (distance < bestDistance) {
        best = slot;
        bestDistance = distance;
      }
    });
    return best;
  }

  const used = new Set(Object.values(placed));
  const live = (slot: SlotId) => Boolean(placed[slot]);
  const pcs = [0.1, 0.27, 0.44].map((fraction) => ({ x: width * fraction, y: 262 }));

  return (
    <View style={styles.stageGap}>
      <View style={styles.area} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        <GameBoard style={styles.topologyBoard}>
          {width > 0 && (
            <Svg width={width} height={BOARD_H} style={StyleSheet.absoluteFill} pointerEvents="none">
              <FlowLine x1={width * 0.5} y1={46} x2={slots.edge.x} y2={slots.edge.y} active={live('edge')} />
              <FlowLine x1={slots.edge.x} y1={slots.edge.y} x2={slots.core.x} y2={slots.core.y} active={live('edge') && live('core')} />
              <FlowLine x1={slots.core.x} y1={slots.core.y} x2={slots.wifi.x} y2={slots.wifi.y} active={live('core') && live('wifi')} />
              {pcs.map((pc, index) => (
                <FlowLine key={index} x1={slots.core.x} y1={slots.core.y} x2={pc.x} y2={pc.y} active={live('core')} />
              ))}
              {[0, 1, 2].map((ring) => (
                <Path
                  key={ring}
                  d={`M${slots.wifi.x - 18 - ring * 9} ${230 + ring * 7} a${24 + ring * 10} ${24 + ring * 10} 0 0 0 ${36 + ring * 18} 0`}
                  stroke={live('wifi') ? colors.accent : 'rgba(167,212,237,0.25)'}
                  strokeWidth={2.2}
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
              <Circle cx={width * 0.5} cy={34} r={24} fill={colors.primary} stroke={colors.accentSoft} strokeWidth={1.5} />
            </Svg>
          )}
          {width > 0 && (
            <>
              <View style={[styles.cloud, { left: width * 0.5 - 16, top: 18 }]}>
                <TelIcon name="cloud" size={32} color={colors.cream} />
              </View>
              <TelText variant="small" color="accentSoft" style={[styles.nodeLabel, { left: width * 0.5 + 30, top: 26 }]}>
                Internet
              </TelText>
              {pcs.map((pc, index) => (
                <View key={index} style={[styles.pc, { left: pc.x - 20, top: pc.y - 16 }]}>
                  <TelIcon name="laptop" size={30} color={live('core') ? colors.cream : colors.slate} />
                </View>
              ))}
              {[-22, 22].map((offset) => (
                <View key={offset} style={[styles.phone, { left: slots.wifi.x + offset - 8, top: 250 }, live('wifi') && styles.phoneOn]} />
              ))}
              {(Object.keys(slots) as SlotId[]).map((slot) => {
                const device = placed[slot];
                return (
                  <PressableScale
                    key={slot}
                    accessibilityRole="button"
                    accessibilityLabel={device ? `${deviceLabels[device]} instalado` : 'Lugar vacío para un equipo'}
                    disabled={Boolean(device) || !selected}
                    onPress={() => {
                      if (selected) {
                        drop(selected, slot);
                        setSelected(null);
                      }
                    }}
                    style={[
                      styles.slot,
                      { left: slots[slot].x - 32, top: slots[slot].y - 32 },
                      device && styles.slotFilled,
                      flash === slot && styles.slotWrong,
                      !device && selected && styles.slotTarget,
                    ]}
                  >
                    {device ? (
                      <Animated.View entering={ZoomIn.springify().damping(11)} style={styles.slotInner}>
                        <TelIcon name={deviceIcons[device]} size={30} color={colors.primary} />
                      </Animated.View>
                    ) : (
                      <TelText variant="heading" color="accentSoft">
                        ?
                      </TelText>
                    )}
                  </PressableScale>
                );
              })}
            </>
          )}
        </GameBoard>
        {width > 0 &&
          CHIPS.map((device, index) =>
            used.has(device) ? null : (
              <DeviceChip
                key={device}
                device={device}
                origin={chipPos(index)}
                selected={selected === device}
                onDrag={(point) => setDrag(point ? { device, ...point } : null)}
                onDrop={(point) => {
                  setDrag(null);
                  const slot = nearestSlot(point);
                  if (slot) drop(device, slot);
                }}
                onTap={() => setSelected((value) => (value === device ? null : device))}
              />
            ),
          )}
        {drag && (
          <View pointerEvents="none" style={[styles.ghost, { left: drag.x - 34, top: drag.y - 34 }]}>
            <TelIcon name={deviceIcons[drag.device]} size={30} color={colors.primary} />
          </View>
        )}
      </View>
      <Hint tone={hint.tone}>{hint.text}</Hint>
    </View>
  );
}

function DeviceChip({
  device,
  origin,
  selected,
  onDrag,
  onDrop,
  onTap,
}: {
  device: DeviceKind;
  origin: { x: number; y: number };
  selected: boolean;
  onDrag: (point: { x: number; y: number } | null) => void;
  onDrop: (point: { x: number; y: number }) => void;
  onTap: () => void;
}) {
  const handlers = usePanHandlers({
    onGrant: () => {
      void feedbackTap();
      onDrag(origin);
    },
    onMove: (_, gesture) => onDrag({ x: origin.x + gesture.dx, y: origin.y + gesture.dy }),
    onRelease: (_, gesture) => {
      if (Math.hypot(gesture.dx, gesture.dy) < 8) {
        onDrag(null);
        onTap();
        return;
      }
      onDrop({ x: origin.x + gesture.dx, y: origin.y + gesture.dy });
    },
    onTerminate: () => onDrag(null),
  });
  return (
    <View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${deviceLabels[device]}${selected ? ', seleccionado' : ''}`}
      style={[styles.chip, { left: origin.x - 40, top: origin.y - 36 }, selected && styles.chipSelected]}
    >
      <View style={styles.chipIcon}>
        <TelIcon name={deviceIcons[device]} size={26} color={colors.primary} />
      </View>
      <TelText variant="small" color="cream" align="center" numberOfLines={1}>
        {deviceLabels[device]}
      </TelText>
    </View>
  );
}

// ——— Etapa 2: enrutamiento ———

const interfaceIcons: Record<Interface, IconName> = { lan: 'laptop', servers: 'server', internet: 'globe' };

function RoutingStage({ seed, endsAt, onPoints, onAccuracy, onFinish }: StageProps) {
  const [random] = useState(() => mulberry32(seed ^ 0x51ed));
  const [packet, setPacket] = useState<Packet>(() => makePacket(0, random));
  const [spawnedAt, setSpawnedAt] = useState(() => Date.now());
  const [stats, setStats] = useState({ points: 0, correct: 0, total: 0, streak: 0 });
  const [last, setLast] = useState<{ ok: boolean; text: string; id: number } | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();
  const now = useNow(true, 100);
  const ttl = packetTtlMs(stats.total);
  const remaining = clamp(1 - (now - spawnedAt) / ttl, 0, 1);

  const resolve = useCallback(
    (choice: Interface | null) => {
      if (done.current) return;
      const ok = choice === packet.answer;
      const streak = ok ? stats.streak + 1 : 0;
      const points = Math.min(ROUTING_MAX, stats.points + (ok ? packetPoints(streak) : 0));
      const next = { points, correct: stats.correct + (ok ? 1 : 0), total: stats.total + 1, streak };
      setStats(next);
      onPoints(points);
      if (ok) void feedbackSuccess();
      else void feedbackWarning();
      const label = routingTable.find((row) => row.id === packet.answer)?.label ?? '';
      setLast({
        ok,
        id: packet.id,
        text: ok
          ? streak >= 3
            ? `¡Racha x${streak}! +${packetPoints(streak)}`
            : `+${packetPoints(streak)} · ${packet.ip} → ${label}`
          : choice === null
            ? `Se agotó el TTL: ${packet.ip} iba a ${label}`
            : `${packet.ip} iba a ${label}${packet.tricky ? ' (no calza con la máscara /24)' : ''}`,
      });
      setPacket(makePacket(packet.id + 1, random));
      setSpawnedAt(Date.now());
    },
    [onPoints, packet, random, stats],
  );

  useEffect(() => {
    if (done.current) return;
    if (now >= endsAt) {
      done.current = true;
      onAccuracy(stats.total ? stats.correct / stats.total : 0);
      askContinue(onFinish);
    } else if (remaining <= 0) {
      resolve(null);
    }
  }, [askContinue, endsAt, now, onAccuracy, onFinish, remaining, resolve, stats]);

  return (
    <View style={styles.stageGap}>
      <View style={styles.table}>
        <TelText variant="small" color="accentSoft" style={styles.tableTitle}>
          TABLA DE RUTAS
        </TelText>
        {routingTable.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <TelText variant="caption" color="cream" style={[styles.mono, font('bodyBold')]}>
              {row.network}
            </TelText>
            <TelText variant="caption" color="accentSoft">
              → {row.label}
            </TelText>
          </View>
        ))}
      </View>
      <GameBoard style={styles.packetBoard}>
        <View style={styles.routerRow}>
          <View style={styles.routerBadge}>
            <TelIcon name="router" size={30} color={colors.primary} />
          </View>
          <TelText variant="small" color="accentSoft">
            {stats.correct}/{stats.total} entregados{stats.streak >= 3 ? ` · racha ${stats.streak}` : ''}
          </TelText>
        </View>
        <Animated.View key={packet.id} entering={FadeInRight.duration(220)} style={styles.packet}>
          <TelIcon name="packet" size={26} color={colors.primary} />
          <View style={styles.flex}>
            <TelText variant="small" color="secondary">
              DESTINO
            </TelText>
            <TelText variant="title" color="primary" style={font('display')} numberOfLines={1} adjustsFontSizeToFit>
              {packet.ip}
            </TelText>
          </View>
        </Animated.View>
        <View style={styles.ttlTrack}>
          <View style={[styles.ttlFill, { width: `${remaining * 100}%`, backgroundColor: remaining < 0.3 ? colors.danger : colors.accent }]} />
        </View>
        {last && (
          <Animated.View key={last.id} entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
            <Hint tone={last.ok ? 'good' : 'bad'}>{last.text}</Hint>
          </Animated.View>
        )}
      </GameBoard>
      <View style={styles.interfaces}>
        {routingTable.map((row) => (
          <PressableScale
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`Enviar por ${row.label}, red ${row.network}`}
            onPress={() => resolve(row.id)}
            scaleTo={0.93}
            style={styles.interface}
          >
            <View style={styles.interfaceIcon}>
              <TelIcon name={interfaceIcons[row.id]} size={24} color={colors.primary} />
            </View>
            <TelText variant="label" color="cream" align="center">
              {row.label}
            </TelText>
            <TelText variant="small" color="accentSoft" align="center" numberOfLines={1} adjustsFontSizeToFit>
              {row.network}
            </TelText>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

// ——— Etapa 3: canales Wi-Fi ———

const AP_COLORS = ['#E58A5A', '#4FB38A', '#9B8AE6'];
const SPECTRUM_H = 150;

function bumpPath(channel: number, width: number): string {
  const x = (value: number) => 14 + ((value - 1) / 12) * (width - 28);
  const base = SPECTRUM_H - 18;
  const left = x(channel - 2.3);
  const right = x(channel + 2.3);
  const top = 34;
  return `M${left} ${base} C${left + (right - left) * 0.18} ${top} ${right - (right - left) * 0.18} ${top} ${right} ${base} Z`;
}

function WifiStage({ seed, endsAt, onPoints, onAccuracy, onFinish }: StageProps) {
  const [channels, setChannels] = useState(() => initialChannels(mulberry32(seed ^ 0xa11)));
  const [width, setWidth] = useState(0);
  const [solvedAt, setSolvedAt] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());
  const done = useRef(false);
  const askContinue = useAskContinue();
  const now = useNow(true, 250);
  const level = interference(channels);
  const solved = level === 0;

  const finish = useCallback(
    (success: boolean, at: number) => {
      if (done.current) return;
      done.current = true;
      const ratio = (endsAt - at) / (endsAt - startedAt);
      onPoints(wifiScore(success, ratio, level));
      onAccuracy(success ? 1 : clamp(1 - level / MAX_INTERFERENCE, 0, 1) * 0.5);
      askContinue(onFinish, 'Ver resultado');
    },
    [askContinue, endsAt, level, onAccuracy, onFinish, onPoints, startedAt],
  );

  useEffect(() => {
    if (!done.current && now >= endsAt) finish(false, now);
  }, [endsAt, finish, now]);

  function change(index: number, delta: number) {
    if (done.current) return;
    const next = channels.map((value, position) => (position === index ? clamp(value + delta, 1, 13) : value));
    setChannels(next);
    void feedbackTap();
    if (interference(next) === 0) {
      const at = clockNow();
      setSolvedAt(at);
      void feedbackSuccess();
      finish(true, at);
    }
  }

  const x = (value: number) => 14 + ((value - 1) / 12) * (width - 28);

  return (
    <View style={styles.stageGap}>
      <GameBoard>
        <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ height: SPECTRUM_H }}>
          {width > 0 && (
            <Svg width={width} height={SPECTRUM_H}>
              {Array.from({ length: 13 }, (_, index) => (
                <Line key={index} x1={x(index + 1)} y1={SPECTRUM_H - 18} x2={x(index + 1)} y2={SPECTRUM_H - 12} stroke={colors.accentSoft} strokeWidth={1.5} />
              ))}
              {channels.map((channel, index) => (
                <Path key={index} d={bumpPath(channel, width)} fill={AP_COLORS[index]} fillOpacity={0.42} stroke={AP_COLORS[index]} strokeWidth={2.5} />
              ))}
              <Line x1={10} y1={SPECTRUM_H - 18} x2={width - 10} y2={SPECTRUM_H - 18} stroke={colors.accentSoft} strokeWidth={1.5} />
            </Svg>
          )}
          <View style={styles.axisLabels} pointerEvents="none">
            {[1, 6, 11].map((channel) => (
              <TelText key={channel} variant="small" color="accentSoft" style={[styles.axisLabel, { left: width ? x(channel) - 10 : 0 }]}>
                {channel}
              </TelText>
            ))}
          </View>
        </View>
      </GameBoard>
      <View style={styles.meterRow}>
        <TelText variant="label" color="cream">
          Interferencia
        </TelText>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${clamp(level / MAX_INTERFERENCE, 0, 1) * 100}%`, backgroundColor: level > 6 ? colors.danger : level > 0 ? colors.warning : colors.success }]} />
        </View>
        <TelText variant="label" color={solved ? 'successSoft' : 'cream'}>
          {solved ? 'Nula' : level > 6 ? 'Alta' : 'Media'}
        </TelText>
      </View>
      {channels.map((channel, index) => (
        <View key={index} style={styles.apRow}>
          <View style={[styles.apDot, { backgroundColor: AP_COLORS[index] }]}>
            <TelIcon name="accessPoint" size={20} color={colors.primary} />
          </View>
          <TelText variant="label" color="cream" style={styles.flex}>
            AP-{index + 1}
          </TelText>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Bajar canal del AP ${index + 1}`} onPress={() => change(index, -1)} style={styles.stepper}>
            <TelIcon name="minus" size={20} color={colors.primary} />
          </PressableScale>
          <View style={styles.channelBox} accessibilityLabel={`Canal ${channel}`}>
            <TelText variant="heading" color="cream" tabular>
              {channel}
            </TelText>
          </View>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Subir canal del AP ${index + 1}`} onPress={() => change(index, 1)} style={styles.stepper}>
            <TelIcon name="plus" size={20} color={colors.primary} />
          </PressableScale>
        </View>
      ))}
      <Hint tone={solvedAt ? 'good' : 'info'}>{solvedAt ? '¡Sin interferencia! Cada AP tiene su propio espacio en el espectro.' : 'Separa los canales al menos 5 números (pista: 1, 6 y 11).'}</Hint>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    minHeight: 480,
  },
  bannerSpace: {
    height: 420,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  stageGap: {
    gap: spacing.sm,
  },
  area: {
    height: AREA_H,
  },
  topologyBoard: {
    height: BOARD_H,
  },
  cloud: {
    position: 'absolute',
  },
  nodeLabel: {
    position: 'absolute',
  },
  pc: {
    position: 'absolute',
    width: 40,
    alignItems: 'center',
  },
  phone: {
    position: 'absolute',
    width: 16,
    height: 26,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.slate,
  },
  phoneOn: {
    borderColor: colors.cream,
    backgroundColor: 'rgba(111,179,217,0.35)',
  },
  slot: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentSoft,
    backgroundColor: 'rgba(7,31,49,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: colors.cream,
    backgroundColor: colors.accent,
  },
  slotWrong: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(199,62,62,0.45)',
  },
  slotTarget: {
    borderColor: colors.cream,
  },
  slotInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    position: 'absolute',
    width: 80,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: 'rgba(167,212,237,0.35)',
  },
  chipSelected: {
    borderColor: colors.cream,
    backgroundColor: colors.secondary,
  },
  chipIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.92,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  table: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7,31,49,0.6)',
    gap: 2,
  },
  tableTitle: {
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mono: {
    letterSpacing: 0.3,
  },
  packetBoard: {
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 212,
  },
  routerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routerBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
  },
  ttlTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  ttlFill: {
    height: 8,
    borderRadius: radius.pill,
  },
  interfaces: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  interface: {
    flex: 1,
    minHeight: 104,
    borderRadius: radius.lg,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    borderWidth: 1.5,
    borderColor: 'rgba(167,212,237,0.35)',
  },
  interfaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  axisLabels: {
    ...StyleSheet.absoluteFill,
  },
  axisLabel: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    textAlign: 'center',
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meterTrack: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  meterFill: {
    height: 10,
    borderRadius: radius.pill,
  },
  apRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  apDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelBox: {
    width: 48,
    alignItems: 'center',
  },
});
