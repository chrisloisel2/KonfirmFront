import React from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';

export default function PlaceholderScreen({ navigation, route }: any) {
  const screenName = route?.name ?? 'Écran';
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{screenName}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="construction" size={40} color={colors.accent} />
        </View>
        <Text style={styles.title}>En développement</Text>
        <Text style={styles.sub}>Cet écran sera disponible prochainement</Text>
        <TouchableOpacity
          style={styles.btn}
          // @ts-ignore
          onPress={() => navigation.navigate('Dashboard')}
          activeOpacity={0.85}
        >
          <MaterialIcons name="home" size={18} color="#fff" />
          <Text style={styles.btnText}>Tableau de bord</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backBtn:     { padding: 4 },
  headerTitle: { ...typography.h3, color: '#fff' },

  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  sub:   { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    ...shadows.sm,
  },
  btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
