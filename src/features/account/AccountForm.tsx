import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ChipGroup } from '@/components/Chips';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import {
  ALIAS_MAX,
  aliasProblem,
  cleanAlias,
  cleanSchool,
  contactLabels,
  CONTACT_KINDS,
  GRADES,
  needsGuardianConsent,
  normalizeContact,
  SCHOOL_MAX,
  schoolProblem,
  type ContactKind,
  type GradeId,
} from '@/account/rules';
import type { ProfilePayload } from '@/account/api';
import { colors, font, radius, spacing } from '@/theme';
import { AvatarPicker } from './AvatarPicker';

export interface AccountFormValues {
  alias: string;
  avatar: number;
  grade: GradeId | null;
  school: string;
  wantsContact: boolean;
  contactKind: ContactKind;
  contactValue: string;
  guardianConsent: boolean;
}

interface AccountFormProps {
  initial: AccountFormValues;
  level: number;
  achievements: string[];
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: ProfilePayload) => void;
}

const GRADE_OPTIONS: { id: GradeId | 'none'; label: string }[] = [{ id: 'none', label: 'Prefiero no decir' }, ...GRADES.map((grade) => ({ id: grade.id, label: grade.label }))];
const CONTACT_OPTIONS = CONTACT_KINDS.map((kind) => ({ id: kind, label: contactLabels[kind].label }));

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => onChange(!checked)} style={styles.checkRow}>
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>{checked && <TelIcon name="check" size={16} color={colors.white} strokeWidth={3.2} />}</View>
      <TelText variant="caption" color="ink" style={styles.flex}>
        {label}
      </TelText>
    </Pressable>
  );
}

