import React, { useMemo, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Exception, Recherche, ScoringResult } from '../../shared/types';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';
import { ReportInput } from '../../shared/services/pdfReportService';
import { genererPdfServeur, telechargerPdfArchive } from '../../shared/services/archivageApiService';
import { useAuth } from '../../shared/services/AuthContext';
import { API_BASE } from '../../shared/config/api';

type FinalStatus = 'validated' | 'escalated' | 'blocked' | 'under_review';

interface RouteParams {
  dossierId?: string;
  dossierData?: any;
  recherches?: Recherche[];
  scoring?: ScoringResult;
  decisions?: Record<string, 'valider' | 'refuser' | 'escalader' | 'bloquer'>;
  justifications?: Record<string, string>;
  exceptions?: Exception[];
  finalStatus?: FinalStatus;
}

const STATUS_META: Record<FinalStatus, { title: string; subtitle: string; color: string; bg: string; icon: string }> = {
  validated: {
    title: 'Dossier validé',
    subtitle: 'Le rapport de conformité sera généré et archivé automatiquement à la clôture.',
    color: colors.success,
    bg: colors.successLight,
    icon: 'verified',
  },
  escalated: {
    title: 'Dossier escaladé',
    subtitle: 'Le dossier est orienté vers un niveau de décision supérieur. Le rapport sera archivé.',
    color: '#7C3AED',
    bg: '#F5F3FF',
    icon: 'call-made',
  },
  blocked: {
    title: 'Dossier bloqué',
    subtitle: 'Mesure conservatoire activée. Le rapport sera généré et archivé à la clôture.',
    color: colors.error,
    bg: colors.errorLight,
    icon: 'block',
  },
  under_review: {
    title: 'Dossier en revue',
    subtitle: 'Des compléments sont requis avant clôture définitive.',
    color: colors.warning,
    bg: colors.warningLight,
    icon: 'pending-actions',
  },
};

const DECISION_LABELS: Record<string, string> = {
  valider: 'Validation',
  refuser: 'Refus',
  escalader: 'Escalade',
  bloquer: 'Blocage',
};

const RECHERCHE_LABELS: Record<string, string> = {
  ppe: 'PPE',
  sanctions: 'Sanctions',
  gel_avoirs: 'Gel des avoirs',
  pays_liste: 'Pays listés',
  reputation: 'Réputation',
  beneficiaires_effectifs: 'Bénéficiaires effectifs',
};

function getFinalDecision(scoring?: ScoringResult, finalStatus?: FinalStatus): ScoringResult['decision'] {
  if (scoring?.decision) return scoring.decision;
  if (finalStatus === 'blocked') return 'blocage';
  if (finalStatus === 'escalated') return 'escalade';
  if (finalStatus === 'under_review') return 'examen_renforce';
  return 'auto_validated';
}

function buildValidationEntries(
  exceptions: Exception[],
  decisions: Record<string, string>,
  justifications: Record<string, string>,
) {
  return exceptions.map((exception) => ({
    exceptionId: exception.id,
    type: exception.type,
    description: exception.description,
    decision: decisions[exception.id] || 'valider',
    decisionLabel: DECISION_LABELS[decisions[exception.id] || 'valider'] || 'Validation',
    justification: justifications[exception.id] || '',
  }));
}

function buildReportPayload(params: RouteParams): ReportInput {
  const dossierId = params.dossierId || params.scoring?.dossierId || params.dossierData?.id || 'DOSSIER-SANS-ID';
  const dossierData = params.dossierData || {};
  const identity = dossierData?.identity || {};
  const verificationResults = identity?.verificationResults || [];
  const exceptions = params.exceptions || [];
  const decisions = params.decisions || {};
  const justifications = params.justifications || {};
  const finalStatus = params.finalStatus || 'validated';

  return {
    dossierId,
    finalStatus,
    identity: {
      nom: identity.nom || '',
      prenom: identity.prenom || '',
      dateNaissance: identity.dateNaissance || '',
      nationalite: identity.nationalite || '',
      numeroDocument: identity.numeroDocument || '',
      dateExpiration: identity.dateExpiration || '',
      docType: dossierData?.docType || '',
    },
    dossier: {
      type: dossierData?.type || 'achat',
      clientType: dossierData?.clientType || '',
      montant: dossierData?.montant || 0,
      seuilLCBFT: dossierData?.seuilLCBFT,
      moyenPaiement: dossierData?.moyenPaiement,
      intermediaire: dossierData?.intermediaire,
    },
    verificationResults,
    recherches: params.recherches || dossierData?.recherches || [],
    scoring: params.scoring || {
      id: `scoring-${dossierId}`,
      dossierId,
      scorePPE: 0,
      scorePays: 0,
      scoreReputation: 0,
      scoreSignaux: 0,
      scoreFinal: 0,
      decision: getFinalDecision(params.scoring, finalStatus),
      justification: 'Aucune justification calculée disponible.',
      calculatedAt: new Date(),
    },
    validation: {
      completedAt: new Date(),
      decisions: buildValidationEntries(exceptions, decisions, justifications),
      summary: finalStatus === 'validated'
        ? 'Validation finale prononcée après revue des retours et des signaux.'
        : finalStatus === 'blocked'
          ? 'Blocage prononcé après revue des retours et des exceptions.'
          : finalStatus === 'escalated'
            ? 'Escalade prononcée après revue des retours et arbitrage intermédiaire.'
            : 'Le dossier reste en revue à l’issue de l’analyse.',
    },
    agentName: dossierData?.agent?.name,
    branchName: dossierData?.branch?.name,
  };
}

