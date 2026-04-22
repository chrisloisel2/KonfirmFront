import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { ScoringResult, DecisionType } from '../../shared/types';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';
import { generateShareAndArchive } from '../../shared/services/pdfReportService';
import { useAuth } from '../../shared/services/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationStatus = 'clear' | 'alert' | 'warning' | 'pending' | 'error';
type Category = 'document' | 'sanctions' | 'pep' | 'reputation' | 'judicial';

interface VerificationResult {
  id: string;
  sourceLabel: string;
  category: Category;
  status: VerificationStatus;
  summary: string;
  details: string;
  confidence: number;
  matches?: any[];
  checkedAt: string;
  overriddenByUser?: boolean;
}

interface RouteParams {
  dossierId?: string;
  dossierData?: any;
  recherches?: any[];
}

// ─── Country risk table ───────────────────────────────────────────────────────

const COUNTRY_RISK_MAP: Array<{ keys: string[]; score: number; label: string; detail: string }> = [
  { keys: ['iranien', 'iranienne', 'iran'],           score: 95, label: 'Critique', detail: 'Sanctions GAFI — pays sous embargo total' },
  { keys: ['nord-coréen', 'coréen du nord'],          score: 95, label: 'Critique', detail: 'Sanctions ONU — embargo total' },
  { keys: ['syrien', 'syrienne'],                     score: 90, label: 'Critique', detail: 'Embargo UE/ONU — conflit actif' },
  { keys: ['russe', 'russien'],                       score: 80, label: 'Élevé',   detail: 'Sanctions internationales depuis 2022' },
  { keys: ['biélorusse'],                             score: 78, label: 'Élevé',   detail: 'Sanctions UE depuis 2020' },
  { keys: ['afghane', 'afghan'],                      score: 72, label: 'Élevé',   detail: 'Risque terrorisme — GAFI liste noire' },
  { keys: ['birman', 'birmane', 'myanmar'],           score: 70, label: 'Élevé',   detail: 'Sanctions post-coup 2021' },
  { keys: ['vénézuélien', 'venezuel'],                score: 65, label: 'Élevé',   detail: 'GAFI liste grise — instabilité politique' },
  { keys: ['pakistanais', 'pakistanaise'],            score: 62, label: 'Élevé',   detail: 'GAFI liste grise — financement terrorisme' },
  { keys: ['nigérian', 'nigériane'],                  score: 55, label: 'Modéré',  detail: 'GAFI surveillance — fraude en ligne' },
  { keys: ['libyen', 'libyenne'],                     score: 72, label: 'Élevé',   detail: 'Conflit actif — sanctions ONU' },
  { keys: ['somalien', 'somalienne'],                 score: 75, label: 'Élevé',   detail: 'Piraterie — GAFI liste noire' },
  { keys: ['yéménite'],                               score: 73, label: 'Élevé',   detail: 'Conflit armé — embargo partiel' },
  { keys: ['chinois', 'chinoise'],                    score: 40, label: 'Modéré',  detail: 'Pays à surveiller — risque contournement' },
  { keys: ['émirati', 'émirat'],                      score: 45, label: 'Modéré',  detail: 'Plateforme offshore — GAFI surveillance' },
  { keys: ['saoudien', 'saoudienne'],                 score: 42, label: 'Modéré',  detail: 'Surveillance GAFI — financement' },
  { keys: ['marocain', 'marocaine'],                  score: 22, label: 'Faible',  detail: 'Pays partenaire — risque standard' },
  { keys: ['algérien', 'algérienne'],                 score: 22, label: 'Faible',  detail: 'Pays partenaire — risque standard' },
  { keys: ['tunisien', 'tunisienne'],                 score: 20, label: 'Faible',  detail: 'Pays partenaire — risque standard' },
  { keys: ['français', 'française', 'francais'],      score: 5,  label: 'Très faible', detail: 'UE — pays de confiance' },
  { keys: ['allemand', 'allemande'],                  score: 5,  label: 'Très faible', detail: 'UE — pays de confiance' },
  { keys: ['italien', 'italienne'],                   score: 5,  label: 'Très faible', detail: 'UE — pays de confiance' },
  { keys: ['espagnol', 'espagnole'],                  score: 5,  label: 'Très faible', detail: 'UE — pays de confiance' },
  { keys: ['belge'],                                  score: 5,  label: 'Très faible', detail: 'UE — pays de confiance' },
  { keys: ['américain', 'américaine'],                score: 8,  label: 'Très faible', detail: 'Allié — accords FATF' },
  { keys: ['britannique', 'britan'],                  score: 5,  label: 'Très faible', detail: 'Allié — accords FATF' },
];

