import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput as RNInput, StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../shared/services/AuthContext';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import { API_BASE } from '../../shared/config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationStatus = 'clear' | 'alert' | 'warning' | 'pending' | 'error';
type Category = 'document' | 'sanctions' | 'pep' | 'reputation' | 'judicial';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface VerificationResult {
  id: string;
  sourceLabel: string;
  category: Category;
  status: VerificationStatus;
  summary: string;
  details: string;
  confidence: number;
  url?: string;
  matches?: any[];
  checkedAt: string;
  overriddenByUser?: boolean;
}

interface IdentityData {
  nom: string;
  prenom: string;
  dateNaissance: string;
  nationalite: string;
  numeroDocument: string;
  dateExpiration: string;
  sexe?: string;
  confidence?: number;
  source?: string;
}

interface RiskFactor {
  label: string;
  penalty: number;
  color: string;
  icon: string;
}

interface RouteParams {
  identityData: IdentityData | null;
  dossierData: any;
  docType: 'cni' | 'passeport';
  photoUri?: string;
  manualEntry?: boolean;
}

class AuthSessionError extends Error {
  constructor(message = 'Session expirée') {
    super(message);
    this.name = 'AuthSessionError';
  }
}

// ─── Risk Engine ──────────────────────────────────────────────────────────────

const CATEGORY_WEIGHTS: Record<Category, { alert: number; warning: number }> = {
  document:   { alert: 30, warning: 10 },
  sanctions:  { alert: 45, warning: 20 },
  judicial:   { alert: 40, warning: 15 },
  pep:        { alert: 20, warning: 12 },
  reputation: { alert: 15, warning:  8 },
};

function computeRisk(results: VerificationResult[]): {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
} {
  let penalty = 0;
  const factors: RiskFactor[] = [];

  for (const r of results) {
    if (r.overriddenByUser || r.status === 'clear' || r.status === 'error' || r.status === 'pending') continue;
    const w = CATEGORY_WEIGHTS[r.category];
    const p = r.status === 'alert' ? w.alert : w.warning;
    penalty += p;
    factors.push({
      label: r.sourceLabel,
      penalty: p,
      color: r.status === 'alert' ? colors.error : colors.warning,
      icon: r.status === 'alert' ? 'error' : 'warning',
    });
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  const level: RiskLevel =
    score >= 85 ? 'low' :
    score >= 65 ? 'medium' :
    score >= 40 ? 'high' : 'critical';

  return { score, level, factors };
}

const RISK_META: Record<RiskLevel, { label: string; sub: string; color: string; bg: string; btnColor: string; icon: string }> = {
  low:      { label: 'Faible risque',    sub: 'Aucun élément préoccupant',          color: colors.success, bg: colors.successLight, btnColor: colors.success, icon: 'verified' },
  medium:   { label: 'Risque modéré',    sub: 'Des éléments méritent attention',    color: colors.warning, bg: colors.warningLight, btnColor: colors.warning, icon: 'warning' },
  high:     { label: 'Risque élevé',     sub: 'Vérifications approfondies requises', color: '#D97706',      bg: '#FFF7ED',           btnColor: '#D97706',     icon: 'priority-high' },
  critical: { label: 'Risque critique',  sub: 'Blocage ou escalade recommandé',     color: colors.error,   bg: colors.errorLight,   btnColor: colors.error,   icon: 'block' },
};

const STATUS_META: Record<VerificationStatus, { color: string; bg: string; icon: string; label: string }> = {
  clear:   { color: colors.success,      bg: colors.successLight, icon: 'check-circle',    label: 'Conforme' },
  warning: { color: colors.warning,      bg: colors.warningLight, icon: 'warning',          label: 'Attention' },
  alert:   { color: colors.error,        bg: colors.errorLight,   icon: 'error',            label: 'Alerte' },
  pending: { color: colors.info,         bg: colors.infoLight,    icon: 'hourglass-empty',  label: 'En cours' },
  error:   { color: colors.textTertiary, bg: colors.borderLight,  icon: 'cloud-off',        label: 'Indisponible' },
};

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  document:   { label: 'Document',    icon: 'badge' },
  sanctions:  { label: 'Sanctions',   icon: 'gavel' },
  pep:        { label: 'PPE',         icon: 'person' },
  reputation: { label: 'Réputation',  icon: 'language' },
  judicial:   { label: 'Judiciaire',  icon: 'security' },
};

