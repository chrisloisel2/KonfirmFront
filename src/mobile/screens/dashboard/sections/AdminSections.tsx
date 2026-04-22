import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../../../shared/theme/theme';
import { MonitoringSummary, SubscriptionItem, PaymentItem, ActivationKeyItem } from '../types';
import { euros, humanDate, personName, CHART_W, HALF_CHART } from '../helpers';
import { DonutChart, GaugeMRR, SectionRow, StatusBadge, ActionBtn, EmptyState, InfoRow } from '../components';
import { st } from '../styles';

// ── AdminChartsSection ─────────────────────────────────────────────────────────
// Jauge MRR + donut des abonnements. Visible admin uniquement.

interface AdminChartsSectionProps {
  monitoring: MonitoringSummary;
  subscriptions: SubscriptionItem[];
}

export function AdminChartsSection({ monitoring, subscriptions }: AdminChartsSectionProps) {
  const donutData = useMemo(() => {
    const counts: Record<string, number> = {};
    subscriptions.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
    return [
      { value: counts['ACTIVE']    || 0, name: 'Actifs',    color: '#1A6B50' },
      { value: counts['PAST_DUE']  || 0, name: 'Échus',     color: colors.gold },
      { value: counts['SUSPENDED'] || 0, name: 'Suspendus', color: '#8B1C1C' },
      { value: counts['CANCELLED'] || 0, name: 'Résiliés',  color: colors.slate3 },
    ].filter(d => d.value > 0);
  }, [subscriptions]);

  const totalSubs = donutData.reduce((a, d) => a + d.value, 0);

  return (
    <View style={st.section}>
      <SectionRow title="Tableau de bord financier" />
      <View style={st.chartsRow}>
        <View style={st.chartCard}>
          <Text style={st.chartTitle}>MRR</Text>
          <GaugeMRR mrr={monitoring.monthlyRecurringRevenueCents} width={HALF_CHART} height={140} />
        </View>
        <View style={st.chartCard}>
          <Text style={st.chartTitle}>Abonnements</Text>
          {totalSubs > 0 ? (
            <>
              <DonutChart
                data={donutData}
                width={HALF_CHART}
                height={140}
                centerLabel={`${totalSubs}\ntotal`}
              />
              <View style={st.legendWrap}>
                {donutData.map(d => (
                  <View key={d.name} style={st.legendItem}>
                    <View style={[st.legendDot, { backgroundColor: d.color }]} />
                    <Text style={st.legendText}>{d.name}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialIcons name="donut-large" size={40} color={colors.borderLight} />
              <Text style={st.chartEmptyText}>Aucune donnée</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── AdminSubscriptionsSection ──────────────────────────────────────────────────
// Liste des abonnements avec actions Activer / Suspendre / Résilier.

interface AdminSubscriptionsSectionProps {
  subscriptions: SubscriptionItem[];
  busySubId: string | null;
  onUpdateSubscription: (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') => void;
}

export function AdminSubscriptionsSection({
  subscriptions,
  busySubId,
  onUpdateSubscription,
}: AdminSubscriptionsSectionProps) {
  return (
    <View style={st.section}>
      <SectionRow
        title="Abonnements"
        right={
          <View style={st.countPill}>
            <Text style={st.countPillText}>{subscriptions.length}</Text>
          </View>
        }
      />
      {subscriptions.length === 0 ? (
        <EmptyState text="Aucun abonnement enregistré." />
      ) : (
        subscriptions.map(sub => (
          <View key={sub.id} style={st.card}>
            <View style={st.cardHead}>
              <View style={[st.cardIconWrap, { backgroundColor: colors.navy + '12' }]}>
                <MaterialIcons name="workspace-premium" size={18} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle}>{sub.companyName}</Text>
                <Text style={st.cardSub}>{sub.plan} · {sub.billingCycle} · {sub.seats} sièges</Text>
              </View>
              <StatusBadge status={sub.status} />
            </View>
            <View style={st.infoTable}>
              <InfoRow k="Montant"      v={euros(sub.priceCents, sub.currency)} />
              <InfoRow k="Responsable"  v={personName(sub.owner)} />
              <InfoRow k="Échéance"     v={humanDate(sub.currentPeriodEnd)} last />
            </View>
            <View style={st.actionRow}>
              <ActionBtn label="Activer" icon="check-circle" color={colors.success}
                disabled={busySubId === sub.id || sub.status === 'ACTIVE'}
                onPress={() => onUpdateSubscription(sub.id, 'ACTIVE')} />
              <ActionBtn label="Suspendre" icon="pause-circle" color={colors.warning}
                disabled={busySubId === sub.id || sub.status === 'SUSPENDED'}
                onPress={() => onUpdateSubscription(sub.id, 'SUSPENDED')} />
              <ActionBtn label="Résilier" icon="cancel" color={colors.danger}
                disabled={busySubId === sub.id || sub.status === 'CANCELLED'}
                onPress={() => onUpdateSubscription(sub.id, 'CANCELLED')} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ── AdminPaymentsSection ───────────────────────────────────────────────────────
// Paiements récents avec actions Vérifier / Signaler.

interface AdminPaymentsSectionProps {
  payments: PaymentItem[];
  paymentsPendingReview: number;
  busyPaymentId: string | null;
  onUpdatePayment: (id: string, status: 'VERIFIED' | 'FAILED') => void;
}

export function AdminPaymentsSection({
  payments,
  paymentsPendingReview,
  busyPaymentId,
  onUpdatePayment,
}: AdminPaymentsSectionProps) {
  return (
    <View style={st.section}>
      <SectionRow
        title="Paiements récents"
        right={
          paymentsPendingReview > 0 ? (
            <View style={[st.countPill, { backgroundColor: colors.warning + '20' }]}>
              <Text style={[st.countPillText, { color: colors.warning }]}>
                {paymentsPendingReview} en attente
              </Text>
            </View>
          ) : undefined
        }
      />
      {payments.length === 0 ? (
        <EmptyState text="Aucun paiement enregistré." icon="receipt" />
      ) : (
        payments.map(p => (
          <View key={p.id} style={st.card}>
            <View style={st.cardHead}>
              <View style={[st.cardIconWrap, { backgroundColor: '#2563EB12' }]}>
                <MaterialIcons name="payments" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle}>{p.subscription?.companyName || p.reference}</Text>
                <Text style={st.cardSub}>{p.reference} · {p.method}</Text>
              </View>
              <StatusBadge status={p.status} />
            </View>
            <View style={st.infoTable}>
              <InfoRow k="Montant" v={euros(p.amountCents, p.currency)} />
              <InfoRow k="Client"  v={personName(p.user)} />
              <InfoRow k="Date"    v={humanDate(p.paidAt)} last />
            </View>
            {p.description ? <Text style={st.noteText}>{p.description}</Text> : null}
            <View style={st.actionRow}>
              <ActionBtn label="Vérifier" icon="verified" color={colors.success}
                disabled={busyPaymentId === p.id || p.status === 'VERIFIED'}
                onPress={() => onUpdatePayment(p.id, 'VERIFIED')} />
              <ActionBtn label="Signaler" icon="error" color={colors.danger}
                disabled={busyPaymentId === p.id || p.status === 'FAILED'}
                onPress={() => onUpdatePayment(p.id, 'FAILED')} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ── AdminActivationKeysSection ─────────────────────────────────────────────────
// Clés d'activation avec donut utilisées/disponibles.

interface AdminActivationKeysSectionProps {
  activationKeys: ActivationKeyItem[];
}

export function AdminActivationKeysSection({ activationKeys }: AdminActivationKeysSectionProps) {
  const redeemed = activationKeys.filter(k => k.isRedeemed).length;
  const available = activationKeys.length - redeemed;

  return (
    <View style={st.section}>
      <SectionRow title="Clés d'activation" />
      {activationKeys.length === 0 ? (
        <EmptyState text="Aucune clé d'activation." icon="vpn-key" />
      ) : (
        <>
          <View style={[st.card, { alignItems: 'center', paddingVertical: spacing.md }]}>
            <DonutChart
              data={[
                { value: redeemed,  name: 'Utilisées',   color: colors.success },
                { value: available, name: 'Disponibles', color: colors.gold },
              ].filter(d => d.value > 0)}
              width={CHART_W - spacing.md * 2}
              height={130}
              centerLabel={`${redeemed}/${activationKeys.length}`}
            />
            <View style={st.keyStatsRow}>
              <View style={st.keyStat}>
                <View style={[st.legendDot, { backgroundColor: colors.success }]} />
                <Text style={st.keyStatText}>{redeemed} utilisée{redeemed > 1 ? 's' : ''}</Text>
              </View>
              <View style={st.keyStat}>
                <View style={[st.legendDot, { backgroundColor: colors.gold }]} />
                <Text style={st.keyStatText}>{available} disponible{available > 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>

          {activationKeys.map(k => (
            <View key={k.id} style={st.keyCard}>
              <View style={st.keyCardTop}>
                <View style={st.keyCardLeft}>
                  <View style={[st.keyPlanBadge, { backgroundColor: k.isRedeemed ? colors.successLight : colors.accentLight }]}>
                    <Text style={[st.keyPlanText, { color: k.isRedeemed ? colors.success : colors.gold }]}>
                      {k.plan}
                    </Text>
                  </View>
                  <Text style={st.keyCode}>{k.code}</Text>
                </View>
                <StatusBadge status={k.status} compact />
              </View>
              <Text style={st.keyMeta}>
                {k.label || `${k.billingCycle} · ${euros(k.priceCents, k.currency)}`}
              </Text>
              <Text style={st.keyOwner}>
                {k.isRedeemed
                  ? `✓ Utilisée par ${personName(k.redeemedByUser)}`
                  : "⬡ Disponible à l'activation"}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
