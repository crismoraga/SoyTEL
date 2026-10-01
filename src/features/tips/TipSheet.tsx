import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tag } from '@/components/Chips';
import { Rutix } from '@/components/graphics/Rutix';
import { Sheet } from '@/components/Sheet';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { areaLabels } from '@/data/questions';
import { randomTip, type Tip } from '@/data/tips';
import { spacing } from '@/theme';

interface TipSheetProps {
  tip: Tip;
  visible: boolean;
  onClose: () => void;
}

// Dato del día completo en una hoja (con opción de ver otro dato al azar).
export function TipSheet({ tip, visible, onClose }: TipSheetProps) {
  const [extra, setExtra] = useState<Tip | null>(null);
  const shown = extra ?? tip;
  const area = shown.area === 'general' ? 'General' : (areaLabels[shown.area] ?? 'Telemática');

  function close() {
    setExtra(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={close} accessibilityLabel="Dato del día" tone="dark">
      <View style={styles.body}>
        <Rutix size={110} expression="happy" pose="wave" />
        <View style={styles.tags}>
          <Tag tone="cream" icon="lightbulb" label={extra ? 'OTRO DATO' : 'DATO DEL DÍA'} />
          <Tag tone="glass" label={area} />
        </View>
        <TelText variant="heading" color="cream" align="center" accessibilityLiveRegion="polite">
          {shown.text}
        </TelText>
      </View>
      <View style={styles.actions}>
        <TelButton label="Otro dato" variant="outlineLight" icon="shuffle" onPress={() => setExtra(randomTip(shown.id))} />
        <TelButton label="Cerrar" variant="cream" onPress={close} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
});
