import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../shared/services/AuthContext';
import { colors, spacing } from '../../shared/theme/theme';
import { ROLE_META, canRoleAccess } from '../../shared/config/rolePermissions';
import { UserRole } from '../../shared/types';
import { API_BASE } from '../../shared/config/api';
import { DashboardPayload, EMPTY_DATA } from './dashboard/types';
import { SHORTCUT_DEFS } from './dashboard/helpers';
import { DashboardHero } from './dashboard/sections/DashboardHero';
import { KpiSection, QuickAccessSection, RecentDossiersSection } from './dashboard/sections/OperationalSections';
import {
  AdminChartsSection,
  AdminSubscriptionsSection,
  AdminPaymentsSection,
  AdminActivationKeysSection,
} from './dashboard/sections/AdminSections';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, token, selectedBranch, selectedRole, logout } = useAuth();

  const [data, setData] = useState<DashboardPayload>(EMPTY_DATA);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [busySubId, setBusySubId] = useState<string | null>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;

  const role = (selectedRole || user?.role || 'conseiller') as UserRole;
  const roleMeta = ROLE_META[role];
  const isAdmin = role === 'admin';
  const isManager = useMemo(() => ['admin', 'responsable'].includes(role), [role]);
  const isReferentOrAbove = useMemo(() => ['admin', 'responsable', 'referent'].includes(role), [role]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Branch': selectedBranch || '' },
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) setData(json.data);
    } catch {}
  }, [selectedBranch, token]);

  useEffect(() => {
    load();
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const updatePayment = async (id: string, status: 'VERIFIED' | 'FAILED') => {
    setBusyPaymentId(id);
    try {
      const res = await fetch(`${API_BASE}/dashboard/payments/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'Erreur');
      await load();
    } catch (e: any) {
      Alert.alert('Paiement', e?.message || 'Impossible de mettre à jour');
    } finally { setBusyPaymentId(null); }
  };

  const updateSubscription = async (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') => {
    setBusySubId(id);
    try {
      const res = await fetch(`${API_BASE}/dashboard/subscriptions/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'Erreur');
      await load();
    } catch (e: any) {
      Alert.alert('Abonnement', e?.message || 'Impossible de mettre à jour');
    } finally { setBusySubId(null); }
  };

  const shortcuts = roleMeta.quickActions
    .filter(s => canRoleAccess(role, s))
    .map(s => ({ key: s, ...(SHORTCUT_DEFS[s] ?? { label: s, icon: 'widgets', color: colors.slate }) }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl + 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Bandeau hero — identique pour tous les rôles, stats financières admin uniquement */}
        <DashboardHero
          user={user}
          roleMeta={roleMeta}
          isAdmin={isAdmin}
          selectedBranch={selectedBranch}
          monitoring={data.monitoring}
          insets={insets}
          headerAnim={headerAnim}
          logout={logout}
        />

        {/* Graphiques financiers — admin uniquement */}
        {isAdmin && (
          <AdminChartsSection
            monitoring={data.monitoring}
            subscriptions={data.subscriptions}
          />
        )}

        {/* KPI opérationnels — tous les rôles, cartes filtrées par niveau */}
        <KpiSection
          kpis={data.kpis}
          isAdmin={isAdmin}
          isManager={isManager}
          isReferentOrAbove={isReferentOrAbove}
        />

        {/* Raccourcis — définis par rôle dans rolePermissions.ts */}
        <QuickAccessSection
          shortcuts={shortcuts}
          onNavigate={screen => navigation.navigate(screen)}
        />

        {/* Dossiers récents — tous les rôles */}
        <RecentDossiersSection dossiers={data.recentDossiers} />

        {/* Gestion abonnements, paiements, clés — admin uniquement */}
        {isAdmin && (
          <>
            <AdminSubscriptionsSection
              subscriptions={data.subscriptions}
              busySubId={busySubId}
              onUpdateSubscription={updateSubscription}
            />
            <AdminPaymentsSection
              payments={data.recentPayments}
              paymentsPendingReview={data.monitoring.paymentsPendingReview}
              busyPaymentId={busyPaymentId}
              onUpdatePayment={updatePayment}
            />
            <AdminActivationKeysSection activationKeys={data.activationKeys} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
