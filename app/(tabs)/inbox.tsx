import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/Blocks';
import { ChipGroup } from '@/components/Chips';
import { SkeletonCard } from '@/components/feedback/Skeleton';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { dayGroup, relativeTime } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { loadInbox, markAllInboxRead, markInboxRead, useInbox, type InboxItem, type InboxKind } from '@/storage/inbox';
import { colors, spacing } from '@/theme';

type Filter = 'all' | InboxKind;

const kindStyle: Record<InboxKind, { label: string; icon: IconName; tint: [string, string] }> = {
  logro: { label: 'LOGRO', icon: 'trophy', tint: [colors.successSoft, colors.successInk] },
  progreso: { label: 'PROGRESO', icon: 'rocket', tint: [colors.highlight, colors.secondary] },
  rutix: { label: 'RUTIX', icon: 'robot', tint: [colors.cream, colors.warningInk] },
  dato: { label: 'DATO', icon: 'lightbulb', tint: [colors.primary, colors.cream] },
  aviso: { label: 'AVISO', icon: 'megaphone', tint: [colors.primary, colors.cream] },
};

// Pantalla "Centro de notificaciones" de Claude Design, alimentada por eventos locales.
export default function InboxScreen() {
  const entering = useEntering();
  const items = useInbox();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      void loadInbox().then(() => setReady(true));
    }, []),
  );

  const unread = items.filter((item) => !item.read).length;
  const visible = items.filter((item) => filter === 'all' || item.kind === filter);
  const groups = (['HOY', 'AYER', 'ANTES'] as const)
    .map((title) => ({ title, items: visible.filter((item) => dayGroup(item.createdAt) === title) }))
    .filter((group) => group.items.length > 0);

  async function open(item: InboxItem) {
    await markInboxRead(item.id);
    if (item.route) router.push(item.route as Href);
  }

  return (
    <Screen
      inTabs
      header={
        <AppHeader
          kicker="Centro de avisos"
          title="Avisos"
          subtitle={unread === 0 ? 'Estás al día' : unread === 1 ? '1 aviso sin leer' : `${unread} avisos sin leer`}
          art={
            unread > 0 ? (
              <TelButton label="Marcar todo leído" variant="outlineLight" size="sm" fullWidth={false} onPress={() => void markAllInboxRead()} />
            ) : undefined
          }
        >
          <ChipGroup
            tone="dark"
            accessibilityLabel="Filtrar avisos"
            value={filter}
            onChange={setFilter}
            inset={spacing.gutter}
            options={[
              { id: 'all', label: 'Todas' },
              { id: 'logro', label: 'Logros' },
              { id: 'progreso', label: 'Progreso' },
              { id: 'rutix', label: 'Rutix' },
              { id: 'dato', label: 'Datos' },
              { id: 'aviso', label: 'Avisos' },
            ]}
          />
        </AppHeader>
      }
    >
      {!ready && items.length === 0 ? (
        <View style={styles.list}>
          {[0, 1, 2].map((index) => (
            <SkeletonCard key={index} />
          ))}
        </View>
      ) : groups.length === 0 ? (
        <EmptyState
          illustration="inbox"
          title="Nada por aquí todavía"
          body="Te avisaremos cuando ganes medallas, subas de nivel o Rutix te necesite."
          actionLabel="Ir a jugar"
          onAction={() => router.navigate('/games')}
        />
      ) : (
        groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <TelText variant="small" color="muted" style={styles.groupTitle} accessibilityRole="header">
              {group.title}
            </TelText>
            {group.items.map((item, index) => {
              const style = kindStyle[item.kind];
              return (
                <Animated.View key={item.id} entering={entering.fadeUp(index)}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`${item.read ? '' : 'No leído. '}${item.title}. ${item.body}`}
                    onPress={() => void open(item)}
                    scaleTo={0.98}
                    style={[styles.item, item.read ? styles.itemRead : styles.itemUnread]}
                  >
                    <View style={[styles.icon, { backgroundColor: style.tint[0] }]}>
                      <TelIcon name={style.icon} size={20} color={style.tint[1]} />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.metaRow}>
                        <TelText variant="small" color="secondary" style={styles.tag}>
                          {style.label}
                        </TelText>
                        <TelText variant="caption" color="muted" style={styles.time}>
                          {relativeTime(item.createdAt)}
                        </TelText>
                      </View>
                      <TelText variant={item.read ? 'label' : 'subtitle'} color="primary" style={styles.title}>
                        {item.title}
                      </TelText>
                      <TelText variant="caption" color="muted">
                        {item.body}
                      </TelText>
                    </View>
                    <View style={[styles.dot, !item.read && styles.dotUnread]} />
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  group: {
    gap: spacing.xs,
  },
  groupTitle: {
    letterSpacing: 1.6,
    marginLeft: 4,
    marginTop: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  itemUnread: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    boxShadow: '0px 6px 18px rgba(11, 45, 69, 0.08)',
  },
  itemRead: {
    backgroundColor: colors.paper,
    borderColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tag: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  time: {
    marginLeft: 'auto',
    fontSize: 12,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  dotUnread: {
    backgroundColor: colors.danger,
  },
});
