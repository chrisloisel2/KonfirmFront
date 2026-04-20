import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, StatusBar } from 'react-native';
import { Text, Card, Button, ProgressBar, Chip, List } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Recherche, RechercheType, RechercheStatus } from '../../shared/types';
import { colors, spacing } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';

// Écran 16 selon rules.md: Hub recherches (automatique) avec statuts

interface RouteParams {
  dossierId: string;
  documentData?: any;
}

interface SearchProgress {
  total: number;
  completed: number;
  failed: number;
}

export default function ResearchHubScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { dossierId, documentData } = (route.params as RouteParams) || {};

  const [recherches, setRecherches] = useState<Recherche[]>([]);
  const [progress, setProgress] = useState<SearchProgress>({ total: 0, completed: 0, failed: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [allCompleted, setAllCompleted] = useState(false);

  useEffect(() => {
    initiateSearches();
  }, []);

  const initiateSearches = async () => {
    // Définir les recherches à effectuer selon le type de client et montant
    const searchTypes: RechercheType[] = [
      'ppe',
      'sanctions',
      'gel_avoirs',
      'pays_liste',
      'reputation'
    ];

    // Ajouter beneficiaires_effectifs si personne morale
    if (documentData?.clientType === 'moral') {
      searchTypes.push('beneficiaires_effectifs');
    }

    // Initialiser les recherches
    const initialSearches: Recherche[] = searchTypes.map(type => ({
      id: `${dossierId}-${type}`,
      dossierId,
      type,
      status: 'pending',
      result: null,
      confidence: 0,
      executedAt: new Date(),
      source: '',
    }));

    setRecherches(initialSearches);
    setProgress({ total: searchTypes.length, completed: 0, failed: 0 });

    // Lancer les recherches en parallèle
    executeSearches(initialSearches);
  };

  const executeSearches = async (searches: Recherche[]) => {
    const promises = searches.map(search => executeSearch(search));

    try {
      await Promise.allSettled(promises);
      setAllCompleted(true);
    } catch (error) {
      console.error('Erreur lors des recherches:', error);
    }
  };

  const executeSearch = async (search: Recherche): Promise<void> => {
    try {
      // Simulation des différents types de recherche
      await simulateSearch(search);

      // Mettre à jour le statut
      setRecherches(prev => prev.map(r =>
        r.id === search.id ? { ...search, status: 'success' } : r
      ));

      setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));

    } catch (error) {
      console.error(`Erreur recherche ${search.type}:`, error);

      setRecherches(prev => prev.map(r =>
        r.id === search.id ? { ...r, status: 'failed' } : r
      ));

      setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
    }
  };

  const simulateSearch = async (search: Recherche): Promise<void> => {
    // Simulations des différents types de recherche
    const delay = Math.random() * 3000 + 1000; // 1-4 secondes
    await new Promise(resolve => setTimeout(resolve, delay));

    switch (search.type) {
      case 'ppe':
        search.result = {
          isPPE: Math.random() < 0.1, // 10% chance d'être PPE
          matches: [],
          sources: ['World-Check', 'PEP Database']
        };
        search.confidence = 0.95;
        search.source = 'World-Check API';
        break;

      case 'sanctions':
        search.result = {
          isListed: Math.random() < 0.05, // 5% chance d'être sanctionné
          lists: [],
          sources: ['OFAC', 'EU', 'UN']
        };
        search.confidence = 0.98;
        search.source = 'Sanctions API';
        break;

      case 'gel_avoirs':
        search.result = {
          isFrozen: Math.random() < 0.02, // 2% chance de gel
          matches: [],
          source: 'TRACFIN'
        };
        search.confidence = 0.99;
        search.source = 'TRACFIN API';
        break;

      case 'pays_liste':
        search.result = {
          isListed: Math.random() < 0.15, // 15% chance pays à risque
          riskLevel: Math.random() < 0.1 ? 'high' : 'medium',
          lists: ['FATF Grey List', 'EU High-Risk']
        };
        search.confidence = 1.0;
        search.source = 'FATF Database';
        break;

      case 'reputation':
        search.result = {
          score: Math.random() * 100,
          articles: Math.floor(Math.random() * 5),
          sentiment: Math.random() < 0.8 ? 'neutral' : 'negative'
        };
        search.confidence = 0.85;
        search.source = 'News API';
        break;

      case 'beneficiaires_effectifs':
        search.result = {
          identified: Math.random() < 0.9, // 90% chance d'identification
          beneficiaires: [],
          source: 'RCS/INPI'
        };
        search.confidence = 0.92;
        search.source = 'RCS API';
        break;
    }

    search.executedAt = new Date();
  };

  const getSearchIcon = (type: RechercheType): string => {
    const icons: Record<RechercheType, string> = {
      ppe: 'account-star',
      sanctions: 'shield-alert',
      gel_avoirs: 'lock',
      pays_liste: 'flag',
      reputation: 'newspaper',
      beneficiaires_effectifs: 'account-group',
    };
    return icons[type];
  };

  const getSearchLabel = (type: RechercheType): string => {
    const labels: Record<RechercheType, string> = {
      ppe: 'Personnes Politiquement Exposées',
      sanctions: 'Listes de sanctions',
      gel_avoirs: 'Gel des avoirs',
      pays_liste: 'Pays listés',
      reputation: 'Recherche réputation',
      beneficiaires_effectifs: 'Bénéficiaires effectifs',
    };
    return labels[type];
  };

  const getStatusColor = (status: RechercheStatus): string => {
    const map: Record<RechercheStatus, string> = {
      pending: colors.textTertiary,
      success: colors.success,
      failed: colors.error,
      escalated: '#7C3AED',
    };
    return map[status];
  };

  const getStatusIcon = (status: RechercheStatus): string => {
    const icons: Record<RechercheStatus, string> = {
      pending: 'clock',
      success: 'check-circle',
      failed: 'error',
      escalated: 'alert-circle',
    };
    return icons[status];
  };

  const handleSearchDetail = (recherche: Recherche) => {
    // Navigation vers détail de la recherche
    // @ts-ignore - Navigation typée
    navigation.navigate('SearchDetail', { recherche });
  };

  const handleRetryFailedSearches = async () => {
    const failedSearches = recherches.filter(r => r.status === 'failed');

    if (failedSearches.length === 0) return;

    setRefreshing(true);
    setProgress(prev => ({ ...prev, failed: 0 }));

    for (const search of failedSearches) {
      try {
        await executeSearch(search);
      } catch (error) {
        console.error('Erreur retry:', error);
      }
    }

    setRefreshing(false);
  };

  const handleContinue = () => {
    // Navigation vers scoring ou gestion d'exceptions
    const hasAlerts = recherches.some(r =>
      r.status === 'success' && (
        (r.type === 'ppe' && r.result?.isPPE) ||
        (r.type === 'sanctions' && r.result?.isListed) ||
        (r.type === 'gel_avoirs' && r.result?.isFrozen)
      )
    );

    if (hasAlerts) {
      // @ts-ignore - Navigation typée
      navigation.navigate('Exceptions', { recherches, dossierId, dossierData: documentData });
    } else {
      // @ts-ignore - Navigation typée
      navigation.navigate('Scoring', { recherches, dossierId, dossierData: documentData });
    }
  };

  const progressPercentage = progress.total > 0 ?
    (progress.completed + progress.failed) / progress.total : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <AppHeader
        title="Recherches automatiques"
        subtitle={`Dossier #${dossierId}`}
        onBack={() => navigation.goBack()}
      >
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={progressPercentage}
            color="rgba(255,255,255,0.9)"
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            {progress.completed + progress.failed} / {progress.total} terminées
          </Text>
        </View>
      </AppHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRetryFailedSearches}
          />
        }
      >
        {/* Liste des recherches */}
        {recherches.map((recherche) => (
          <Card key={recherche.id} style={styles.searchCard}>
            <List.Item
              title={getSearchLabel(recherche.type)}
              description={
                recherche.status === 'pending' ? 'Recherche en cours...' :
                recherche.status === 'success' ? `Terminé (${recherche.source})` :
                recherche.status === 'failed' ? 'Erreur - Appuyez pour réessayer' :
                'Escaladé'
              }
              left={(props) => (
                <View style={styles.iconContainer}>
                  <MaterialIcons
                    name={getSearchIcon(recherche.type) as any}
                    size={24}
                    color={colors.primary}
                  />
                </View>
              )}
              right={(props) => (
                <Chip
                  mode="outlined"
                  textStyle={{ fontSize: 10 }}
                  style={[styles.statusChip, { borderColor: getStatusColor(recherche.status) }]}
                  icon={() => (
                    <MaterialIcons
                      name={getStatusIcon(recherche.status) as any}
                      size={14}
                      color={getStatusColor(recherche.status)}
                    />
                  )}
                >
                  {recherche.status === 'pending' ? 'En cours' :
                   recherche.status === 'success' ? 'OK' :
                   recherche.status === 'failed' ? 'Erreur' : 'Escaladé'}
                </Chip>
              )}
              onPress={() =>
                recherche.status !== 'pending' && handleSearchDetail(recherche)
              }
            />
          </Card>
        ))}

        {/* Résumé des alertes */}
        {allCompleted && (
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text style={styles.summaryTitle}>Résumé des recherches</Text>

              {recherches
                .filter(r => r.status === 'success' && (
                  (r.type === 'ppe' && r.result?.isPPE) ||
                  (r.type === 'sanctions' && r.result?.isListed) ||
                  (r.type === 'gel_avoirs' && r.result?.isFrozen)
                ))
                .map(r => (
                  <View key={r.id} style={styles.alertItem}>
                    <MaterialIcons name="warning" size={20} color={colors.error} />
                    <Text style={styles.alertText}>
                      {r.type === 'ppe' && 'Personne Politiquement Exposée détectée'}
                      {r.type === 'sanctions' && 'Présence sur liste de sanctions'}
                      {r.type === 'gel_avoirs' && 'Gel d\'avoirs identifié'}
                    </Text>
                  </View>
                ))
              }

              {recherches.every(r =>
                r.status !== 'success' || !r.result || (
                  (r.type !== 'ppe' || !r.result.isPPE) &&
                  (r.type !== 'sanctions' || !r.result.isListed) &&
                  (r.type !== 'gel_avoirs' || !r.result.isFrozen)
                )
              ) && (
                <View style={styles.alertItem}>
                  <MaterialIcons name="check-circle" size={20} color={colors.success} />
                  <Text style={[styles.alertText, { color: colors.success }]}>
                    Aucune alerte majeure détectée
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Boutons d'action */}
      {allCompleted && (
        <View style={styles.footer}>
          {progress.failed > 0 && (
            <Button
              mode="outlined"
              onPress={handleRetryFailedSearches}
              style={styles.retryButton}
              loading={refreshing}
            >
              Relancer les échecs
            </Button>
          )}
          <Button
            mode="contained"
            onPress={handleContinue}
            style={styles.continueButton}
          >
            Continuer
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  progressBar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
    marginTop: 4,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  searchCard: {
    marginBottom: spacing.sm,
    elevation: 1,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginRight: spacing.sm,
  },
  statusChip: {
    height: 28,
    alignSelf: 'center',
  },
  summaryCard: {
    marginTop: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  alertText: {
    marginLeft: spacing.sm,
    fontSize: 14,
    flex: 1,
    color: colors.error,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
    elevation: 3,
    gap: spacing.md,
  },
  retryButton: {
    flex: 1,
  },
  continueButton: {
    flex: 1,
  },
});
