import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert,
} from 'react-native';
import { Text, Card, Chip, Button, TextInput, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../../shared/services/AuthContext';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

type ActiveTab = 'osint' | 'fuzzy';
type SubjectType = 'PERSON' | 'COMPANY' | 'MIXED';
type OsintMode = 'quick' | 'full';

const SUBJECT_TYPES: SubjectType[] = ['PERSON', 'COMPANY', 'MIXED'];
const OSINT_MODES: OsintMode[] = ['quick', 'full'];

export default function InvestigationToolsScreen() {
  const navigation = useNavigation();
  const { token } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<ActiveTab>('osint');

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [nationalite, setNationalite] = useState('');
  const [pays, setPays] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [siret, setSiret] = useState('');
  const [subjectType, setSubjectType] = useState<SubjectType>('PERSON');
  const [osintMode, setOsintMode] = useState<OsintMode>('quick');
  const [osintReport, setOsintReport] = useState<any>(null);
  const [osintLoading, setOsintLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [candidate, setCandidate] = useState('');
  const [threshold, setThreshold] = useState('0.72');
  const [fuzzyResult, setFuzzyResult] = useState<any>(null);
  const [fuzzyLoading, setFuzzyLoading] = useState(false);

  const runOsint = async () => {
    if (!token) {
      Alert.alert('Session expirée', 'Reconnectez-vous pour utiliser les outils.');
      return;
    }

    if (!nom.trim() && !entreprise.trim()) {
      Alert.alert('Données manquantes', 'Renseignez au minimum un nom ou une entreprise.');
      return;
    }

    setOsintLoading(true);
    setOsintReport(null);

    try {
      const resp = await fetch(`${API_BASE}/intelligence/osint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nom: nom.trim() || entreprise.trim(),
          prenom: prenom.trim() || undefined,
          dateNaissance: dateNaissance.trim() || undefined,
          nationalite: nationalite.trim() || undefined,
          pays: pays.trim() || undefined,
          entreprise: entreprise.trim() || undefined,
          siret: siret.trim() || undefined,
          type: subjectType,
          mode: osintMode,
          confidenceThreshold: 0.72,
        }),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error?.message || data?.message || 'Recherche OSINT impossible');
      }

      setOsintReport(data.data.report);
    } catch (error) {
      console.error('OSINT UI error', error);
      Alert.alert('Erreur', 'Impossible de lancer la recherche OSINT.');
    } finally {
      setOsintLoading(false);
    }
  };

  const runFuzzy = async () => {
    if (!token) {
      Alert.alert('Session expirée', 'Reconnectez-vous pour utiliser les outils.');
      return;
    }

    if (!query.trim() || !candidate.trim()) {
      Alert.alert('Données manquantes', 'Renseignez la requête et le candidat à comparer.');
      return;
    }

    const parsedThreshold = Number(threshold.replace(',', '.'));
    if (Number.isNaN(parsedThreshold) || parsedThreshold <= 0 || parsedThreshold > 1) {
      Alert.alert('Seuil invalide', 'Le seuil doit être compris entre 0 et 1.');
      return;
    }

    setFuzzyLoading(true);
    setFuzzyResult(null);

    try {
      const resp = await fetch(`${API_BASE}/intelligence/fuzzy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: query.trim(),
          candidate: candidate.trim(),
          threshold: parsedThreshold,
        }),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error?.message || data?.message || 'Comparaison fuzzy impossible');
      }

      setFuzzyResult(data.data.result);
    } catch (error) {
      console.error('Fuzzy UI error', error);
      Alert.alert('Erreur', 'Impossible de lancer la comparaison fuzzy.');
    } finally {
      setFuzzyLoading(false);
    }
  };

  const osintMatches = osintReport?.criticalMatches?.length
    ? osintReport.criticalMatches
    : osintReport?.highMatches?.length
      ? osintReport.highMatches
      : osintReport?.mediumMatches?.length
        ? osintReport.mediumMatches
        : osintReport?.lowMatches || [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <AppHeader
        title="Outils d'investigation"
        subtitle="OSINT direct + matching fuzzy"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.tabs}>
        <TabButton
          label="OSINT"
          icon="travel-explore"
          active={activeTab === 'osint'}
          onPress={() => setActiveTab('osint')}
        />
        <TabButton
          label="Fuzzy"
          icon="compare-arrows"
          active={activeTab === 'fuzzy'}
          onPress={() => setActiveTab('fuzzy')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {activeTab === 'osint' ? (
          <>
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Recherche OSINT</Text>
                <TextInput label="Nom ou entité" value={nom} onChangeText={setNom} mode="outlined" style={styles.input} dense />
                <TextInput label="Prénom" value={prenom} onChangeText={setPrenom} mode="outlined" style={styles.input} dense />
                <TextInput label="Entreprise" value={entreprise} onChangeText={setEntreprise} mode="outlined" style={styles.input} dense />
                <TextInput label="SIRET" value={siret} onChangeText={setSiret} mode="outlined" style={styles.input} dense />
                <TextInput label="Date de naissance" value={dateNaissance} onChangeText={setDateNaissance} mode="outlined" style={styles.input} dense />
                <View style={styles.row}>
                  <TextInput label="Nationalité" value={nationalite} onChangeText={setNationalite} mode="outlined" style={[styles.input, styles.half]} dense />
                  <TextInput label="Pays" value={pays} onChangeText={setPays} mode="outlined" style={[styles.input, styles.half]} dense />
                </View>

                <View style={styles.selectorGroup}>
                  <Text style={styles.selectorLabel}>Type de sujet</Text>
                  <View style={styles.chipRow}>
                    {SUBJECT_TYPES.map(type => (
                      <Chip
                        key={type}
                        selected={subjectType === type}
                        onPress={() => setSubjectType(type)}
                        style={subjectType === type ? styles.chipActive : styles.chip}
                      >
                        {type}
                      </Chip>
                    ))}
                  </View>
                </View>

                <View style={styles.selectorGroup}>
                  <Text style={styles.selectorLabel}>Mode</Text>
                  <View style={styles.chipRow}>
                    {OSINT_MODES.map(mode => (
                      <Chip
                        key={mode}
                        selected={osintMode === mode}
                        onPress={() => setOsintMode(mode)}
                        style={osintMode === mode ? styles.chipActive : styles.chip}
                      >
                        {mode === 'quick' ? 'Rapide' : 'Complet'}
                      </Chip>
                    ))}
                  </View>
                </View>

                <Button mode="contained" onPress={runOsint} style={styles.primaryBtn} icon="travel-explore" loading={osintLoading} disabled={osintLoading}>
                  Lancer l'OSINT
                </Button>
              </Card.Content>
            </Card>

            {osintLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Interrogation des sources OSINT…</Text>
              </View>
            )}

            {osintReport && (
              <>
                <Card style={styles.card}>
                  <Card.Content>
                    <View style={styles.resultHeader}>
                      <Text style={styles.sectionTitle}>Synthèse</Text>
                      <Chip style={styles.riskChip}>{osintReport.overallRisk}</Chip>
                    </View>
                    <View style={styles.metricsRow}>
                      <Metric label="Score" value={`${osintReport.riskScore}/100`} />
                      <Metric label="Matches" value={String(osintReport.totalMatches)} />
                      <Metric label="Sources" value={String(osintReport.sources?.length || 0)} />
                    </View>
                    <Text style={styles.summaryText}>{osintReport.summary}</Text>
                  </Card.Content>
                </Card>

                <Card style={styles.card}>
                  <Card.Content>
                    <Text style={styles.sectionTitle}>Sources interrogées</Text>
                    {(osintReport.sources || []).slice(0, 12).map((source: any) => (
                      <View key={source.id} style={styles.listRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listTitle}>{source.label}</Text>
                          <Text style={styles.listSub}>{source.category} · {source.durationMs} ms</Text>
                        </View>
                        <Chip compact style={styles.statusChip}>{source.status} · {source.matchCount}</Chip>
                      </View>
                    ))}
                  </Card.Content>
                </Card>

                <Card style={styles.card}>
                  <Card.Content>
                    <Text style={styles.sectionTitle}>Correspondances prioritaires</Text>
                    {osintMatches.length === 0 ? (
                      <Text style={styles.emptyText}>Aucune correspondance prioritaire.</Text>
                    ) : (
                      osintMatches.slice(0, 10).map((match: any) => (
                        <View key={match.id} style={styles.listRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>{match.name}</Text>
                            <Text style={styles.listSub}>{match.category} · {match.matchType}</Text>
                          </View>
                          <Chip compact style={styles.scoreChip}>{Math.round((match.matchScore || 0) * 100)}%</Chip>
                        </View>
                      ))
                    )}
                  </Card.Content>
                </Card>
              </>
            )}
          </>
        ) : (
          <>
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Comparaison fuzzy</Text>
                <TextInput label="Requête" value={query} onChangeText={setQuery} mode="outlined" style={styles.input} dense />
                <TextInput label="Candidat" value={candidate} onChangeText={setCandidate} mode="outlined" style={styles.input} dense />
                <TextInput label="Seuil (0-1)" value={threshold} onChangeText={setThreshold} mode="outlined" style={styles.input} dense keyboardType="numeric" />
                <Button mode="contained" onPress={runFuzzy} style={styles.primaryBtn} icon="compare-arrows" loading={fuzzyLoading} disabled={fuzzyLoading}>
                  Comparer
                </Button>
              </Card.Content>
            </Card>

            {fuzzyLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Calcul du score de rapprochement…</Text>
              </View>
            )}

            {fuzzyResult && (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.resultHeader}>
                    <Text style={styles.sectionTitle}>Résultat</Text>
                    <Chip style={fuzzyResult.isMatch ? styles.matchChip : styles.noMatchChip}>
                      {fuzzyResult.matchType}
                    </Chip>
                  </View>
                  <View style={styles.metricsRow}>
                    <Metric label="Score" value={`${Math.round((fuzzyResult.score || 0) * 100)}%`} />
                    <Metric label="Jaro-Winkler" value={`${Math.round((fuzzyResult.jaroWinkler || 0) * 100)}%`} />
                    <Metric label="Levenshtein" value={`${Math.round((fuzzyResult.levenshtein || 0) * 100)}%`} />
                  </View>
                  <View style={styles.metricsRow}>
                    <Metric label="N-gram" value={`${Math.round((fuzzyResult.ngramSimilarity || 0) * 100)}%`} />
                    <Metric label="Tokens" value={`${Math.round((fuzzyResult.nameTokenMatch || 0) * 100)}%`} />
                    <Metric label="Match" value={fuzzyResult.isMatch ? 'Oui' : 'Non'} />
                  </View>
                  <View style={styles.booleanRow}>
                    <Chip style={fuzzyResult.soundexMatch ? styles.matchChip : styles.noMatchChip}>Soundex {fuzzyResult.soundexMatch ? 'OK' : 'KO'}</Chip>
                    <Chip style={fuzzyResult.metaphoneMatch ? styles.matchChip : styles.noMatchChip}>Metaphone {fuzzyResult.metaphoneMatch ? 'OK' : 'KO'}</Chip>
                  </View>
                </Card.Content>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TabButton({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.8}>
      <MaterialIcons name={icon as any} size={16} color={active ? colors.primary : colors.textTertiary} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.borderLight,
  },
  tabActive: {
    backgroundColor: colors.accentLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  selectorGroup: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.accentLight,
  },
  primaryBtn: {
    marginTop: spacing.sm,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  riskChip: {
    backgroundColor: colors.warningLight,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metricCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryText: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  listSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusChip: {
    backgroundColor: colors.infoLight,
  },
  scoreChip: {
    backgroundColor: colors.successLight,
  },
  emptyText: {
    color: colors.textSecondary,
  },
  booleanRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  matchChip: {
    backgroundColor: colors.successLight,
  },
  noMatchChip: {
    backgroundColor: colors.errorLight,
  },
});
