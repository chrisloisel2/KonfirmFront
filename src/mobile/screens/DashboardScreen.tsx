import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../shared/services/AuthContext';
import { colors, radius, shadows, spacing, typography } from '../../shared/theme/theme';
import { ROLE_META, canRoleAccess, AppScreen } from '../../shared/config/rolePermissions';
import { UserRole } from '../../shared/types';

import { API_BASE } from '../../shared/config/api';

interface OperationalKpis {
  dossiersAujourdhui: number;
  attenteValidation: number;
  enCours: number;
  exceptionsEnAttente: number;
  scoringCritique: number;
  tauxValidation: number;
  mesExceptions: number;
}

interface MonitoringSummary {
  activeSubscriptions: number;
  subscriptionsExpiringSoon: number;
  paymentsPendingReview: number;
  availableActivationKeys: number;
  redeemedActivationKeys: number;
  monthlyRecurringRevenueCents: number;
  revenueLast30DaysCents: number;
}

interface SubscriptionItem {
  id: string;
  companyName: string;
  plan: string;
  billingCycle: string;
  status: string;
  priceCents: number;
  currency: string;
  seats: number;
  currentPeriodEnd: string;
  owner?: { firstName?: string; lastName?: string; email?: string };
}

interface PaymentItem {
  id: string;
  reference: string;
  amountCents: number;
  currency: string;
  status: string;
  method: string;
  description?: string;
  paidAt?: string;
  subscription?: { companyName?: string; plan?: string; status?: string };
  user?: { firstName?: string; lastName?: string; email?: string };
}

interface ActivationKeyItem {
  id: string;
  code: string;
  label?: string;
  plan: string;
  billingCycle: string;
  priceCents: number;
  currency: string;
  status: string;
  isRedeemed: boolean;
  redeemedAt?: string;
  redeemedByUser?: { firstName?: string; lastName?: string; email?: string };
}

interface DashboardPayload {
  kpis: OperationalKpis;
  monitoring: MonitoringSummary;
  recentDossiers: Array<{
    id: string;
    numero: string;
    status: string;
    typeOuverture: string;
    montantInitial: number | null;
    client: string;
    updatedAt: string;
  }>;
  subscriptions: SubscriptionItem[];
  recentPayments: PaymentItem[];
  activationKeys: ActivationKeyItem[];
}

const EMPTY_DATA: DashboardPayload = {
  kpis: {
    dossiersAujourdhui: 0,
    attenteValidation: 0,
    enCours: 0,
    exceptionsEnAttente: 0,
    scoringCritique: 0,
    tauxValidation: 0,
    mesExceptions: 0,
  },
  monitoring: {
    activeSubscriptions: 0,
    subscriptionsExpiringSoon: 0,
    paymentsPendingReview: 0,
    availableActivationKeys: 0,
    redeemedActivationKeys: 0,
    monthlyRecurringRevenueCents: 0,
    revenueLast30DaysCents: 0,
  },
  recentDossiers: [],
  subscriptions: [],
  recentPayments: [],
  activationKeys: [],
};

const STATUS_COLORS: Record<string, { tone: string; bg: string }> = {
  ACTIVE: { tone: colors.success, bg: colors.successLight },
  PAST_DUE: { tone: colors.warning, bg: colors.warningLight },
  SUSPENDED: { tone: colors.error, bg: colors.errorLight },
  CANCELLED: { tone: colors.textSecondary, bg: colors.borderLight },
  PENDING: { tone: colors.warning, bg: colors.warningLight },
  PAID: { tone: colors.info, bg: colors.infoLight },
  VERIFIED: { tone: colors.success, bg: colors.successLight },
  FAILED: { tone: colors.error, bg: colors.errorLight },
  REFUNDED: { tone: '#7C3AED', bg: '#F5F3FF' },
  REDEEMED: { tone: colors.success, bg: colors.successLight },
};