function getCountryRisk(nationalite: string) {
  const n = (nationalite ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nNorm = nationalite.toLowerCase();
  for (const entry of COUNTRY_RISK_MAP) {
    if (entry.keys.some(k => nNorm.includes(k) || n.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
      return entry;
    }
  }
  return { score: 15, label: 'Faible', detail: 'Nationalité non répertoriée — risque standard' };
}

// ─── Score computation ────────────────────────────────────────────────────────

function computeScores(results: VerificationResult[], nationalite: string) {
  const active = (cat: Category | Category[]) => {
    const cats = Array.isArray(cat) ? cat : [cat];
    return results.filter(r => cats.includes(r.category) && !r.overriddenByUser);
  };

  // PPE
  const pepR = active('pep');
  const scorePPE = pepR.some(r => r.status === 'alert')
    ? 100 : pepR.some(r => r.status === 'warning') ? 55 : 0;

  // Signaux (sanctions + judicial / Interpol)
  const sigR = active(['sanctions', 'judicial']);
  const isGel    = sigR.some(r => r.status === 'alert' && /gel|ofac|avoirs/.test(r.sourceLabel.toLowerCase()));
  const hasAlert = sigR.some(r => r.status === 'alert');
  const hasWarn  = sigR.some(r => r.status === 'warning');
  const scoreSignaux = isGel ? 100 : hasAlert ? 85 : hasWarn ? 50 : 0;

  // Pays
  const countryRisk = getCountryRisk(nationalite);
  const scorePays = countryRisk.score;

  // Réputation (web + company intel)
  const repR = active('reputation');
  const hasRepAlert = repR.some(r => r.status === 'alert');
  const hasRepWarn  = repR.some(r => r.status === 'warning');
  const scoreReputation = hasRepAlert ? 80 : hasRepWarn ? 38 : 0;

  const scoreFinal = Math.round(
    scorePPE * 0.40 +
    scoreSignaux * 0.30 +
    scorePays * 0.20 +
    scoreReputation * 0.10
  );

  return { scorePPE, scoreSignaux, scorePays, scoreReputation, scoreFinal, countryRisk };
}

function decide(scores: ReturnType<typeof computeScores>): DecisionType {
  if (scores.scoreSignaux === 100) return 'blocage';
  if (scores.scorePPE === 100)    return 'escalade';
  if (scores.scoreFinal >= 75)    return 'examen_renforce';
  if (scores.scoreFinal >= 45)    return 'vigilance_renforcee';
  return 'auto_validated';
}

function buildJustification(scores: ReturnType<typeof computeScores>, results: VerificationResult[]): string {
  const lines: string[] = [];
  if (scores.scorePPE === 100)       lines.push('PPE identifiée');
  else if (scores.scorePPE > 0)      lines.push('Possible PPE — à vérifier');
  if (scores.scoreSignaux === 100)   lines.push('Gel d\'avoirs ou OFAC');
  else if (scores.scoreSignaux >= 85) lines.push('Liste de sanctions');
  else if (scores.scoreSignaux >= 50) lines.push('Signal judiciaire');
  if (scores.scorePays >= 70)        lines.push(`Pays à risque critique (${scores.countryRisk.label})`);
  else if (scores.scorePays >= 40)   lines.push(`Pays à risque modéré`);
  if (scores.scoreReputation >= 60)  lines.push('Presse négative / company intel');
  const alertCount = results.filter(r => r.status === 'alert' && !r.overriddenByUser).length;
  const warnCount  = results.filter(r => r.status === 'warning' && !r.overriddenByUser).length;
  if (lines.length === 0 && alertCount === 0 && warnCount === 0) return 'Aucun élément de risque significatif détecté.';
  if (alertCount > 0 || warnCount > 0) {
    lines.push(`${alertCount} alerte(s), ${warnCount} avertissement(s) sur ${results.length} sources`);
  }
  return lines.join(' · ');
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const DECISION_META: Record<DecisionType, { label: string; color: string; bg: string; icon: string; description: string }> = {
  auto_validated:      { label: 'Validé automatiquement', color: colors.success, bg: colors.successLight, icon: 'check-circle',  description: 'Aucun élément de risque significatif. L\'opération peut être traitée.' },
  vigilance_renforcee: { label: 'Vigilance renforcée',    color: colors.warning, bg: colors.warningLight, icon: 'visibility',    description: 'Des éléments nécessitent une attention particulière avant de poursuivre.' },
  examen_renforce:     { label: 'Examen renforcé',        color: '#D97706',      bg: '#FFF7ED',           icon: 'search',        description: 'Un examen approfondi du dossier est requis avant toute validation.' },
  escalade:            { label: 'Escalade nécessaire',    color: '#7C3AED',      bg: '#F5F3FF',           icon: 'call-made',     description: 'Le dossier doit être transmis au référent LCB-FT sans délai.' },
  blocage:             { label: 'Blocage immédiat',       color: colors.error,   bg: colors.errorLight,   icon: 'block',         description: 'L\'opération doit être bloquée immédiatement. Mesure conservatoire requise.' },
};

const STATUS_META: Record<VerificationStatus, { color: string; bg: string; icon: string; label: string }> = {
  clear:   { color: colors.success,      bg: colors.successLight, icon: 'check-circle',   label: 'Conforme' },
  warning: { color: colors.warning,      bg: colors.warningLight, icon: 'warning',         label: 'Attention' },
  alert:   { color: colors.error,        bg: colors.errorLight,   icon: 'error',           label: 'Alerte' },
  pending: { color: colors.info,         bg: colors.infoLight,    icon: 'hourglass-empty', label: 'En cours' },
  error:   { color: colors.textTertiary, bg: colors.borderLight,  icon: 'cloud-off',       label: 'N/A' },
};

function scoreColor(v: number) {
  if (v >= 70) return colors.error;
  if (v >= 40) return colors.warning;
  return colors.success;
}

// ─── SubScore card ────────────────────────────────────────────────────────────

function SubScoreCard({
  icon, title, score, sources, expanded, onToggle, note,
}: {
  icon: string; title: string; score: number;
  sources?: VerificationResult[];
  note?: string;
  expanded: boolean; onToggle: () => void;
}) {
  const color = scoreColor(score);
  const hasContent = (sources && sources.length > 0) || note;
  const alertCount = sources?.filter(r => r.status === 'alert').length ?? 0;
  const warnCount  = sources?.filter(r => r.status === 'warning').length ?? 0;

  return (
    <View style={[ssStyles.card, { borderLeftColor: color }]}>
      <TouchableOpacity
        style={ssStyles.header}
        onPress={hasContent ? onToggle : undefined}
        activeOpacity={hasContent ? 0.7 : 1}
      >
        <View style={[ssStyles.iconWrap, { backgroundColor: color + '18' }]}>
          <MaterialIcons name={icon as any} size={18} color={color} />
        </View>
        <View style={ssStyles.titleArea}>
          <View style={ssStyles.titleRow}>
            <Text style={ssStyles.title}>{title}</Text>
            {alertCount > 0 && (
              <View style={ssStyles.alertBadge}>
                <Text style={ssStyles.alertBadgeText}>{alertCount} alerte{alertCount > 1 ? 's' : ''}</Text>
              </View>
            )}
            {alertCount === 0 && warnCount > 0 && (
              <View style={[ssStyles.alertBadge, { backgroundColor: colors.warningLight }]}>
                <Text style={[ssStyles.alertBadgeText, { color: colors.warning }]}>{warnCount} avert.</Text>
              </View>
            )}
          </View>
          <View style={ssStyles.barRow}>
            <View style={ssStyles.barTrack}>
              <View style={[ssStyles.barFill, { width: `${score}%`, backgroundColor: color }]} />
            </View>
          </View>
        </View>
        <View style={ssStyles.scoreBox}>
          <Text style={[ssStyles.scoreNum, { color }]}>{score}</Text>
          <Text style={ssStyles.scoreMax}>/100</Text>
        </View>
        {hasContent && (
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={18} color={colors.textTertiary}
            style={{ marginLeft: 4 }}
          />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={ssStyles.body}>
          {note && (
            <View style={ssStyles.noteRow}>
              <MaterialIcons name="public" size={13} color={colors.textSecondary} />
              <Text style={ssStyles.noteText}>{note}</Text>
            </View>
          )}
          {sources?.map(r => {
            const sm = STATUS_META[r.overriddenByUser ? 'clear' : r.status];
            return (
              <View key={r.id} style={ssStyles.sourceRow}>
                <View style={[ssStyles.sourceStatus, { backgroundColor: sm.bg }]}>
                  <MaterialIcons name={sm.icon as any} size={11} color={sm.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ssStyles.sourceLabel}>{r.sourceLabel}</Text>
                  <Text style={[ssStyles.sourceSummary, { color: r.overriddenByUser ? colors.textTertiary : sm.color }]}>
                    {r.summary}
                  </Text>
                </View>
                <View style={[ssStyles.statusPill, { backgroundColor: sm.bg }]}>
                  <Text style={[ssStyles.statusPillText, { color: sm.color }]}>{sm.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ssStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    overflow: 'hidden',
    ...shadows.sm,
  },
  header:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  iconWrap:  { width: 38, height: 38, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  titleArea: { flex: 1 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  title:     { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  alertBadge: { backgroundColor: colors.errorLight, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  alertBadgeText: { fontSize: 9, fontWeight: '800', color: colors.error },
  barRow:    { flexDirection: 'row', alignItems: 'center' },
  barTrack:  { flex: 1, height: 5, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: 5, borderRadius: 3 },
  scoreBox:  { flexDirection: 'row', alignItems: 'baseline', marginLeft: 8 },
  scoreNum:  { fontSize: 20, fontWeight: '800' },
  scoreMax:  { fontSize: 11, color: colors.textTertiary, marginLeft: 1 },

  body: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  noteRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
  noteText:      { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  sourceRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sourceStatus:  { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  sourceLabel:   { fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginBottom: 1 },
  sourceSummary: { fontSize: 11, lineHeight: 14 },
  statusPill:    { borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  statusPillText:{ fontSize: 9, fontWeight: '800' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ScoringScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { token }  = useAuth();
  const { dossierId, dossierData, recherches = [] } = (route.params as RouteParams) || {};

  const [scoring, setScoring]         = useState<ScoringResult | null>(null);
  const [calculating, setCalculating]  = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const scoreAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: 1, duration: 2200, useNativeDriver: false }).start();
    run();
  }, []);

  const run = async () => {
    await new Promise(r => setTimeout(r, 2200));
    const verResults: VerificationResult[] = dossierData?.identity?.verificationResults ?? [];
    const nationalite: string = dossierData?.identity?.nationalite ?? '';

    const scores   = computeScores(verResults, nationalite);
    const decision = decide(scores);
    const justification = buildJustification(scores, verResults);

    const result: ScoringResult = {
      id: `scoring-${dossierId ?? Date.now()}`,
      dossierId: dossierId ?? dossierData?.id ?? '',
      scorePPE:        scores.scorePPE,
      scorePays:       scores.scorePays,
      scoreReputation: scores.scoreReputation,
      scoreSignaux:    scores.scoreSignaux,
      scoreFinal:      scores.scoreFinal,
      decision,
      justification,
      calculatedAt:    new Date(),
    };
    setScoring(result);
    setCalculating(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1,                  duration: 500, useNativeDriver: true }),
      Animated.timing(scoreAnim, { toValue: scores.scoreFinal,  duration: 1000, useNativeDriver: false }),
    ]).start();
  };

  const proceed = () => {
    if (!scoring) return;
    const payload = {
      scoring,
      dossierId: scoring.dossierId,
      dossierData,
      recherches,
      finalStatus: scoring.decision === 'auto_validated' ? 'validated' : 'under_review',
    };
    const dest = scoring.decision === 'auto_validated' ? 'ValidationFinale' : 'ExceptionHandling';
    // @ts-ignore
    navigation.navigate(dest, payload);
  };

  const toggle = (key: string) => setExpandedCard(prev => prev === key ? null : key);

  const [pdfLoading, setPdfLoading] = useState(false);

  const exportPDF = async () => {
    if (!scoring) return;
    setPdfLoading(true);
    try {
      const verResults: VerificationResult[] = dossierData?.identity?.verificationResults ?? [];
      const identity = dossierData?.identity ?? {};
      const result = await generateShareAndArchive({
        dossierId: scoring.dossierId,
        finalStatus: scoring.decision === 'auto_validated' ? 'validated'
          : scoring.decision === 'blocage' ? 'blocked'
          : scoring.decision === 'escalade' ? 'escalated'
          : 'under_review',
        identity: {
          nom:            identity.nom ?? 'Non renseigné',
          prenom:         identity.prenom ?? '',
          dateNaissance:  identity.dateNaissance,
          nationalite:    identity.nationalite,
          numeroDocument: identity.numeroDocument,
          dateExpiration: identity.dateExpiration,
          docType:        identity.docType,
        },
        dossier: {
          type:          dossierData?.type,
          clientType:    dossierData?.clientType,
          montant:       dossierData?.montant,
          seuilLCBFT:    dossierData?.seuilLCBFT,
          moyenPaiement: dossierData?.moyenPaiement,
          intermediaire: dossierData?.intermediaire,
        },
        verificationResults: verResults,
        recherches:          recherches ?? [],
        scoring,
        authToken: token ?? undefined,
      });
      if (result.archived) {
        Alert.alert(
          'PDF archivé',
          'Le rapport a été scellé, horodaté et déposé dans le stockage sécurisé LCB-FT.',
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de générer le rapport');
    } finally {
      setPdfLoading(false);
    }
  };

  const goToArchives = () => {
    const numeroDossier = dossierData?.numero ?? dossierId ?? '';
    const clientNom = dossierData?.identity
      ? `${dossierData.identity.nom ?? ''} ${dossierData.identity.prenom ?? ''}`.trim()
      : undefined;
    // @ts-ignore
    navigation.navigate('Archivage', {
      dossierId: scoring?.dossierId ?? dossierId,
      numeroDossier,
      clientNom
    });
  };

  /* ── Loading ── */
  if (calculating) {
    const steps = ['Récupération des résultats…', 'Analyse PPE & sanctions…', 'Évaluation risque pays…', 'Calcul du score final…'];
    return (
      <View style={styles.loadingRoot}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
        <View style={styles.loadingCard}>
          <View style={styles.analysisIcon}>
            <MaterialIcons name="analytics" size={36} color={colors.accent} />
          </View>
          <Text style={styles.loadingTitle}>Analyse LCB-FT</Text>
          <Text style={styles.loadingSubtitle}>Calcul du score de risque global</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
            }]} />
          </View>
          <View style={styles.stepList}>
            {steps.map((s, i) => (
              <View key={i} style={styles.stepRow}>
                <MaterialIcons name="check" size={13} color={colors.success} />
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (!scoring) return null;

  const verResults: VerificationResult[] = dossierData?.identity?.verificationResults ?? [];
  const nationalite: string = dossierData?.identity?.nationalite ?? 'Inconnue';
  const scores = computeScores(verResults, nationalite);
  const meta   = DECISION_META[scoring.decision];

  const sourceCount  = verResults.length;
  const alertCount   = verResults.filter(r => r.status === 'alert'   && !r.overriddenByUser).length;
  const warnCount    = verResults.filter(r => r.status === 'warning' && !r.overriddenByUser).length;
  const overrideCount = verResults.filter(r => r.overriddenByUser).length;

  const pepSources     = verResults.filter(r => r.category === 'pep');
  const signalSources  = verResults.filter(r => r.category === 'sanctions' || r.category === 'judicial');
  const repSources     = verResults.filter(r => r.category === 'reputation');

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <AppHeader
        title="Score de risque"
        subtitle="Analyse LCB-FT globale"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Score global card ── */}
        <View style={styles.gaugeCard}>
          <Text style={styles.gaugeLabel}>SCORE DE RISQUE GLOBAL</Text>

          <View style={styles.gaugeCircle}>
            <Animated.Text style={[styles.gaugeValue, { color: scoreColor(scoring.scoreFinal) }]}>
              {scoreAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0', String(scoring.scoreFinal)],
              }) as any}
            </Animated.Text>
            <Text style={styles.gaugeMax}>/100</Text>
          </View>

          {/* Gradient bar */}
          <View style={styles.gradientBarWrap}>
            <View style={styles.gradientBar} />
            <View style={[styles.gaugeMarker, { left: `${scoring.scoreFinal}%` as any }]}>
              <View style={[styles.markerLine, { backgroundColor: scoreColor(scoring.scoreFinal) }]} />
              <View style={[styles.markerDot, { backgroundColor: scoreColor(scoring.scoreFinal) }]} />
            </View>
          </View>
          <View style={styles.gaugeScale}>
            <Text style={[styles.scaleText, { color: colors.success }]}>Faible</Text>
            <Text style={[styles.scaleText, { color: colors.warning }]}>Modéré</Text>
            <Text style={[styles.scaleText, { color: colors.error }]}>Élevé</Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{sourceCount}</Text>
              <Text style={styles.statLabel}>sources</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: alertCount > 0 ? colors.error : colors.textTertiary }]}>{alertCount}</Text>
              <Text style={styles.statLabel}>alerte{alertCount !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: warnCount > 0 ? colors.warning : colors.textTertiary }]}>{warnCount}</Text>
              <Text style={styles.statLabel}>avert.</Text>
            </View>
            {overrideCount > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: colors.textTertiary }]}>{overrideCount}</Text>
                  <Text style={styles.statLabel}>ignoré{overrideCount !== 1 ? 's' : ''}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Decision banner ── */}
        <View style={[styles.decisionBanner, { backgroundColor: meta.bg, borderColor: meta.color + '35' }]}>
          <View style={[styles.decisionIcon, { backgroundColor: meta.color + '20' }]}>
            <MaterialIcons name={meta.icon as any} size={26} color={meta.color} />
          </View>
          <View style={styles.decisionText}>
            <Text style={[styles.decisionLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.decisionDesc}>{meta.description}</Text>
          </View>
        </View>

        {/* ── Section: détail par critère ── */}
        <Text style={styles.sectionHeader}>DÉTAIL PAR CRITÈRE</Text>

        {/* PPE */}
        <SubScoreCard
          icon="person"
          title="Personne Politiquement Exposée (PPE)"
          score={scores.scorePPE}
          sources={pepSources}
          expanded={expandedCard === 'ppe'}
          onToggle={() => toggle('ppe')}
        />

        {/* Signaux d'alerte */}
        <SubScoreCard
          icon="warning"
          title="Signaux d'alerte"
          score={scores.scoreSignaux}
          sources={signalSources}
          expanded={expandedCard === 'signaux'}
          onToggle={() => toggle('signaux')}
        />

        {/* Risque pays */}
        <SubScoreCard
          icon="public"
          title="Risque pays"
          score={scores.scorePays}
          note={`${nationalite} — ${scores.countryRisk.label} · ${scores.countryRisk.detail}`}
          expanded={expandedCard === 'pays'}
          onToggle={() => toggle('pays')}
        />

        {/* Réputation */}
        <SubScoreCard
          icon="article"
          title="Réputation & exposition publique"
          score={scores.scoreReputation}
          sources={repSources}
          expanded={expandedCard === 'rep'}
          onToggle={() => toggle('rep')}
        />

        {/* ── Justification ── */}
        <View style={styles.justifCard}>
          <View style={styles.justifHeader}>
            <MaterialIcons name="notes" size={15} color={colors.textSecondary} />
            <Text style={styles.justifTitle}>Justification du score</Text>
          </View>
          <Text style={styles.justifText}>{scoring.justification}</Text>
          <View style={styles.justifFooter}>
            <MaterialIcons name="schedule" size={12} color={colors.textTertiary} />
            <Text style={styles.justifTime}>
              {scoring.calculatedAt.toLocaleDateString('fr-FR')} à {scoring.calculatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* ── Footer CTA ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={exportPDF}
          activeOpacity={0.75}
          disabled={pdfLoading}
        >
          <MaterialIcons name={pdfLoading ? 'hourglass-empty' : 'picture-as-pdf'} size={17} color={colors.textSecondary} />
          <Text style={styles.pdfBtnText}>{pdfLoading ? 'Génération…' : 'Rapport PDF'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.archivesBtn}
          onPress={goToArchives}
          activeOpacity={0.75}
        >
          <MaterialIcons name="workspace-premium" size={17} color={colors.accent} />
          <Text style={styles.archivesBtnText}>Archives</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: meta.color }]}
          onPress={proceed}
          activeOpacity={0.85}
        >
          <MaterialIcons name={meta.icon as any} size={17} color="#fff" />
          <Text style={styles.ctaText}>
            {scoring.decision === 'auto_validated' ? 'Finaliser' : 'Traiter l\'exception'}
          </Text>
          <MaterialIcons name="arrow-forward" size={17} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  loadingRoot:     { flex: 1, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  loadingCard:     { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, width: '100%', alignItems: 'center', ...shadows.lg },
  analysisIcon:    { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  loadingTitle:    { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  loadingSubtitle: { ...typography.body2, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
  progressTrack:   { width: '100%', height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.md },
  progressFill:    { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
  stepList:        { width: '100%', gap: 6 },
  stepRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText:        { fontSize: 13, color: colors.textSecondary },

  scroll: { padding: spacing.md, paddingBottom: 110 },

  // Gauge card
  gaugeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: 10,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  gaugeLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: colors.textTertiary, marginBottom: spacing.md },
  gaugeCircle: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.md },
  gaugeValue:  { fontSize: 64, fontWeight: '800', lineHeight: 70 },
  gaugeMax:    { fontSize: 22, color: colors.textTertiary, marginLeft: 6, fontWeight: '600' },

  gradientBarWrap: { width: '100%', height: 12, borderRadius: 6, overflow: 'visible', position: 'relative', marginBottom: 6 },
  gradientBar: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 6,
    backgroundColor: colors.borderLight,
    // Gradient from green → yellow → red represented by overlapping views
  },
  gaugeMarker:  { position: 'absolute', top: -3, alignItems: 'center', transform: [{ translateX: -6 }] },
  markerDot:    { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff', marginTop: -1 },
  markerLine:   { width: 2, height: 18, borderRadius: 1, position: 'absolute', top: -6 },
  gaugeScale:   { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 6, marginBottom: spacing.md },
  scaleText:    { fontSize: 10, fontWeight: '700' },

  statsRow:     { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12, gap: 0 },
  statItem:     { flex: 1, alignItems: 'center' },
  statNum:      { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statLabel:    { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: 1 },
  statDivider:  { width: 1, height: 28, backgroundColor: colors.borderLight },

  // Decision banner
  decisionBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.lg, padding: spacing.md,
    marginBottom: 16, borderWidth: 1, gap: 12,
  },
  decisionIcon:  { width: 50, height: 50, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  decisionText:  { flex: 1 },
  decisionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  decisionDesc:  { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  sectionHeader: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
    color: colors.textTertiary, marginBottom: 10, paddingLeft: 2,
  },

  // Justification
  justifCard:   { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: 4, ...shadows.sm, borderWidth: 1, borderColor: colors.borderLight },
  justifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  justifTitle:  { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  justifText:   { fontSize: 14, color: colors.textPrimary, lineHeight: 22, marginBottom: 10 },
  justifFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  justifTime:   { fontSize: 11, color: colors.textTertiary },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.md, gap: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    ...shadows.lg,
  },
  pdfBtn: {
    height: 42, borderRadius: radius.md,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  pdfBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  archivesBtn: {
    height: 52, borderRadius: radius.md,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[3],
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: colors.accent,
  },
  archivesBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  ctaBtn: {
    height: 52, borderRadius: radius.md,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    ...shadows.sm,
  },
  ctaText: { ...typography.button, color: '#fff', fontSize: 14 },
});