const FINAL_STATUS_TO_BACKEND: Record<FinalStatus, string[]> = {
  validated:    ['VALIDE'],
  blocked:      ['REJETE'],
  escalated:    ['ATTENTE_VALIDATION'],
  under_review: ['ATTENTE_VALIDATION'],
};

async function persistDossierStatus(dossierId: string, finalStatus: FinalStatus, token: string): Promise<void> {
  const transitions = FINAL_STATUS_TO_BACKEND[finalStatus];
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  for (const status of transitions) {
    const res = await fetch(`${API_BASE}/dossiers/${dossierId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || `Échec mise à jour statut ${status}`);
    }
  }
}


export default function ValidationFinalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params as RouteParams) || {};
  const { token } = useAuth();
  const [terminating, setTerminating] = useState(false);

  const reportInput = useMemo(() => buildReportPayload(params), [params]);
  const status = params.finalStatus || 'validated';
  const statusMeta = STATUS_META[status];

  const verificationResults = reportInput.verificationResults;
  const recherches = reportInput.recherches;
  const validationDecisions = reportInput.validation?.decisions ?? [];
  const dossier = reportInput.dossier;

  const alertCount = verificationResults.filter((item) => item.status === 'alert' && !item.overriddenByUser).length;
  const warningCount = verificationResults.filter((item) => item.status === 'warning' && !item.overriddenByUser).length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <AppHeader
        title="Clôture du dossier"
        subtitle="Compte rendu final de conformité"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: statusMeta.bg, borderColor: statusMeta.color + '35' }]}>
          <View style={[styles.heroIcon, { backgroundColor: statusMeta.color + '20' }]}>
            <MaterialIcons name={statusMeta.icon as any} size={28} color={statusMeta.color} />
          </View>
          <View style={styles.heroBody}>
            <Text style={[styles.heroTitle, { color: statusMeta.color }]}>{statusMeta.title}</Text>
            <Text style={styles.heroSubtitle}>{statusMeta.subtitle}</Text>
            <Text style={styles.heroMeta}>Décision finale : {reportInput.scoring.decision} · Score {reportInput.scoring.scoreFinal}/100</Text>
          </View>
        </View>

        <SectionCard title="Synthèse exécutive">
          <SummaryRow label="Dossier" value={reportInput.dossierId} />
          <SummaryRow label="Client" value={`${reportInput.identity.prenom} ${reportInput.identity.nom}`.trim() || 'Non renseigné'} />
          <SummaryRow label="Nationalité" value={reportInput.identity.nationalite || 'Non renseignée'} />
          <SummaryRow label="Montant" value={dossier.montant ? `${dossier.montant} €` : 'Non renseigné'} />
          <SummaryRow label="Moyen de paiement" value={dossier?.moyenPaiement?.type || 'Non renseigné'} />
          <SummaryRow label="Seuil LCB-FT" value={dossier?.seuilLCBFT || 'Non déterminé'} />
        </SectionCard>

        <View style={styles.statsRow}>
          <StatCard label="Résultats scrappés" value={String(verificationResults.length)} accent={colors.primary} />
          <StatCard label="Recherches lancées" value={String(recherches.length)} accent={colors.accent} />
          <StatCard label="Alertes" value={String(alertCount)} accent={alertCount > 0 ? colors.error : colors.textTertiary} />
          <StatCard label="Avertissements" value={String(warningCount)} accent={warningCount > 0 ? colors.warning : colors.textTertiary} />
        </View>

        <SectionCard title="Retour des vérifications et sources scrappées">
          {verificationResults.length === 0 ? (
            <Text style={styles.emptyText}>Aucun retour détaillé disponible pour les sources scrappées.</Text>
          ) : verificationResults.map((result) => (
            <View key={result.id} style={styles.resultRow}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>{result.sourceLabel}</Text>
                <Text style={styles.resultStatus}>{result.overriddenByUser ? 'Faux positif validé' : result.status}</Text>
              </View>
              <Text style={styles.resultSummary}>{result.summary}</Text>
              <Text style={styles.resultDetails}>{result.details}</Text>
              {!!result.url && <Text style={styles.resultUrl}>{result.url}</Text>}
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Recherches complémentaires effectuées">
          {recherches.length === 0 ? (
            <Text style={styles.emptyText}>Aucune recherche complémentaire n’a été remontée dans ce flux.</Text>
          ) : recherches.map((recherche) => (
            <View key={recherche.id} style={styles.resultRow}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>{RECHERCHE_LABELS[recherche.type] || recherche.type}</Text>
                <Text style={styles.resultStatus}>{recherche.status}</Text>
              </View>
              <Text style={styles.resultSummary}>Source : {recherche.source || 'Non précisée'} · Confiance : {Math.round((recherche.confidence || 0) * 100)}%</Text>
              <Text style={styles.resultDetails}>{formatStructuredResult(recherche.result)}</Text>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Arbitrages et validations humaines">
          {validationDecisions.length === 0 ? (
            <Text style={styles.emptyText}>Aucun arbitrage manuel n’était requis pour ce dossier.</Text>
          ) : validationDecisions.map((entry) => (
            <View key={entry.exceptionId} style={styles.decisionRow}>
              <Text style={styles.decisionTitle}>{entry.description}</Text>
              <Text style={styles.decisionMeta}>{entry.decisionLabel}</Text>
              <Text style={styles.decisionText}>{entry.justification || 'Sans justification transmise.'}</Text>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Conclusion dossier">
          <Text style={styles.conclusionText}>{reportInput.validation?.summary ?? 'Dossier traité automatiquement.'}</Text>
          <Text style={styles.conclusionMeta}>Le compte rendu PDF regroupera l’ensemble des recherches exécutées, les retours récupérés et scrappés, ainsi que les décisions humaines prises sur le dossier.</Text>
        </SectionCard>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, styles.fullWidthBtn, terminating && styles.disabledBtn]}
          onPress={() => {
            if (terminating) return;
            const dossierId = params.dossierId;
            if (!dossierId || !token) {
              Alert.alert('Erreur', 'Dossier ou session invalide');
              return;
            }

            setTerminating(true);

            // Mise à jour du statut en arrière-plan (non bloquante)
            persistDossierStatus(dossierId, status, token)
              .catch(err => console.warn('Statut dossier:', err?.message));

            // Génération du PDF en arrière-plan (non bloquante)
            genererPdfServeur(dossierId, token)
              .then(result =>
                telechargerPdfArchive(
                  dossierId,
                  result.archiveId,
                  `rapport-lcbft-${dossierId}.pdf`,
                  token
                )
              )
              .catch(err => console.warn('PDF background:', err?.message));

            // Navigation immédiate vers la page d'accueil
            navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
          }}
          activeOpacity={0.85}
        >
          <MaterialIcons name="done-all" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Terminer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatStructuredResult(value: unknown): string {
  if (value == null) return 'Aucun détail structuré retourné.';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Aucun élément retourné.';
    return value.slice(0, 5).map((item) => formatStructuredResult(item)).join(' · ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 8)
      .map(([key, entry]) => `${key}: ${formatStructuredResult(entry)}`)
      .join(' · ');
  }
  return 'Format de retour non exploitable.';
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: 120 },
  heroCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBody: { flex: 1 },
  heroTitle: { ...typography.h3, marginBottom: 4 },
  heroSubtitle: { ...typography.body2, color: colors.textSecondary, marginBottom: 8 },
  heroMeta: { fontSize: 12, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  summaryLabel: { fontSize: 13, color: colors.textSecondary },
  summaryValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { marginTop: 2, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' },
  resultRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  resultTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  resultStatus: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
  resultSummary: { fontSize: 12, color: colors.textPrimary, marginBottom: 4, lineHeight: 18 },
  resultDetails: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  resultUrl: { marginTop: 4, fontSize: 11, color: colors.accent },
  decisionRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  decisionTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  decisionMeta: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 4 },
  decisionText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  conclusionText: { fontSize: 14, color: colors.textPrimary, lineHeight: 22, marginBottom: 8 },
  conclusionMeta: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  emptyText: { fontSize: 13, color: colors.textTertiary, lineHeight: 18 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fullWidthBtn: { width: '100%', alignSelf: 'stretch' },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  disabledBtn: { opacity: 0.6 },
});
