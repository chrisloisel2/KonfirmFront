import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, TouchableOpacity,
  TextInput as RNInput, StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Exception, ScoringResult, Recherche } from '../../shared/types';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';

interface RouteParams {
  recherches?: Recherche[];
  scoring?: ScoringResult;
  dossierId: string;
  exceptionId?: string;
  dossierData?: any;
}

type ExceptionDecision = 'valider' | 'refuser' | 'escalader' | 'bloquer';

interface DecisionOption {
  value: ExceptionDecision;
  label: string;
  sub: string;
  accent: string;
  icon: string;
}

function buildExceptions(recherches: Recherche[], scoring: ScoringResult | undefined, dossierId: string): Exception[] {
  const list: Exception[] = [];

  if (recherches.find(r => r.type === 'ppe' && r.result?.isPPE)) {
    list.push({ id: `ppe-${dossierId}`, dossierId, type: 'ppe', description: 'Personne Politiquement Exposée identifiée', status: 'pending', createdAt: new Date() });
  }
  if (recherches.find(r => r.type === 'gel_avoirs' && r.result?.isFrozen)) {
    list.push({ id: `gel-${dossierId}`, dossierId, type: 'gel_avoirs', description: 'Match détecté sur la liste de gel des avoirs', status: 'pending', createdAt: new Date() });
  }
  if (recherches.find(r => r.type === 'beneficiaires_effectifs' && !r.result?.identified)) {
    list.push({ id: `be-${dossierId}`, dossierId, type: 'be_incoherent', description: 'Impossible d\'identifier les bénéficiaires effectifs', status: 'pending', createdAt: new Date() });
  }
  if (scoring?.decision === 'examen_renforce') {
    list.push({ id: `examen-${dossierId}`, dossierId, type: 'ppe', description: 'Examen renforcé requis — Score de risque élevé', status: 'pending', createdAt: new Date() });
  }
  return list;
}

const EXCEPTION_META: Record<string, { title: string; icon: string; color: string; bg: string }> = {
  ppe:           { title: 'Personne Politiquement Exposée', icon: 'person',           color: '#D97706', bg: '#FFFBEB' },
  gel_avoirs:    { title: 'Gel des avoirs',                 icon: 'block',            color: colors.error,   bg: colors.errorLight },
  be_incoherent: { title: 'Bénéficiaires effectifs',        icon: 'group',            color: '#7C3AED',      bg: '#F5F3FF' },
  document_expire: { title: 'Document expiré',              icon: 'event-busy',       color: colors.warning, bg: colors.warningLight },
};

const DECISION_OPTIONS: Record<string, DecisionOption[]> = {
  ppe: [
    { value: 'valider',  label: 'Valider la relation',      sub: 'Autorisation spéciale requise',  accent: colors.success, icon: 'check-circle' },
    { value: 'refuser',  label: 'Refuser la relation',      sub: 'Mettre fin à l\'opération',       accent: colors.error,   icon: 'cancel' },
    { value: 'escalader',label: 'Escalader au responsable', sub: 'Décision déléguée',               accent: '#7C3AED',      icon: 'call-made' },
  ],
  gel_avoirs: [
    { value: 'valider',  label: 'Faux positif',             sub: 'Continuer l\'opération',          accent: colors.success, icon: 'check-circle' },
    { value: 'escalader',label: 'Doute — Investigation',    sub: 'Demander une vérification',       accent: '#D97706',      icon: 'search' },
    { value: 'bloquer',  label: 'Vrai positif — Bloquer',   sub: 'Bloquer immédiatement',           accent: colors.error,   icon: 'lock' },
  ],
  default: [
    { value: 'valider',  label: 'Continuer malgré l\'exception', sub: 'Assumer la responsabilité',  accent: colors.success, icon: 'check-circle' },
    { value: 'refuser',  label: 'Refuser le dossier',            sub: 'Mettre fin à l\'opération',  accent: colors.error,   icon: 'cancel' },
    { value: 'escalader',label: 'Escalader pour décision',       sub: 'Déléguer au responsable',    accent: '#7C3AED',      icon: 'call-made' },
  ],
};

