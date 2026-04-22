import React, { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../../shared/services/AuthContext';
import {
  getArchivesDossier,
  verifierIntegrite,
  telechargerEtPartagerCertificat,
  telechargerPdfArchive,
  ArchivedPdfItem,
  IntegrityResult
} from '../../shared/services/archivageApiService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteParams {
  dossierId: string;
  numeroDossier: string;
  clientNom?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function frDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function isExpired(retentionExpiry: string): boolean {
  return new Date(retentionExpiry) < new Date();
}

function daysUntilExpiry(retentionExpiry: string): number {
  return Math.ceil((new Date(retentionExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function triggerLabel(status: string | null): string {
  if (!status) return 'Inconnu';
  if (status === 'VALIDE') return 'Validation';
  if (status === 'REJETE') return 'Rejet';
  if (status === 'ARCHIVE') return 'Archivage';
  if (status.startsWith('UPLOAD_')) return 'Upload manuel';
  if (status.startsWith('MANUEL_')) return 'Génération manuelle';
  return status;
}

// ─── Composant carte d'archive ────────────────────────────────────────────────

interface ArchiveCardProps {
  item: ArchivedPdfItem;
  dossierId: string;
  numeroDossier: string;
  token: string;
}

function ArchiveCard({ item, dossierId, numeroDossier, token }: ArchiveCardProps) {
  const [verifying, setVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const expired = isExpired(item.retentionExpiry);
  const days = daysUntilExpiry(item.retentionExpiry);

  const handleVerifier = async () => {
    setVerifying(true);
    try {
      const result = await verifierIntegrite(dossierId, item.id, token);
      setIntegrityResult(result);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Vérification impossible');
    } finally {
      setVerifying(false);
    }
  };

  const handleCertificat = async () => {
    setCertLoading(true);
    try {
      await telechargerEtPartagerCertificat(dossierId, item.id, numeroDossier, token);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Génération du certificat impossible');
    } finally {
      setCertLoading(false);
    }
  };

  const handlePdfArchive = async () => {
    setPdfLoading(true);
    try {
      await telechargerPdfArchive(dossierId, item.id, item.filename, token);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Téléchargement impossible');
    } finally {
      setPdfLoading(false);
    }
  };

  const integrityColor = integrityResult === null
    ? colors.textMuted
    : integrityResult.integrityValid ? '#166534' : '#B91C1C';

  const integrityIcon = integrityResult === null
    ? 'shield'
    : integrityResult.integrityValid ? 'verified-user' : 'gpp-bad';

  const integrityText = integrityResult === null
    ? 'Non vérifiée'
    : integrityResult.integrityValid ? 'Intégrité confirmée' : 'Anomalie détectée';

  return (
    <View style={styles.card}>
      {/* En-tête carte */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <MaterialIcons name="archive" size={18} color={colors.accent} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.originalFilename}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: expired ? '#FEE2E2' : '#DCFCE7' }]}>
          <Text style={[styles.badgeText, { color: expired ? '#B91C1C' : '#166534' }]}>
            {expired ? 'Expiré' : 'Actif'}
          </Text>
        </View>
      </View>

      {/* Méta */}
      <View style={styles.metaGrid}>
        <MetaRow icon="event" label="Archivé le" value={frDateTime(item.archivedAt)} />
        <MetaRow icon="play-circle-filled" label="Déclencheur" value={triggerLabel(item.triggerStatus)} />
        <MetaRow icon="description" label="Format" value={item.isPdfa ? 'PDF/A-2b' : 'PDF'} />
        <MetaRow icon="storage" label="Taille" value={formatBytes(item.fileSize)} />
        <MetaRow
          icon="lock-clock"
          label="Conservation jusqu'au"
          value={`${frDate(item.retentionExpiry)}${!expired ? ` (${days}j)` : ' — EXPIRÉ'}`}
          valueColor={expired ? '#B91C1C' : days < 180 ? '#B45309' : '#166534'}
        />
      </View>

      {/* Empreinte */}
      <View style={styles.hashBox}>
        <Text style={styles.hashLabel}>Empreinte SHA-256</Text>
        <Text style={styles.hashValue} selectable numberOfLines={2}>
          {item.sha256Hash}
        </Text>
      </View>

      {/* Statut intégrité */}
      {integrityResult && (
        <View style={[styles.integrityBanner, {
          backgroundColor: integrityResult.integrityValid ? '#DCFCE7' : '#FEE2E2'
        }]}>
          <MaterialIcons name={integrityIcon as any} size={16} color={integrityColor} />
          <Text style={[styles.integrityText, { color: integrityColor }]}>
            {integrityText}
            {integrityResult && ` — vérifié à ${new Date(integrityResult.verifiedAt).toLocaleTimeString('fr-FR')}`}
          </Text>
        </View>
      )}

      {/* Horodatage */}
      {item.timestampTime ? (
        <View style={styles.timestampRow}>
          <MaterialIcons name="access-time" size={13} color={colors.textMuted} />
          <Text style={styles.timestampText}>
            Horodatage RFC 3161 · {frDateTime(item.timestampTime)}
          </Text>
        </View>
      ) : (
        <View style={styles.timestampRow}>
          <MaterialIcons name="access-time" size={13} color={colors.textMuted} />
          <Text style={styles.timestampText}>Horodatage non disponible</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {/* Vérifier l'intégrité */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnOutline]}
          onPress={handleVerifier}
          disabled={verifying}
        >
          {verifying
            ? <ActivityIndicator size={14} color={colors.primary} />
            : <MaterialIcons name="verified-user" size={15} color={colors.primary} />
          }
          <Text style={styles.actionBtnOutlineText}>
            {verifying ? 'Vérification…' : 'Vérifier'}
          </Text>
        </TouchableOpacity>

        {/* Certificat officiel */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={handleCertificat}
          disabled={certLoading}
        >
          {certLoading
            ? <ActivityIndicator size={14} color="#fff" />
            : <MaterialIcons name="workspace-premium" size={15} color="#fff" />
          }
          <Text style={styles.actionBtnPrimaryText}>
            {certLoading ? 'Génération…' : 'Certificat'}
          </Text>
        </TouchableOpacity>

        {/* PDF archivé */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={handlePdfArchive}
          disabled={pdfLoading}
        >
          {pdfLoading
            ? <ActivityIndicator size={14} color={colors.primary} />
            : <MaterialIcons name="picture-as-pdf" size={15} color={colors.primary} />
          }
          <Text style={styles.actionBtnOutlineText}>
            {pdfLoading ? 'Chargement…' : 'PDF archivé'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MetaRow({
  icon, label, value, valueColor
}: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.metaRow}>
      <MaterialIcons name={icon as any} size={13} color={colors.textMuted} style={styles.metaIcon} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function ArchivageScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { token } = useAuth();
  const params = route.params as RouteParams;

  const [archives, setArchives] = useState<ArchivedPdfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getArchivesDossier(params.dossierId, token!);
      setArchives(data);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les archives');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.dossierId, token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="Archives LCB-FT"
        subtitle={params.numeroDossier}
        onBack={() => navigation.goBack()}
      />

      {/* Bandeau informatif */}
      <View style={styles.infoBanner}>
        <MaterialIcons name="security" size={16} color={colors.accent} />
        <Text style={styles.infoText}>
          Chaque archive est scellée, horodatée et stockée en WORM immuable.
          Le certificat est le document opposable aux autorités (ACPR, TRACFIN).
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Chargement des archives…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={40} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Compteur */}
          <View style={styles.countRow}>
            <MaterialIcons name="folder-special" size={16} color={colors.accent} />
            <Text style={styles.countText}>
              {archives.length} archive{archives.length !== 1 ? 's' : ''} — Dossier {params.numeroDossier}
              {params.clientNom ? ` · ${params.clientNom}` : ''}
            </Text>
          </View>

          {archives.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="archive" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucune archive</Text>
              <Text style={styles.emptySubtitle}>
                L'archivage se déclenche automatiquement lors de la validation, du rejet ou de l'archivage d'un dossier.
              </Text>
            </View>
          ) : (
            archives.map(item => (
              <ArchiveCard
                key={item.id}
                item={item}
                dossierId={params.dossierId}
                numeroDossier={params.numeroDossier}
                token={token!}
              />
            ))
          )}

          {/* Mentions légales */}
          <View style={styles.legalBox}>
            <Text style={styles.legalTitle}>Base légale</Text>
            <Text style={styles.legalText}>
              Art. L. 561-12 CMF — Conservation 5 ans après cessation de la relation d'affaires.
              {'\n'}Directive UE 2015/849 (4ème directive LCB-FT) — Art. 40.
              {'\n'}La suppression avant expiration est techniquement et juridiquement impossible.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#0A1628', padding: spacing[3], margin: spacing[3],
    borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: colors.accent
  },
  infoText: { flex: 1, color: '#BFA063', fontSize: 11, lineHeight: 16, fontFamily: typography.families.ui },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[5] },
  loadingText: { marginTop: spacing[3], color: colors.textMuted, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing[2], textAlign: 'center' },
  retryBtn: { marginTop: spacing[3], backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  retryBtnText: { color: '#fff', fontSize: 13 },

  list: { padding: spacing[3], paddingBottom: spacing[8] },

  countRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: spacing[3]
  },
  countText: { fontSize: 12, color: colors.textMuted, fontFamily: typography.families.ui },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
    ...shadows.md,
    borderWidth: 1, borderColor: colors.border
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle: { fontSize: 12, color: colors.text, fontFamily: typography.families.ui, flex: 1 },

  badge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },

  metaGrid: { marginBottom: spacing[2] },
  metaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  metaIcon: { marginRight: 6 },
  metaLabel: { fontSize: 11, color: colors.textMuted, width: 145 },
  metaValue: { fontSize: 11, color: colors.text, flex: 1 },

  hashBox: {
    backgroundColor: colors.backgroundAlt ?? '#0F1E35',
    borderRadius: radius.sm, padding: spacing[2], marginBottom: spacing[2]
  },
  hashLabel: { fontSize: 9, color: colors.accent, marginBottom: 3, fontFamily: typography.families.mono ?? 'monospace' },
  hashValue: { fontSize: 9, color: '#8BA0C0', fontFamily: typography.families.mono ?? 'monospace', lineHeight: 14 },

  integrityBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.sm, padding: spacing[2], marginBottom: spacing[2]
  },
  integrityText: { fontSize: 11, flex: 1 },

  timestampRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing[3] },
  timestampText: { fontSize: 10, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: spacing[2] },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderRadius: radius.md, paddingVertical: spacing[2], paddingHorizontal: spacing[1]
  },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  actionBtnOutline: { borderWidth: 1, borderColor: colors.primary },
  actionBtnSecondary: { borderWidth: 1, borderColor: colors.border },
  actionBtnOutlineText: { color: colors.primary, fontSize: 11, fontWeight: '500' },

  emptyBox: { alignItems: 'center', paddingVertical: spacing[8] },
  emptyTitle: { fontSize: 16, color: colors.text, marginTop: spacing[3], fontWeight: '600' },
  emptySubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], lineHeight: 18 },

  legalBox: {
    marginTop: spacing[4], borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing[3]
  },
  legalTitle: { fontSize: 10, color: colors.accent, fontWeight: '600', marginBottom: spacing[1] },
  legalText: { fontSize: 9.5, color: colors.textMuted, lineHeight: 15 }
});
