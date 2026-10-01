import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { useAccount } from '@/account/store';
import { colors, spacing } from '@/theme';

interface Section {
  icon: IconName;
  title: string;
  items: string[];
}

const SECTIONS: Section[] = [
  {
    icon: 'database',
    title: 'Qué guardamos',
    items: [
      'Sin cuenta: tu progreso (XP, logros, partidas) queda solo en este teléfono.',
      'Con cuenta: tu alias, tu avatar y tu progreso de juego, para el ranking.',
      'Opcional: tu curso y tu colegio.',
      'Solo si lo autorizas: un medio de contacto (correo, celular o Instagram).',
    ],
  },
  {
    icon: 'target',
    title: 'Para qué',
    items: [
      'Mostrar tu posición en el ranking global y registrar tus puntajes.',
      'Que puedas recuperar tu cuenta en otro teléfono con tu código.',
      'Invitarte a charlas, talleres y actividades de Telemática USM, solo si lo aceptaste.',
    ],
  },
  {
    icon: 'eye',
    title: 'Quién ve qué',
    items: [
      'En el ranking solo aparecen tu alias, avatar, nivel y XP.',
      'Tu curso, colegio y contacto solo los ve el equipo de Telemática USM. No se venden ni se comparten.',
    ],
  },
  {
    icon: 'users',
    title: 'Si eres menor de edad',
    items: [
      'Para dejar un contacto en 7° u 8° básico necesitas la autorización de tu apoderado/a.',
      'Te recomendamos dejar el contacto de tu apoderado/a en vez del tuyo.',
      'No pedimos tu nombre real, tu RUT ni tu fecha de nacimiento.',
    ],
  },
  {
    icon: 'shieldLock',
    title: 'Cómo los protegemos',
    items: [
      'No hay contraseñas: tu acceso es un código secreto que guarda la app de forma cifrada.',
      'Los datos de contacto se guardan cifrados en el servidor.',
      'La comunicación con el servidor va cifrada (HTTPS).',
    ],
  },
  {
    icon: 'edit',
    title: 'Tus derechos',
    items: [
      'Puedes ver, corregir o borrar tus datos cuando quieras en Perfil → Cuenta.',
      'Al eliminar tu cuenta se borra todo lo que hay de ti en el servidor.',
      'Puedes retirar tu consentimiento de contacto en cualquier momento.',
    ],
  },
];

// Aviso de privacidad (en lenguaje simple, pensado para estudiantes de enseñanza media).
export default function PrivacyScreen() {
  const account = useAccount();
  return (
    <Screen header={<AppHeader onBack={() => router.back()} kicker="Privacidad" title="Cómo cuidamos tus datos" subtitle="SoyTEL · Ingeniería Civil Telemática USM" />}>
      {SECTIONS.map((section) => (
        <TelCard key={section.title} style={styles.card}>
          <View style={styles.head}>
            <View style={styles.icon}>
              <TelIcon name={section.icon} size={18} color={colors.primary} />
            </View>
            <TelText variant="heading" color="primary">
              {section.title}
            </TelText>
          </View>
          {section.items.map((item) => (
            <View key={item} style={styles.item}>
              <View style={styles.bullet} />
              <TelText variant="body" color="muted" style={styles.flex}>
                {item}
              </TelText>
            </View>
          ))}
        </TelCard>
      ))}
      <TelText variant="caption" color="muted" align="center">
        ¿Dudas? Acércate al stand de Telemática o escribe a admision@usm.cl.
      </TelText>
      {account.status === 'registered' ? (
        <TelButton label="Ver o editar mis datos" icon="user" onPress={() => router.push('/cuenta')} />
      ) : (
        <TelButton label="Volver" variant="outline" onPress={() => router.back()} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
    backgroundColor: colors.accent,
  },
  flex: {
    flex: 1,
  },
});