function euros(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format((cents || 0) / 100);
}

function humanDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function personName(person?: { firstName?: string; lastName?: string; email?: string }): string {
  const fullName = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
  return fullName || person?.email || '—';
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, token, selectedBranch, selectedRole, logout } = useAuth();
  const [data, setData] = useState<DashboardPayload>(EMPTY_DATA);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [busySubscriptionId, setBusySubscriptionId] = useState<string | null>(null);

  const role = (selectedRole || user?.role || 'conseiller') as UserRole;
  const roleMeta = ROLE_META[role];

  const isManager = useMemo(
    () => ['admin', 'responsable'].includes(role),
    [role]
  );

  const isReferentOrAbove = useMemo(
    () => ['admin', 'responsable', 'referent'].includes(role),
    [role]
  );

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Branch': selectedBranch || '',
        },
      });

      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json.data) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Erreur dashboard:', error);
    }
  }, [selectedBranch, token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const updatePaymentStatus = async (paymentId: string, status: 'VERIFIED' | 'FAILED') => {
    setBusyPaymentId(paymentId);
    try {
      const response = await fetch(`${API_BASE}/dashboard/payments/${paymentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.message || 'Mise à jour refusée');
      }

      await load();
    } catch (error: any) {
      Alert.alert('Paiement', error?.message || 'Impossible de mettre à jour le paiement');
    } finally {
      setBusyPaymentId(null);
    }
  };

  const updateSubscriptionStatus = async (subscriptionId: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') => {
    setBusySubscriptionId(subscriptionId);
    try {
      const response = await fetch(`${API_BASE}/dashboard/subscriptions/${subscriptionId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.message || 'Mise à jour refusée');
      }

      await load();
    } catch (error: any) {
      Alert.alert('Abonnement', error?.message || "Impossible de mettre à jour l'abonnement");
    } finally {
      setBusySubscriptionId(null);
    }
  };

  const SHORTCUT_DEFS: Record<AppScreen, { label: string; icon: string; color: string }> = {
    NewDossier:           { label: 'Nouveau dossier',  icon: 'add-circle',      color: colors.navy },
    IdentityVerification: { label: 'Vérif. identité',  icon: 'badge',           color: colors.navy2 },
    ValidationFinale:     { label: 'Validation',        icon: 'task-alt',        color: colors.success },
    Scoring:              { label: 'Scoring',           icon: 'speed',           color: colors.warning },
    Exceptions:           { label: 'Exceptions',        icon: 'report-problem',  color: colors.danger },
    UniversalSearch:      { label: 'Recherche',         icon: 'search',          color: '#2563EB' },
    BatchSearch:          { label: 'Batch',             icon: 'table-rows',      color: '#D97706' },
    Watchlists:           { label: 'Watchlists',        icon: 'visibility',      color: colors.success },
    IntelligenceReport:   { label: 'Intelligence',      icon: 'query-stats',     color: colors.warning },
    InvestigationTools:   { label: 'Investigation',     icon: 'manage-search',   color: colors.navy3 },
    Settings:             { label: 'Paramètres',        icon: 'settings',        color: colors.slate2 },
    Dashboard:            { label: 'Dashboard',         icon: 'dashboard',       color: colors.navy },
    DocumentCapture:      { label: 'Capture doc',       icon: 'document-scanner',color: colors.slate },
    OCRResult:            { label: 'OCR',               icon: 'text-snippet',    color: colors.slate },
    OCRProcessing:        { label: 'Traitement',        icon: 'hourglass-top',   color: colors.slate },
    Timeline:             { label: 'Historique',        icon: 'timeline',        color: colors.slate2 },
    SearchDetail:         { label: 'Détail recherche',  icon: 'preview',         color: colors.slate2 },
    DossierBloque:        { label: 'Bloqué',            icon: 'block',           color: colors.danger },
    EscaladeSuperieur:    { label: 'Escalade',          icon: 'escalator-warning', color: colors.warning },
    ExceptionHandling:    { label: 'Traiter exception', icon: 'handyman',        color: colors.danger },
    ResearchHub:          { label: 'Hub recherche',     icon: 'hub',             color: colors.navy3 },
  };

  const shortcuts = roleMeta.quickActions
    .filter(screen => canRoleAccess(role, screen))
    .map(screen => ({ key: screen, ...SHORTCUT_DEFS[screen] }));

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || (user?.email?.slice(0, 2).toUpperCase() || 'KF');

  const isAdmin = role === 'admin';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.userCluster}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>{roleMeta.label.toUpperCase()}</Text>
                <Text style={styles.heroTitle}>{user?.firstName ? `${user.firstName} ${user?.lastName || ''}`.trim() : (user?.companyName || 'Konfirm')}</Text>
                <Text style={styles.heroMeta}>{user?.email}{selectedBranch ? ` - ${selectedBranch}` : ''}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => logout()} style={styles.heroAction}>
              <MaterialIcons name="logout" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Métriques de monitoring : ADMIN UNIQUEMENT */}
          {isAdmin && (
            <View style={styles.heroGrid}>
              <HeroMetric label="MRR" value={euros(data.monitoring.monthlyRecurringRevenueCents)} icon="monitor-heart" />
              <HeroMetric label="30 jours" value={euros(data.monitoring.revenueLast30DaysCents)} icon="payments" />
              <HeroMetric label="Abonnés actifs" value={String(data.monitoring.activeSubscriptions)} icon="workspace-premium" />
              <HeroMetric label="Paiements à valider" value={String(data.monitoring.paymentsPendingReview)} icon="fact-check" />
            </View>
          )}
        </View>

        {/* ── KPI opérationnels — visibles selon rôle ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isAdmin ? 'KPI opérationnels' : 'Mes indicateurs'}
          </Text>
          <View style={styles.metricsRow}>
            {/* Tous les rôles voient leurs propres dossiers */}
            <MiniMetric label="Dossiers aujourd'hui" value={data.kpis.dossiersAujourdhui} color={colors.accent} />

            {/* Référent, responsable, admin : en attente de validation */}
            {isReferentOrAbove && (
              <MiniMetric label="À valider" value={data.kpis.attenteValidation} color={colors.warning} />
            )}

            {/* Référent, responsable, admin : exceptions */}
            {isReferentOrAbove && (
              <MiniMetric label="Mes exceptions" value={data.kpis.mesExceptions} color={colors.danger} />
            )}

            {/* Admin et responsable uniquement : taux de validation global */}
            {isManager && (
              <MiniMetric label="Taux valid." value={`${data.kpis.tauxValidation}%`} color={colors.success} />
            )}

            {/* Responsable et admin : scoring critique de la société */}
            {isManager && (
              <MiniMetric label="Scoring critique" value={data.kpis.scoringCritique} color={colors.danger} />
            )}
          </View>
        </View>

        {/* ── Raccourcis métier ── */}
        {shortcuts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accès rapide</Text>
            <View style={styles.shortcutsGrid}>
              {shortcuts.map((shortcut) => (
                <TouchableOpacity
                  key={shortcut.key}
                  style={styles.shortcutCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate(shortcut.key)}
                >
                  <View style={[styles.shortcutIcon, { backgroundColor: `${shortcut.color}16` }]}>
                    <MaterialIcons name={shortcut.icon as any} size={20} color={shortcut.color} />
                  </View>
                  <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Dossiers récents — tous rôles ── */}
        {data.recentDossiers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dossiers récents</Text>
            {data.recentDossiers.map((d) => (
              <View key={d.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{d.client}</Text>
                    <Text style={styles.cardSub}>{d.numero} · {d.typeOuverture}</Text>
                  </View>
                  <StatusPill
                    label={d.status}
                    tone={STATUS_COLORS[d.status]?.tone ?? colors.textSecondary}
                    bg={STATUS_COLORS[d.status]?.bg ?? colors.borderLight}
                  />
                </View>
                {d.montantInitial != null && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Montant</Text>
                    <Text style={styles.infoValue}>{euros(d.montantInitial * 100)}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Mis à jour</Text>
                  <Text style={styles.infoValue}>{humanDate(d.updatedAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ══════════════════════════════════════════
            SECTIONS RÉSERVÉES À L'ADMIN UNIQUEMENT
            ══════════════════════════════════════════ */}
        {isAdmin && (
          <>
            {/* ── Abonnements ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Abonnements</Text>
              {data.subscriptions.length === 0 ? (
                <EmptyState text="Aucun abonnement actif ou enregistré pour le moment." />
              ) : (
                data.subscriptions.map((subscription) => {
                  const palette = STATUS_COLORS[subscription.status] || { tone: colors.textSecondary, bg: colors.borderLight };
                  return (
                    <View key={subscription.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{subscription.companyName}</Text>
                          <Text style={styles.cardSub}>{subscription.plan} · {subscription.billingCycle} · {personName(subscription.owner)}</Text>
                        </View>
                        <StatusPill label={subscription.status} tone={palette.tone} bg={palette.bg} />
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Montant</Text>
                        <Text style={styles.infoValue}>{euros(subscription.priceCents, subscription.currency)}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Sièges</Text>
                        <Text style={styles.infoValue}>{subscription.seats}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Échéance</Text>
                        <Text style={styles.infoValue}>{humanDate(subscription.currentPeriodEnd)}</Text>
                      </View>
                      <View style={styles.actionRow}>
                        <ActionButton label="Activer" icon="check-circle" color={colors.success}
                          disabled={busySubscriptionId === subscription.id || subscription.status === 'ACTIVE'}
                          onPress={() => updateSubscriptionStatus(subscription.id, 'ACTIVE')} />
                        <ActionButton label="Suspendre" icon="pause-circle" color={colors.warning}
                          disabled={busySubscriptionId === subscription.id || subscription.status === 'SUSPENDED'}
                          onPress={() => updateSubscriptionStatus(subscription.id, 'SUSPENDED')} />
                        <ActionButton label="Résilier" icon="cancel" color={colors.danger}
                          disabled={busySubscriptionId === subscription.id || subscription.status === 'CANCELLED'}
                          onPress={() => updateSubscriptionStatus(subscription.id, 'CANCELLED')} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* ── Paiements ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Paiements</Text>
              {data.recentPayments.length === 0 ? (
                <EmptyState text="Aucun paiement enregistré." />
              ) : (
                data.recentPayments.map((payment) => {
                  const palette = STATUS_COLORS[payment.status] || { tone: colors.textSecondary, bg: colors.borderLight };
                  return (
                    <View key={payment.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{payment.subscription?.companyName || payment.reference}</Text>
                          <Text style={styles.cardSub}>{payment.reference} · {payment.method}</Text>
                        </View>
                        <StatusPill label={payment.status} tone={palette.tone} bg={palette.bg} />
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Montant</Text>
                        <Text style={styles.infoValue}>{euros(payment.amountCents, payment.currency)}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Client</Text>
                        <Text style={styles.infoValue}>{personName(payment.user)}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Date</Text>
                        <Text style={styles.infoValue}>{humanDate(payment.paidAt)}</Text>
                      </View>
                      {!!payment.description && <Text style={styles.note}>{payment.description}</Text>}
                      <View style={styles.actionRow}>
                        <ActionButton label="Vérifier" icon="verified" color={colors.success}
                          disabled={busyPaymentId === payment.id || payment.status === 'VERIFIED'}
                          onPress={() => updatePaymentStatus(payment.id, 'VERIFIED')} />
                        <ActionButton label="Signaler" icon="error" color={colors.danger}
                          disabled={busyPaymentId === payment.id || payment.status === 'FAILED'}
                          onPress={() => updatePaymentStatus(payment.id, 'FAILED')} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* ── Clés d'activation ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Clés d'activation</Text>
              {data.activationKeys.length === 0 ? (
                <EmptyState text="Aucune clé d'activation disponible." />
              ) : (
                <View style={styles.keysWrap}>
                  {data.activationKeys.map((key) => {
                    const palette = STATUS_COLORS[key.status] || { tone: colors.textSecondary, bg: colors.borderLight };
                    return (
                      <View key={key.id} style={styles.keyCard}>
                        <View style={styles.keyTop}>
                          <Text style={styles.keyPlan}>{key.plan}</Text>
                          <StatusPill label={key.status} tone={palette.tone} bg={palette.bg} compact />
                        </View>
                        <Text style={styles.keyCode}>{key.code}</Text>
                        <Text style={styles.keyMeta}>{key.label || `${key.billingCycle} · ${euros(key.priceCents, key.currency)}`}</Text>
                        <Text style={styles.keyOwner}>
                          {key.isRedeemed ? `Utilisée par ${personName(key.redeemedByUser)}` : "Disponible à l'activation"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function HeroMetric({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.heroMetric}>
      <MaterialIcons name={icon} size={18} color="#DCE8FF" />
      <Text style={styles.heroMetricValue}>{value}</Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={styles.miniMetric}>
      <View style={[styles.miniMetricDot, { backgroundColor: color }]} />
      <Text style={styles.miniMetricValue}>{value}</Text>
      <Text style={styles.miniMetricLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, tone, bg, compact = false }: { label: string; tone: string; bg: string; compact?: boolean }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }, compact && styles.statusPillCompact]}>
      <Text style={[styles.statusText, { color: tone }]}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  color,
  disabled,
  onPress,
}: {
  label: string;
  icon: any;
  color: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <MaterialIcons name={icon} size={16} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <MaterialIcons name="inventory-2" size={20} color={colors.textTertiary} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  userCluster: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  heroLabel: { color: '#B9C9EA', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.4 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },
  heroMeta: { color: '#B9C9EA', fontSize: 13, marginTop: 2 },
  heroAction: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroMetric: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  heroMetricValue: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 10 },
  heroMetricLabel: { color: '#C6D4F0', fontSize: 12, marginTop: 4 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  miniMetric: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  miniMetricDot: { width: 10, height: 10, borderRadius: radius.full, marginBottom: 8 },
  miniMetricValue: { ...typography.h3, color: colors.textPrimary },
  miniMetricLabel: { ...typography.body2, color: colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { ...typography.h4, color: colors.textPrimary },
  cardSub: { ...typography.body2, color: colors.textSecondary, marginTop: 2 },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusPillCompact: { paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.4 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoKey: { ...typography.body2, color: colors.textSecondary },
  infoValue: { ...typography.body2, color: colors.textPrimary, fontWeight: '600' as const },
  note: { ...typography.body2, color: colors.textSecondary, marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
  },
  actionButtonDisabled: { opacity: 0.45 },
  actionLabel: { fontSize: 12, fontWeight: '700' as const },
  keysWrap: { gap: spacing.sm },
  keyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  keyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  keyPlan: { ...typography.label, color: colors.primaryDark },
  keyCode: { fontSize: 16, fontWeight: '800' as const, color: colors.textPrimary },
  keyMeta: { ...typography.body2, color: colors.textSecondary, marginTop: 4 },
  keyOwner: { ...typography.body2, color: colors.textTertiary, marginTop: 8 },
  shortcutsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcutCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  shortcutLabel: { ...typography.body1, color: colors.textPrimary, fontWeight: '700' as const },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 8,
    ...shadows.sm,
  },
  emptyText: { ...typography.body2, color: colors.textSecondary, textAlign: 'center' },
});