// Formulario de la cuenta (crear y editar). Pide lo mínimo: alias; lo demás es opcional y el contacto
// solo se guarda con consentimiento explícito (y del apoderado/a en 7° y 8° básico).
export function AccountForm({ initial, level, achievements, submitLabel, submitting, error, onSubmit }: AccountFormProps) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof AccountFormValues>(key: K, value: AccountFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const aliasError = aliasProblem(values.alias);
  const schoolError = schoolProblem(values.school);
  const contact = values.wantsContact ? normalizeContact(values.contactKind, values.contactValue) : null;
  const contactError = values.wantsContact && !contact ? `Revisa tu ${contactLabels[values.contactKind].label.toLowerCase()}.` : null;
  const guardianNeeded = values.wantsContact && needsGuardianConsent(values.grade);
  const guardianError = guardianNeeded && !values.guardianConsent ? 'Necesitamos la autorización de tu apoderado/a para guardar un contacto.' : null;
  const firstError = aliasError ?? schoolError ?? contactError ?? guardianError;

  function submit() {
    setTouched(true);
    if (firstError) return;
    onSubmit({
      alias: cleanAlias(values.alias),
      avatar: values.avatar,
      grade: values.grade,
      school: cleanSchool(values.school) || null,
      contact: values.wantsContact && contact ? { kind: values.contactKind, value: contact } : null,
      contactConsent: values.wantsContact,
      guardianConsent: guardianNeeded ? values.guardianConsent : false,
    });
  }

  return (
    <View style={styles.form}>
      <TelCard style={styles.card}>
        <TelText variant="heading" color="ink">
          Tu jugador
        </TelText>
        <AvatarPicker value={values.avatar} onChange={(avatar) => set('avatar', avatar)} level={level} achievements={achievements} size={48} />
        <TelText variant="label" color="ink" nativeID="account-alias">
          Alias
        </TelText>
        <TextInput
          accessibilityLabel="Alias"
          accessibilityLabelledBy="account-alias"
          value={values.alias}
          onChangeText={(text) => set('alias', text.slice(0, ALIAS_MAX))}
          maxLength={ALIAS_MAX}
          placeholder="Ej: Fibra Veloz"
          placeholderTextColor={colors.slate}
          autoCapitalize="words"
          autoCorrect={false}
          style={[styles.input, font('bodySemi'), touched && aliasError && styles.inputError]}
        />
        <TelText variant="small" color={touched && aliasError ? 'danger' : 'inkSoft'}>
          {touched && aliasError ? aliasError : 'Aparece en el ranking. Mejor un apodo que tu nombre completo.'}
        </TelText>
      </TelCard>

      <TelCard style={styles.card}>
        <TelText variant="heading" color="ink">
          ¿En qué curso estás?
        </TelText>
        <TelText variant="caption" color="inkSoft">
          Opcional. Nos ayuda a preparar actividades para tu nivel.
        </TelText>
        <View style={styles.wrap}>
          <ChipGroup
            accessibilityLabel="Curso"
            options={GRADE_OPTIONS}
            value={values.grade ?? 'none'}
            onChange={(id) => set('grade', id === 'none' ? null : id)}
          />
        </View>
        <TelText variant="label" color="ink" nativeID="account-school">
          Colegio (opcional)
        </TelText>
        <TextInput
          accessibilityLabel="Colegio"
          accessibilityLabelledBy="account-school"
          value={values.school}
          onChangeText={(text) => set('school', text.slice(0, SCHOOL_MAX))}
          maxLength={SCHOOL_MAX}
          placeholder="Nombre de tu colegio o liceo"
          placeholderTextColor={colors.slate}
          autoCapitalize="words"
          style={[styles.input, font('bodySemi'), touched && schoolError && styles.inputError]}
        />
        {touched && schoolError && (
          <TelText variant="small" color="danger">
            {schoolError}
          </TelText>
        )}
      </TelCard>

      <TelCard style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <TelText variant="heading" color="ink">
              Invitaciones de Telemática
            </TelText>
            <TelText variant="caption" color="inkSoft">
              Charlas, talleres y visitas al campus como premio a tu puntaje. Opcional.
            </TelText>
          </View>
          <Switch
            accessibilityLabel="Quiero recibir invitaciones de Telemática USM"
            value={values.wantsContact}
            onValueChange={(value) => set('wantsContact', value)}
            trackColor={{ false: colors.border, true: colors.secondary }}
            thumbColor={colors.white}
          />
        </View>
        {values.wantsContact && (
          <View style={styles.contact}>
            <ChipGroup accessibilityLabel="Medio de contacto" options={CONTACT_OPTIONS} value={values.contactKind} onChange={(kind) => set('contactKind', kind)} />
            <TextInput
              accessibilityLabel={contactLabels[values.contactKind].label}
              value={values.contactValue}
              onChangeText={(text) => set('contactValue', text.slice(0, 120))}
              placeholder={contactLabels[values.contactKind].placeholder}
              placeholderTextColor={colors.slate}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={values.contactKind === 'phone' ? 'phone-pad' : values.contactKind === 'email' ? 'email-address' : 'default'}
              style={[styles.input, font('bodySemi'), touched && contactError && styles.inputError]}
            />
            {touched && contactError && (
              <TelText variant="small" color="danger">
                {contactError}
              </TelText>
            )}
            <TelText variant="small" color="inkSoft">
              Solo lo verá el equipo de Telemática USM para invitarte. Nunca aparece en el ranking ni se comparte. Puedes borrarlo cuando quieras.
            </TelText>
            {needsGuardianConsent(values.grade) && (
              <View style={styles.guardian}>
                <Checkbox
                  checked={values.guardianConsent}
                  onChange={(value) => set('guardianConsent', value)}
                  label="Mi apoderado/a sabe y está de acuerdo con que Telemática USM me contacte por este medio. (Puedes dejar el contacto de tu apoderado/a.)"
                />
                {touched && guardianError && (
                  <TelText variant="small" color="danger">
                    {guardianError}
                  </TelText>
                )}
              </View>
            )}
          </View>
        )}
      </TelCard>

      <Pressable accessibilityRole="link" onPress={() => router.push('/privacidad')} style={styles.privacy}>
        <TelIcon name="shieldLock" size={18} color={colors.inkAccent} />
        <TelText variant="label" color="inkAccent" style={styles.flex}>
          Cómo cuidamos tus datos
        </TelText>
        <TelIcon name="chevronRight" size={18} color={colors.inkAccent} />
      </Pressable>

      {(error || (touched && firstError)) && (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <TelIcon name="alert" size={18} color={colors.dangerInk} />
          <TelText variant="caption" color="dangerInk" style={styles.flex}>
            {error ?? firstError}
          </TelText>
        </View>
      )}
      <TelButton label={submitLabel} icon="check" loading={submitting} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  wrap: {
    marginHorizontal: -spacing.xs,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.danger,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contact: {
    gap: spacing.sm,
  },
  guardian: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 44,
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.inkAccent,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: colors.secondary,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
});
