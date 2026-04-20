import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../../shared/services/AuthContext';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import { MaterialIcons } from '@expo/vector-icons';

interface Branch { id: string; name: string; address?: string; code?: string; isActive: boolean; }

export default function BranchSelectionScreen() {
  const { setBranch, user, token, selectedRole } = useAuth();
  const [branches, setBranches]       = useState<Branch[]>([]);
  const [selected, setSelected]       = useState<string>('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('http://localhost:3001/api/settings/shops', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(r => {
        if (r.success && Array.isArray(r.data)) {
          setBranches(r.data);
        } else {
          setError("Impossible de charger vos agences.");
        }
      })
      .catch(() => setError("Impossible de joindre le serveur."))
      .finally(() => setLoading(false));
  }, [token]);

  const active = branches.filter(b => b.isActive);

  const confirm = () => {
    if (!selected) return;
    setBranch(branches.find(b => b.id === selected)?.name ?? selected);
  };

  const roleLabel: Record<string, string> = {
    conseiller: 'Conseiller', caisse: 'Caisse',
    referent: 'Référent LCB-FT', responsable: 'Responsable', admin: 'Administrateur',
  };
  const effectiveRole = selectedRole ?? user?.role;

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Chargement des agences…</Text>
    </View>
  );

  if (error) return (
    <View style={styles.center}>
      <MaterialIcons name="error-outline" size={40} color={colors.error} />
      <Text style={[styles.loadingText, { color: colors.error, textAlign: 'center', paddingHorizontal: 32 }]}>{error}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <View style={styles.header}>
        <View style={styles.rolePill}>
          <MaterialIcons name="verified-user" size={13} color={colors.accent} />
          <Text style={styles.roleText}>{roleLabel[effectiveRole ?? ''] ?? effectiveRole}</Text>
        </View>
        <Text style={styles.title}>Sélectionnez votre agence</Text>
        <Text style={styles.subtitle}>Choisissez l'agence pour cette session de travail</Text>
      </View>

      <FlatList
        data={active}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = selected === item.id;
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelected(item.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.radioCircle, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.branchName, isSelected && styles.branchNameSelected]}>
                  {item.name}
                </Text>
                {item.code && (
                  <View style={styles.codePill}>
                    <Text style={styles.codeText}>{item.code}</Text>
                  </View>
                )}
                {(item.address || (item as any).city) && (
                  <Text style={styles.address}>
                    {[item.address, (item as any).city].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
              {isSelected && <MaterialIcons name="check-circle" size={22} color={colors.accent} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="location-off" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Aucune agence disponible</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, !selected && styles.btnDisabled]}
          onPress={confirm}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Accéder au tableau de bord</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },

  header: {
    backgroundColor: colors.primary,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  roleText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  title:    { ...typography.h2, color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  list: { padding: spacing.lg, gap: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 12,
    ...shadows.sm,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: '#FAFCFF',
  },

  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { borderColor: colors.accent },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },

  cardBody: { flex: 1 },
  branchName: { ...typography.h4, color: colors.textPrimary, marginBottom: 4 },
  branchNameSelected: { color: colors.accent },
  codePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.borderLight,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  codeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 },
  address:  { ...typography.body2, color: colors.textSecondary },

  empty:     { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: colors.textTertiary },

  footer: { padding: spacing.lg, paddingBottom: 28 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.sm,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { ...typography.button, color: '#fff', fontSize: 15 },
});
