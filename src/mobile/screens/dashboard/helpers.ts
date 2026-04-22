import { Dimensions } from 'react-native';
import { colors, spacing } from '../../../shared/theme/theme';
import { AppScreen } from '../../../shared/config/rolePermissions';

const { width: SCREEN_W } = Dimensions.get('window');
export const CHART_W = Math.min(SCREEN_W - spacing.lg * 2, 400);
export const HALF_CHART = Math.floor((CHART_W - spacing.sm) / 2);

export function euros(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents || 0) / 100);
}

export function humanDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function personName(person?: { firstName?: string; lastName?: string; email?: string }): string {
  const full = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
  return full || person?.email || '—';
}

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: 'Actif',      color: '#1A6B50', bg: '#E6F4EF' },
  PAST_DUE:  { label: 'Échu',       color: '#8A6800', bg: '#FEF5DC' },
  SUSPENDED: { label: 'Suspendu',   color: '#8B1C1C', bg: '#FDEDED' },
  CANCELLED: { label: 'Résilié',    color: '#4A5E74', bg: '#F0EDE5' },
  PENDING:   { label: 'En attente', color: '#8A6800', bg: '#FEF5DC' },
  PAID:      { label: 'Payé',       color: '#1D3260', bg: '#E6EBF4' },
  VERIFIED:  { label: 'Vérifié',    color: '#1A6B50', bg: '#E6F4EF' },
  FAILED:    { label: 'Échoué',     color: '#8B1C1C', bg: '#FDEDED' },
  REFUNDED:  { label: 'Remboursé',  color: '#7C3AED', bg: '#F5F3FF' },
  REDEEMED:  { label: 'Utilisée',   color: '#1A6B50', bg: '#E6F4EF' },
};

export const SHORTCUT_DEFS: Partial<Record<AppScreen, { label: string; icon: string; color: string }>> = {
  NewDossier:           { label: 'Nouveau dossier',   icon: 'add-circle',        color: colors.navy },
  IdentityVerification: { label: 'Vérif. identité',   icon: 'badge',             color: colors.navy2 },
  ValidationFinale:     { label: 'Validation',         icon: 'task-alt',          color: colors.success },
  Scoring:              { label: 'Scoring',            icon: 'speed',             color: colors.warning },
  Exceptions:           { label: 'Exceptions',         icon: 'report-problem',    color: colors.danger },
  UniversalSearch:      { label: 'Recherche',          icon: 'search',            color: '#2563EB' },
  BatchSearch:          { label: 'Batch',              icon: 'table-rows',        color: '#D97706' },
  Watchlists:           { label: 'Watchlists',         icon: 'visibility',        color: colors.success },
  IntelligenceReport:   { label: 'Intelligence',       icon: 'query-stats',       color: colors.warning },
  InvestigationTools:   { label: 'Investigation',      icon: 'manage-search',     color: colors.navy3 },
  Settings:             { label: 'Paramètres',         icon: 'settings',          color: colors.slate2 },
  Dashboard:            { label: 'Dashboard',          icon: 'dashboard',         color: colors.navy },
  DocumentCapture:      { label: 'Capture doc',        icon: 'document-scanner',  color: colors.slate },
  OCRResult:            { label: 'OCR',                icon: 'text-snippet',      color: colors.slate },
  OCRProcessing:        { label: 'Traitement',         icon: 'hourglass-top',     color: colors.slate },
  Timeline:             { label: 'Historique',         icon: 'timeline',          color: colors.slate2 },
  SearchDetail:         { label: 'Détail recherche',   icon: 'preview',           color: colors.slate2 },
  DossierBloque:        { label: 'Bloqué',             icon: 'block',             color: colors.danger },
  EscaladeSuperieur:    { label: 'Escalade',           icon: 'escalator-warning', color: colors.warning },
  ExceptionHandling:    { label: 'Traiter exception',  icon: 'handyman',          color: colors.danger },
  ResearchHub:          { label: 'Hub recherche',      icon: 'hub',               color: colors.navy3 },
  Archivage:            { label: 'Archivage',          icon: 'archive',           color: colors.slate2 },
};
