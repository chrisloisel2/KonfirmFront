import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius } from '../../../../shared/theme/theme';
import { OperationalKpis, DashboardPayload } from '../types';
import { euros, humanDate } from '../helpers';
import { KpiCard, KpiGaugeArc, KpiDonutDossiers, KpiAlertGauges, ShortcutTile, SectionRow, StatusBadge } from '../components';
import { st } from '../styles';
import DossierPdfModal from '../../../components/DossierPdfModal';

// ── KpiSection ─────────────────────────────────────────────────────────────────
// Visible par tous les rôles ; les cartes affichées varient selon le niveau.

interface KpiSectionProps {
  kpis: OperationalKpis;
  isAdmin: boolean;
  isManager: boolean;
  isReferentOrAbove: boolean;
}

export function KpiSection({ kpis, isAdmin, isManager, isReferentOrAbove }: KpiSectionProps) {
  return (
    <View style={st.section}>
      <SectionRow title={isAdmin ? 'KPI opérationnels' : 'Mes indicateurs'} />

      {(isManager || isAdmin) ? (
        <>
          <KpiGaugeArc value={kpis.tauxValidation} />
          <View style={st.kpiChartsRow}>
            <KpiDonutDossiers
              total={kpis.dossiersAujourdhui}
              pending={kpis.attenteValidation}
              exceptions={kpis.mesExceptions}
            />
            <KpiAlertGauges
              exceptions={kpis.mesExceptions}
              scoring={kpis.scoringCritique}
            />
          </View>
        </>
      ) : (
        <View style={st.kpiGrid}>
          <KpiCard
            label="Dossiers aujourd'hui"
            value={kpis.dossiersAujourdhui}
            icon="folder-open"
            accent={colors.gold}
            note="Créés aujourd'hui"
          />
          {isReferentOrAbove && (
            <KpiCard
              label="À valider"
              value={kpis.attenteValidation}
              icon="pending-actions"
              accent="#2563EB"
              alertThreshold={1}
              note="En attente"
            />
          )}
          {isReferentOrAbove && (
            <KpiCard
              label="Mes exceptions"
              value={kpis.mesExceptions}
              icon="report-problem"
              accent={colors.danger}
              alertThreshold={1}
              note="À traiter"
            />
          )}
        </View>
      )}
    </View>
  );
}

// ── QuickAccessSection ─────────────────────────────────────────────────────────
// Raccourcis filtrés par rôle, définis dans rolePermissions.ts.

interface Shortcut {
  key: string;
  label: string;
  icon: string;
  color: string;
}

interface QuickAccessSectionProps {
  shortcuts: Shortcut[];
  onNavigate: (screen: string) => void;
}

export function QuickAccessSection({ shortcuts, onNavigate }: QuickAccessSectionProps) {
  if (shortcuts.length === 0) return null;
  return (
    <View style={st.section}>
      <SectionRow title="Accès rapide" />
      <View style={st.shortcutsGrid}>
        {shortcuts.map(s => (
          <ShortcutTile
            key={s.key}
            label={s.label}
            icon={s.icon}
            color={s.color}
            onPress={() => onNavigate(s.key)}
          />
        ))}
      </View>
    </View>
  );
}

// ── RecentDossiersSection ──────────────────────────────────────────────────────
// Affichée pour tous les rôles dès qu'il y a des dossiers récents.

interface RecentDossiersSectionProps {
  dossiers: DashboardPayload['recentDossiers'];
}

export function RecentDossiersSection({ dossiers }: RecentDossiersSectionProps) {
  if (dossiers.length === 0) return null;
  return (
    <View style={st.section}>
      <SectionRow title="Dossiers récents" />
      {dossiers.map(d => (
        <View key={d.id} style={st.card}>
          <View style={st.cardHead}>
            <View style={st.cardIconWrap}>
              <MaterialIcons name="folder" size={18} color={colors.navy3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>{d.client}</Text>
              <Text style={st.cardSub}>{d.numero} · {d.typeOuverture}</Text>
            </View>
            <StatusBadge status={d.status} />
          </View>
          <View style={[st.cardMeta, localSt.cardFooter]}>
            <View style={localSt.chips}>
              {d.montantInitial != null && (
                <View style={st.metaChip}>
                  <MaterialIcons name="euro" size={12} color={colors.textTertiary} />
                  <Text style={st.metaChipText}>{euros(d.montantInitial * 100)}</Text>
                </View>
              )}
              <View style={st.metaChip}>
                <MaterialIcons name="schedule" size={12} color={colors.textTertiary} />
                <Text style={st.metaChipText}>{humanDate(d.updatedAt)}</Text>
              </View>
            </View>

            <DossierPdfModal dossierId={d.id} numeroDossier={d.numero}>
              {(open: () => void) => (
                <TouchableOpacity style={localSt.pdfBtn} onPress={open} activeOpacity={0.75}>
                  <MaterialIcons name="picture-as-pdf" size={13} color={colors.error} />
                  <Text style={localSt.pdfBtnText}>PDF</Text>
                </TouchableOpacity>
              )}
            </DossierPdfModal>
          </View>
        </View>
      ))}
    </View>
  );
}

const localSt = StyleSheet.create({
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  pdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.error,
  },
});