const LOADING_SOURCES = [
  'Validité du document',
  'OpenSanctions (PPE + sanctions)',
  'Liste OFAC — Trésor US',
  'Notices rouges Interpol',
  'Personnalité politique Wikipedia',
  'Réputation web DuckDuckGo',
  'Sanctions financières UE',
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function IdentityVerificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { token, logout } = useAuth();
  const { identityData, dossierData, docType, photoUri, manualEntry } = (route.params as RouteParams) || {};

  const [identity, setIdentity] = useState<IdentityData>({
    nom:            identityData?.nom ?? '',
    prenom:         identityData?.prenom ?? '',
    dateNaissance:  identityData?.dateNaissance ?? '',
    nationalite:    identityData?.nationalite ?? '',
    numeroDocument: identityData?.numeroDocument ?? '',
    dateExpiration: identityData?.dateExpiration ?? '',
  });

  const [verifying, setVerifying]   = useState(false);
  const [results, setResults]       = useState<VerificationResult[]>([]);
  const [verified, setVerified]     = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [editField, setEditField]   = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [tab, setTab]               = useState<'results' | 'identity'>(!identityData?.nom ? 'identity' : 'results');

  const scoreAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (identityData?.nom) runVerification(identity);
  }, []);

  const runVerification = async (idData: IdentityData) => {
    if (!idData.nom || !idData.prenom) return;
    if (!token) {
      await logout();
      // @ts-ignore
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    setVerifying(true);
    setResults([]);
    setVerified(false);
    scoreAnim.setValue(0);
    fadeAnim.setValue(0);
    try {
      const res = await fetch(`${API_BASE}/verification/identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...idData, docType, dossierId: dossierData?.id }),
      });
      const json = await res.json();

      if (res.status === 401 || res.status === 403) {
        throw new AuthSessionError(json?.message || json?.error || 'Session expirée');
      }

      if (json.success) {
        setResults(json.data.results);
        setVerified(true);
        const { score } = computeRisk(json.data.results);
        Animated.parallel([
          Animated.timing(scoreAnim, { toValue: score, duration: 1200, useNativeDriver: false }),
          Animated.timing(fadeAnim,  { toValue: 1,     duration: 600,  useNativeDriver: true }),
        ]).start();
      }
    } catch (err) {
      if (err instanceof AuthSessionError) {
        await logout();
        // @ts-ignore
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }
      console.error('Verification error', err);
    } finally {
      setVerifying(false);
    }
  };

  const toggleOverride = (id: string) =>
    setResults(prev => prev.map(r => r.id === id ? { ...r, overriddenByUser: !r.overriddenByUser } : r));

  const { score, level, factors } = computeRisk(results);
  const riskMeta = RISK_META[level];
  const canProceed = verified && !!identity.nom && !!identity.prenom;

  const onValidate = async () => {
    let persistedDossier = dossierData;

    if (dossierData?.id && token) {
      setIsPersisting(true);

      try {
        const res = await fetch(`${API_BASE}/dossiers/${dossierData.id}/identity`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            docType,
            client: {
              nom: identity.nom.trim(),
              prenom: identity.prenom.trim(),
              dateNaissance: identity.dateNaissance.trim(),
              nationalite: identity.nationalite.trim(),
              numeroIdentite: identity.numeroDocument.trim(),
              typeIdentite: docType === 'cni' ? 'CNI' : 'PASSEPORT',
              dateExpiration: identity.dateExpiration.trim(),
            },
          }),
        });
        const json = await res.json().catch(() => null);

        if (res.status === 401 || res.status === 403) {
          throw new AuthSessionError(json?.message || json?.error || 'Session expirée');
        }

        if (!res.ok || !json?.success || !json.data?.dossier?.id) {
          throw new Error(json?.message || json?.error || 'Enregistrement du dossier impossible');
        }

        persistedDossier = {
          ...dossierData,
          id: json.data.dossier.id,
          numero: json.data.dossier.numero,
          status: json.data.dossier.status,
          clientId: json.data.dossier.client?.id,
        };
      } catch (err) {
        if (err instanceof AuthSessionError) {
          await logout();
          // @ts-ignore
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          return;
        }

        console.error('Erreur de persistance du dossier', err);
        Alert.alert('Enregistrement impossible', 'Le dossier n’a pas pu être mis à jour en base.');
        return;
      } finally {
        setIsPersisting(false);
      }
    }

    const payload = { ...persistedDossier, identity: { ...identity, verificationResults: results, riskScore: score, riskLevel: level } };
    // @ts-ignore
    navigation.navigate('Scoring', { dossierData: payload });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Vérification d'identité</Text>
          <Text style={styles.headerSub}>
            {manualEntry ? 'Saisie manuelle' : docType === 'cni' ? 'Carte nationale d\'identité' : 'Passeport'}
          </Text>
        </View>
        {identityData?.source && (
          <View style={styles.sourceBadge}>
            <MaterialIcons name="auto-awesome" size={11} color={colors.accent} />
            <Text style={styles.sourceBadgeText}>{identityData.source.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'results' && styles.tabActive]} onPress={() => setTab('results')}>
          <MaterialIcons name="security" size={15} color={tab === 'results' ? colors.primary : colors.textTertiary} />
          <Text style={[styles.tabText, tab === 'results' && styles.tabTextActive]}>Résultats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'identity' && styles.tabActive]} onPress={() => setTab('identity')}>
          <MaterialIcons name="badge" size={15} color={tab === 'identity' ? colors.primary : colors.textTertiary} />
          <Text style={[styles.tabText, tab === 'identity' && styles.tabTextActive]}>Identité</Text>
          {!identityData?.nom && <View style={styles.tabDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {tab === 'results' ? (
          <>
            {/* Score gauge */}
            {verified ? (
              <Animated.View style={[styles.scoreCard, { opacity: fadeAnim }]}>
                <View style={styles.scoreLeft}>
                  <Animated.Text style={[styles.scoreNumber, { color: riskMeta.color }]}>
                    {scoreAnim.interpolate({ inputRange: [0, 100], outputRange: ['0', String(Math.round(score))] }) as any}
                  </Animated.Text>
                  <Text style={styles.scoreLabel}>/100</Text>
                </View>
                <View style={styles.scoreRight}>
                  <View style={[styles.riskPill, { backgroundColor: riskMeta.bg }]}>
                    <MaterialIcons name={riskMeta.icon as any} size={14} color={riskMeta.color} />
                    <Text style={[styles.riskPillText, { color: riskMeta.color }]}>{riskMeta.label}</Text>
                  </View>
                  <Text style={styles.scoreSub}>{riskMeta.sub}</Text>
                  {/* Score bar */}
                  <View style={styles.scoreBarWrap}>
                    <View style={[styles.scoreBarFill, { width: `${score}%` as any, backgroundColor: riskMeta.color }]} />
                  </View>
                  {/* Category dots */}
                  <CategorySummary results={results} />
                </View>
              </Animated.View>
            ) : verifying ? (
              <View style={styles.scoreCardLoading}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.loadingTitle}>Analyse en cours…</Text>
                <Text style={styles.loadingSub}>Vérification auprès de {LOADING_SOURCES.length} sources</Text>
              </View>
            ) : (
              <View style={styles.scoreCardEmpty}>
                <MaterialIcons name="shield" size={40} color={colors.borderLight} />
                <Text style={styles.emptyTitle}>Vérification non lancée</Text>
                <Text style={styles.emptySub}>Renseignez l'identité puis lancez la vérification</Text>
              </View>
            )}

            {/* Risk factors */}
            {verified && factors.length > 0 && (
              <View style={styles.factorsCard}>
                <Text style={styles.factorsTitle}>Facteurs de risque identifiés</Text>
                {factors.map((f, i) => (
                  <View key={i} style={styles.factorRow}>
                    <MaterialIcons name={f.icon as any} size={14} color={f.color} />
                    <Text style={styles.factorLabel}>{f.label}</Text>
                    <View style={[styles.penaltyPill, { backgroundColor: f.color + '18' }]}>
                      <Text style={[styles.penaltyText, { color: f.color }]}>−{f.penalty} pts</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Loading placeholders */}
            {verifying && (
              <View style={styles.resultsCard}>
                <Text style={styles.sectionTitle}>Sources en cours de consultation</Text>
                {LOADING_SOURCES.map((label, i) => (
                  <View key={i} style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.accent} style={{ width: 20 }} />
                    <Text style={styles.loadingRowLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Results by source */}
            {results.length > 0 && (
              <View style={styles.resultsCard}>
                <Text style={styles.sectionTitle}>Détail par source ({results.length})</Text>
                {results.map(result => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    expanded={expanded === result.id}
                    onToggle={() => setExpanded(expanded === result.id ? null : result.id)}
                    onOverride={() => toggleOverride(result.id)}
                  />
                ))}
              </View>
            )}

            {/* Re-verify button */}
            {verified && (
              <TouchableOpacity
                style={styles.reVerifyBtn}
                onPress={() => runVerification(identity)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="refresh" size={16} color={colors.textSecondary} />
                <Text style={styles.reVerifyText}>Relancer la vérification</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          /* Identity tab */
          <>
            {/* OCR quality banner */}
            {identityData?.confidence !== undefined && (
              <View style={[styles.ocrBanner, {
                backgroundColor: identityData.confidence > 0.85 ? colors.successLight : colors.warningLight,
                borderColor: (identityData.confidence > 0.85 ? colors.success : colors.warning) + '40',
              }]}>
                <MaterialIcons
                  name={identityData.confidence > 0.85 ? 'auto-awesome' : 'warning'}
                  size={15}
                  color={identityData.confidence > 0.85 ? colors.success : colors.warning}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ocrBannerTitle, { color: identityData.confidence > 0.85 ? colors.success : colors.warning }]}>
                    Extraction OCR — {Math.round(identityData.confidence * 100)}% de confiance
                  </Text>
                  <Text style={styles.ocrBannerSub}>
                    {identityData.confidence < 0.85
                      ? 'Vérifiez chaque champ avant de continuer'
                      : 'Données extraites automatiquement depuis la pièce d\'identité'}
                  </Text>
                </View>
              </View>
            )}
            {!identityData?.nom && (
              <View style={[styles.ocrBanner, {
                backgroundColor: manualEntry ? colors.infoLight : colors.errorLight,
                borderColor: (manualEntry ? colors.info : colors.error) + '30',
              }]}>
                <MaterialIcons
                  name={manualEntry ? 'edit' : 'error-outline'}
                  size={15}
                  color={manualEntry ? colors.info : colors.error}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ocrBannerTitle, { color: manualEntry ? colors.info : colors.error }]}>
                    {manualEntry ? 'Saisie manuelle' : 'Extraction échouée'}
                  </Text>
                  <Text style={styles.ocrBannerSub}>
                    {manualEntry
                      ? 'Renseignez les données d\'identité puis lancez la vérification'
                      : 'Saisissez les données manuellement'}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.identityCard}>
              <Text style={styles.sectionTitle}>Données d'identité</Text>
              <Text style={styles.fieldHint}>Appuyez sur un champ pour le corriger</Text>
              <View style={styles.fieldsGrid}>
                {([
                  { key: 'nom',            label: 'Nom de famille',    placeholder: 'NOM' },
                  { key: 'prenom',         label: 'Prénom(s)',          placeholder: 'Prénom' },
                  { key: 'dateNaissance',  label: 'Date de naissance', placeholder: 'JJ/MM/AAAA' },
                  { key: 'nationalite',    label: 'Nationalité',       placeholder: 'ex: Française' },
                  { key: 'numeroDocument', label: 'N° de document',    placeholder: 'Numéro' },
                  { key: 'dateExpiration', label: 'Expiration',        placeholder: 'JJ/MM/AAAA' },
                ] as const).map(f => (
                  <IdentityField
                    key={f.key}
                    label={f.label}
                    value={(identity as any)[f.key] ?? ''}
                    placeholder={f.placeholder}
                    isEditing={editField === f.key}
                    onEdit={() => setEditField(f.key)}
                    onChange={v => setIdentity(p => ({ ...p, [f.key]: v }))}
                    onBlur={() => setEditField(null)}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.launchBtn, (verifying || !identity.nom || !identity.prenom) && { opacity: 0.5 }]}
              onPress={() => { runVerification(identity); setTab('results'); }}
              disabled={verifying || !identity.nom || !identity.prenom}
              activeOpacity={0.85}
            >
              {verifying
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialIcons name="search" size={18} color="#fff" />
              }
              <Text style={styles.launchBtnText}>
                {verifying ? 'Vérification en cours…' : verified ? 'Relancer la vérification' : 'Lancer la vérification'}
              </Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.validateBtn, { backgroundColor: canProceed ? riskMeta.btnColor : colors.primary }, (!canProceed || isPersisting) && styles.validateDisabled]}
          onPress={onValidate}
          disabled={!canProceed || isPersisting}
          activeOpacity={0.85}
        >
          <MaterialIcons name={isPersisting ? 'hourglass-empty' : verified ? riskMeta.icon as any : 'lock'} size={16} color="#fff" />
          <Text style={styles.validateText}>
            {isPersisting ? 'Enregistrement du dossier…' :
             !verified ? 'Lancer la vérification d\'abord' :
             level === 'critical' ? 'Continuer (risque critique)' :
             level === 'high'     ? 'Continuer avec alertes' :
             'Valider et continuer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── CategorySummary ──────────────────────────────────────────────────────────

function CategorySummary({ results }: { results: VerificationResult[] }) {
  const categories: Category[] = ['document', 'sanctions', 'judicial', 'pep', 'reputation'];
  return (
    <View style={catStyles.row}>
      {categories.map(cat => {
        const catResults = results.filter(r => r.category === cat && !r.overriddenByUser);
        const worst = catResults.find(r => r.status === 'alert') ?? catResults.find(r => r.status === 'warning') ?? catResults[0];
        const status = worst?.status ?? 'clear';
        const meta = STATUS_META[status === 'error' || status === 'pending' ? 'clear' : status];
        return (
          <View key={cat} style={catStyles.item}>
            <View style={[catStyles.dot, { backgroundColor: meta.bg, borderColor: meta.color }]}>
              <MaterialIcons name={CATEGORY_META[cat].icon as any} size={10} color={meta.color} />
            </View>
            <Text style={catStyles.label}>{CATEGORY_META[cat].label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const catStyles = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  item:  { alignItems: 'center', gap: 3 },
  dot:   { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  label: { fontSize: 9, fontWeight: '600', color: colors.textTertiary },
});

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({ result, expanded, onToggle, onOverride }: {
  result: VerificationResult;
  expanded: boolean;
  onToggle: () => void;
  onOverride: () => void;
}) {
  const effectiveStatus = result.overriddenByUser ? 'clear' : result.status;
  const meta = STATUS_META[effectiveStatus];
  const catMeta = CATEGORY_META[result.category];
  const isActionable = result.status === 'alert' || result.status === 'warning';

  return (
    <View style={rcStyles.wrap}>
      <TouchableOpacity style={rcStyles.header} onPress={onToggle} activeOpacity={0.75}>
        {/* Category icon */}
        <View style={[rcStyles.catIcon, { backgroundColor: meta.bg }]}>
          <MaterialIcons name={catMeta.icon as any} size={16} color={meta.color} />
        </View>
        {/* Labels */}
        <View style={{ flex: 1 }}>
          <View style={rcStyles.sourceLine}>
            <Text style={rcStyles.sourceLabel}>{result.sourceLabel}</Text>
            {result.overriddenByUser && (
              <View style={rcStyles.fpBadge}>
                <Text style={rcStyles.fpText}>Faux positif</Text>
              </View>
            )}
          </View>
          <Text style={[rcStyles.summary, { color: result.overriddenByUser ? colors.textTertiary : meta.color }]}>
            {result.summary}
          </Text>
        </View>
        {/* Status pill + chevron */}
        <View style={[rcStyles.pill, { backgroundColor: meta.bg }]}>
          <MaterialIcons name={meta.icon as any} size={11} color={meta.color} />
          <Text style={[rcStyles.pillText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={[rcStyles.body, { borderLeftColor: meta.color }]}>
          <Text style={rcStyles.details}>{result.details}</Text>
          {result.url && (
            <View style={rcStyles.urlRow}>
              <MaterialIcons name="open-in-new" size={11} color={colors.accent} />
              <Text style={rcStyles.url}>{result.url}</Text>
            </View>
          )}
          {result.matches && result.matches.length > 0 && !result.overriddenByUser && (
            <View style={rcStyles.matchesWrap}>
              <Text style={rcStyles.matchesTitle}>{result.matches.length} correspondance(s)</Text>
            </View>
          )}
          {isActionable && (
            <TouchableOpacity
              style={[rcStyles.overrideBtn, result.overriddenByUser && rcStyles.overrideBtnDone]}
              onPress={onOverride}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={result.overriddenByUser ? 'undo' : 'flag'}
                size={13}
                color={result.overriddenByUser ? colors.textSecondary : '#fff'}
              />
              <Text style={[rcStyles.overrideBtnText, result.overriddenByUser && { color: colors.textSecondary }]}>
                {result.overriddenByUser ? 'Annuler — remettre l\'alerte' : 'Marquer comme faux positif'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const rcStyles = StyleSheet.create({
  wrap:       { borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: 8, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  catIcon:    { width: 34, height: 34, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  sourceLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  sourceLabel:{ fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  fpBadge:    { backgroundColor: colors.borderLight, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  fpText:     { fontSize: 9, fontWeight: '700', color: colors.textTertiary },
  summary:    { fontSize: 11, lineHeight: 15 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 3 },
  pillText:   { fontSize: 9, fontWeight: '800' },
  body:       { borderLeftWidth: 3, marginLeft: 12, paddingLeft: 12, paddingRight: 12, paddingBottom: 12, backgroundColor: colors.surfaceAlt },
  details:    { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  urlRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  url:        { fontSize: 11, color: colors.accent, flex: 1 },
  matchesWrap:{ marginTop: 6, backgroundColor: colors.errorLight, borderRadius: radius.sm, padding: 6 },
  matchesTitle:{ fontSize: 11, color: colors.error, fontWeight: '600' },
  overrideBtn:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, padding: 9, borderRadius: radius.md, backgroundColor: colors.warning, alignSelf: 'flex-start' },
  overrideBtnDone: { backgroundColor: colors.borderLight },
  overrideBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

// ─── IdentityField ────────────────────────────────────────────────────────────

function IdentityField({ label, value, placeholder, isEditing, onEdit, onChange, onBlur }: {
  label: string; value: string; placeholder: string;
  isEditing: boolean; onEdit: () => void;
  onChange: (v: string) => void; onBlur: () => void;
}) {
  return (
    <View style={fStyles.wrap}>
      <Text style={fStyles.label}>{label}</Text>
      {isEditing ? (
        <RNInput
          style={fStyles.input}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          autoFocus
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
        />
      ) : (
        <TouchableOpacity style={[fStyles.row, !value && fStyles.rowEmpty]} onPress={onEdit} activeOpacity={0.7}>
          <Text style={[fStyles.value, !value && fStyles.valueEmpty]}>{value || placeholder}</Text>
          <MaterialIcons name="edit" size={13} color={value ? colors.textTertiary : colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrap:       { marginBottom: 8 },
  label:      { fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight },
  rowEmpty:   { borderColor: colors.error + '60', backgroundColor: colors.errorLight },
  value:      { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  valueEmpty: { fontSize: 13, color: colors.error, fontWeight: '400', fontStyle: 'italic' },
  input:      { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.accentLight, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.accent, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 52, paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  backBtn:        { padding: 4 },
  headerTitle:    { ...typography.h3, color: '#fff' },
  headerSub:      { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  sourceBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  sourceBadgeText:{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  tabs: {
    flexDirection: 'row', backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, marginRight: 6, position: 'relative' },
  tabActive:    { backgroundColor: 'rgba(255,255,255,0.18)' },
  tabText:      { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabTextActive:{ color: '#fff' },
  tabDot:       { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.error },

  scroll: { padding: spacing.md, paddingBottom: 110 },

  // Score card
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: 12, ...shadows.sm,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  scoreCardLoading: {
    alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, marginBottom: 12, ...shadows.sm,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  scoreCardEmpty: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, marginBottom: 12,
    borderWidth: 1, borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  scoreLeft:    { alignItems: 'center', minWidth: 70 },
  scoreNumber:  { fontSize: 52, fontWeight: '800', lineHeight: 56 },
  scoreLabel:   { fontSize: 13, color: colors.textTertiary, fontWeight: '600', marginTop: -4 },
  scoreRight:   { flex: 1 },
  riskPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
  riskPillText: { fontSize: 12, fontWeight: '700' },
  scoreSub:     { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  scoreBarWrap: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: 6, borderRadius: 3 },
  loadingTitle: { ...typography.h4, color: colors.textPrimary },
  loadingSub:   { fontSize: 12, color: colors.textSecondary },
  emptyTitle:   { ...typography.h4, color: colors.textTertiary },
  emptySub:     { fontSize: 12, color: colors.textTertiary, textAlign: 'center' },

  // Risk factors
  factorsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: 12, ...shadows.sm,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  factorsTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  factorRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  factorLabel:  { flex: 1, fontSize: 12, color: colors.textSecondary },
  penaltyPill:  { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  penaltyText:  { fontSize: 11, fontWeight: '700' },

  // Loading sources
  resultsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: 12, ...shadows.sm,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  loadingRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  loadingRowLabel: { fontSize: 13, color: colors.textSecondary },

  reVerifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 12, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  reVerifyText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // Identity tab
  ocrBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: radius.lg, borderWidth: 1, marginBottom: 10,
  },
  ocrBannerTitle: { fontSize: 13, fontWeight: '700', marginBottom: 1 },
  ocrBannerSub:   { fontSize: 12, color: colors.textSecondary },

  identityCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: 12, ...shadows.sm,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  fieldHint:  { fontSize: 11, color: colors.textTertiary, fontStyle: 'italic', marginBottom: spacing.sm },
  fieldsGrid: {},

  launchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14,
    marginBottom: 12, ...shadows.sm,
  },
  launchBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, padding: spacing.md,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    ...shadows.lg,
  },
  cancelBtn:       { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText:      { ...typography.button, color: colors.textSecondary },
  validateBtn:     { flex: 2, height: 50, borderRadius: radius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, ...shadows.sm },
  validateDisabled:{ opacity: 0.45 },
  validateText:    { fontSize: 13, fontWeight: '700', color: '#fff' },
});
