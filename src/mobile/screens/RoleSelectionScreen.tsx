import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../../shared/services/AuthContext';
import { UserRole } from '../../shared/types';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import { MaterialIcons } from '@expo/vector-icons';

const ROLES = [
  {
    key: 'conseiller' as UserRole,
    label: 'Conseiller',
    description: 'Création et suivi des dossiers clients',
    icon: 'person-outline' as const,
    accent: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    key: 'caisse' as UserRole,
    label: 'Caisse',
    description: 'Opérations de caisse et transactions',
    icon: 'point-of-sale' as const,
    accent: '#059669',
    bg: '#ECFDF5',
  },
  {
    key: 'referent' as UserRole,
    label: 'Référent LCB-FT',
    description: 'Validation des exceptions et contrôles',
    icon: 'verified-user' as const,
    accent: '#D97706',
    bg: '#FFFBEB',
  },
  {
    key: 'responsable' as UserRole,
    label: 'Responsable',
    description: 'Administration et supervision globale',
    icon: 'admin-panel-settings' as const,
    accent: '#7C3AED',
    bg: '#F5F3FF',
  },
];

export default function RoleSelectionScreen() {
  const { setRole, user } = useAuth();

  const select = (role: UserRole) => {
    setRole(role);
  };

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '??';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userBadge}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.welcomeLabel}>Bienvenue</Text>
            <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
          </View>
        </View>
        <Text style={styles.title}>Choisissez votre rôle</Text>
        <Text style={styles.subtitle}>Votre rôle détermine les accès pour cette session</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {ROLES.map(role => {
          const hasAccess = user?.permissions?.includes(`role.${role.key}`) ?? true;
          return (
            <TouchableOpacity
              key={role.key}
              style={[styles.card, !hasAccess && styles.cardDisabled]}
              onPress={() => hasAccess && select(role.key)}
              activeOpacity={0.75}
              disabled={!hasAccess}
            >
              <View style={[styles.iconWrap, { backgroundColor: role.bg }]}>
                <MaterialIcons name={role.icon} size={26} color={role.accent} />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.roleLabel, !hasAccess && styles.textMuted]}>{role.label}</Text>
                <Text style={styles.roleDesc}>{role.description}</Text>
              </View>
              {hasAccess
                ? <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
                : <View style={styles.lockBadge}><MaterialIcons name="lock" size={14} color={colors.textTertiary} /></View>
              }
            </TouchableOpacity>
          );
        })}

        <View style={styles.hint}>
          <MaterialIcons name="info-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.hintText}>Les accès sont définis par votre administrateur</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.primary,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText:    { fontSize: 14, fontWeight: '700', color: '#fff' },
  welcomeLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },
  userEmail:     { fontSize: 13, fontWeight: '600', color: '#fff' },
  title:         { ...typography.h2, color: '#fff', marginBottom: 4 },
  subtitle:      { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  list: { padding: spacing.lg, gap: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardDisabled: { opacity: 0.5 },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody:  { flex: 1 },
  roleLabel: { ...typography.h4, color: colors.textPrimary, marginBottom: 2 },
  roleDesc:  { ...typography.body2, color: colors.textSecondary },
  textMuted: { color: colors.textTertiary },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  hintText: { fontSize: 12, color: colors.textTertiary },
});