export default function ExceptionScreens() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recherches = [], scoring, dossierId, dossierData } = (route.params as RouteParams) || {};

  const [currentIdx, setCurrentIdx]       = useState(0);
  const [decisions, setDecisions]         = useState<Record<string, ExceptionDecision>>({});
  const [justifications, setJustifications] = useState<Record<string, string>>({});

  const exceptions = buildExceptions(recherches, scoring, dossierId);

  const handleDecision = (id: string, d: ExceptionDecision) =>
    setDecisions(prev => ({ ...prev, [id]: d }));

  const handleJustification = (id: string, t: string) =>
    setJustifications(prev => ({ ...prev, [id]: t }));

  const proceed = () => {
    if (currentIdx < exceptions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      const all = Object.values(decisions);
      const finalStatus = all.includes('bloquer') || all.includes('refuser')
        ? 'blocked'
        : all.includes('escalader')
          ? 'escalated'
          : 'validated';

      // @ts-ignore
      navigation.navigate('ValidationFinale', {
        dossierId,
        dossierData,
        scoring,
        recherches,
        decisions,
        justifications,
        exceptions,
        finalStatus,
      });
    }
  };

  const validateAndContinue = () => {
    const ex = exceptions[currentIdx];
    if (!decisions[ex.id]) {
      Alert.alert('Décision requise', 'Veuillez choisir une décision pour continuer.');
      return;
    }
    if (!justifications[ex.id] || justifications[ex.id].trim().length < 10) {
      Alert.alert('Justification requise', 'Veuillez justifier votre décision (10 caractères minimum).');
      return;
    }
    if (ex.type === 'gel_avoirs' && decisions[ex.id] === 'valider') {
      Alert.alert(
        'Confirmation requise',
        'Vous validez une relation malgré un gel d\'avoirs. Êtes-vous certain ?',
        [
          { text: 'Revoir', style: 'cancel' },
          { text: 'Confirmer', style: 'destructive', onPress: proceed },
        ]
      );
      return;
    }
    proceed();
  };

  if (exceptions.length === 0) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="check-circle" size={44} color={colors.success} />
          </View>
          <Text style={styles.emptyTitle}>Aucune exception</Text>
          <Text style={styles.emptyBody}>Toutes les vérifications sont conformes</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const ex = exceptions[currentIdx];
  const meta = EXCEPTION_META[ex.type] ?? { title: 'Exception', icon: 'warning', color: colors.warning, bg: colors.warningLight };
  const options = DECISION_OPTIONS[ex.type] ?? DECISION_OPTIONS.default;
  const selectedDecision = decisions[ex.id];
  const justText = justifications[ex.id] || '';
  const canProceed = !!selectedDecision && justText.trim().length >= 10;
  const isGel = ex.type === 'gel_avoirs';
  const ppeData = isGel ? null : recherches.find(r => r.type === 'ppe')?.result;
  const gelData = isGel ? recherches.find(r => r.type === 'gel_avoirs')?.result : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <AppHeader
        title="Traitement exception"
        subtitle={`${currentIdx + 1} sur ${exceptions.length}`}
        onBack={() => navigation.goBack()}
        right={
          <View style={styles.progressPills}>
            {exceptions.map((_, i) => (
              <View
                key={i}
                style={[styles.pill, i < currentIdx && styles.pillDone, i === currentIdx && styles.pillActive]}
              />
            ))}
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Exception banner */}
        <View style={[styles.banner, { backgroundColor: meta.bg, borderColor: meta.color + '40' }]}>
          <View style={[styles.bannerIcon, { backgroundColor: meta.color + '20' }]}>
            <MaterialIcons name={meta.icon as any} size={26} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerType, { color: meta.color }]}>{meta.title}</Text>
            <Text style={styles.bannerDesc}>{ex.description}</Text>
          </View>
        </View>

        {/* Details card */}
        {(ex.type === 'ppe' && ppeData) && (
          <SectionCard title="Détails PPE">
            <DetailRow label="Source(s)" value={ppeData?.sources?.join(', ') || 'N/A'} />
            <View style={[styles.infoBox, { backgroundColor: colors.warningLight, borderColor: colors.warning + '40' }]}>
              <MaterialIcons name="info" size={14} color={colors.warning} />
              <Text style={[styles.infoText, { color: colors.warning }]}>
                La validation d'une PPE nécessite l'autorisation du responsable
              </Text>
            </View>
          </SectionCard>
        )}

        {(ex.type === 'gel_avoirs' && gelData) && (
          <SectionCard title="Détails gel des avoirs">
            <DetailRow label="Source" value={gelData?.source || 'N/A'} />
            <View style={[styles.infoBox, { backgroundColor: colors.errorLight, borderColor: colors.error + '40' }]}>
              <MaterialIcons name="warning" size={14} color={colors.error} />
              <Text style={[styles.infoText, { color: colors.error }]}>
                ATTENTION : match sur la liste de gel des avoirs
              </Text>
            </View>
          </SectionCard>
        )}

        {/* Decision options */}
        <SectionCard title="Décision requise">
          <View style={styles.optionList}>
            {options.map(opt => {
              const selected = selectedDecision === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionRow, selected && { borderColor: opt.accent, backgroundColor: opt.accent + '0C' }]}
                  onPress={() => handleDecision(ex.id, opt.value)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.optionIconWrap, { backgroundColor: selected ? opt.accent + '20' : colors.borderLight }]}>
                    <MaterialIcons name={opt.icon as any} size={18} color={selected ? opt.accent : colors.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, selected && { color: opt.accent }]}>{opt.label}</Text>
                    <Text style={styles.optionSub}>{opt.sub}</Text>
                  </View>
                  <View style={[styles.radio, selected && { borderColor: opt.accent }]}>
                    {selected && <View style={[styles.radioDot, { backgroundColor: opt.accent }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>

        {/* Justification */}
        <SectionCard title="Justification obligatoire">
          <RNInput
            style={[styles.textarea, justText.length > 0 && justText.trim().length < 10 && styles.textareaError]}
            multiline
            numberOfLines={4}
            placeholder="Expliquez votre décision en détail…"
            placeholderTextColor={colors.textTertiary}
            value={justText}
            onChangeText={t => handleJustification(ex.id, t)}
            textAlignVertical="top"
          />
          <View style={styles.charRow}>
            <MaterialIcons name="info-outline" size={12} color={colors.textTertiary} />
            <Text style={styles.charHint}>
              {justText.trim().length < 10
                ? `${10 - justText.trim().length} caractère(s) manquant(s)`
                : 'Cette justification sera archivée et contrôlable'}
            </Text>
          </View>
        </SectionCard>

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {currentIdx > 0 && (
          <TouchableOpacity style={styles.prevBtn} onPress={() => setCurrentIdx(prev => prev - 1)}>
            <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
            <Text style={styles.prevText}>Précédent</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, !canProceed && styles.nextDisabled, currentIdx === 0 && { flex: 1 }]}
          onPress={validateAndContinue}
          disabled={!canProceed}
          activeOpacity={0.85}
        >
          <Text style={styles.nextText}>
            {currentIdx < exceptions.length - 1 ? 'Exception suivante' : 'Finaliser'}
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={card.wrap}>
      <Text style={card.title}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={card.detailRow}>
      <Text style={card.detailLabel}>{label}</Text>
      <Text style={card.detailValue}>{value}</Text>
    </View>
  );
}

const card = StyleSheet.create({
  wrap:        { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: 12, ...shadows.sm, borderWidth: 1, borderColor: colors.borderLight },
  title:       { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: 13, color: colors.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  progressPills: { flexDirection: 'row', gap: 5 },
  pill:        { width: 20, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  pillDone:    { backgroundColor: colors.success },
  pillActive:  { backgroundColor: '#fff' },

  scroll: { padding: spacing.md, paddingBottom: 110 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 12,
  },
  bannerIcon: { width: 52, height: 52, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  bannerType: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  bannerDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  infoText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },

  optionList: { gap: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionIconWrap: { width: 38, height: 38, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  optionSub:   { fontSize: 12, color: colors.textSecondary },
  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  radioDot:    { width: 10, height: 10, borderRadius: 5 },

  textarea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 100,
    lineHeight: 20,
  },
  textareaError: { borderColor: colors.error },
  charRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  charHint: { fontSize: 11, color: colors.textTertiary },

  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    gap: 10,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  prevBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  prevText:   { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  nextBtn:    { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, ...shadows.sm },
  nextDisabled: { opacity: 0.45 },
  nextText:   { fontSize: 14, fontWeight: '700', color: '#fff' },

  emptyWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyBody:  { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  backBtn:    { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl, ...shadows.sm },
  backBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
});
