import { UserRole } from '../types';

/**
 * Screens chaque rôle peut voir dans le stack de navigation.
 * Les rôles supérieurs héritent des screens des rôles inférieurs.
 *
 * CONSEILLER  — création dossiers, capture docs, vérification identité
 * CAISSE      — idem conseiller + validation finale côté transaction
 * REFERENT    — idem + exceptions, scoring, recherche simple
 * RESPONSABLE — idem + outils investigation, batch, watchlists, rapports
 * ADMIN       — accès total
 */

export type AppScreen =
  | 'Dashboard'
  | 'NewDossier'
  | 'DocumentCapture'
  | 'OCRResult'
  | 'IdentityVerification'
  | 'ValidationFinale'
  | 'Scoring'
  | 'Exceptions'
  | 'ExceptionHandling'
  | 'Timeline'
  | 'ResearchHub'
  | 'UniversalSearch'
  | 'BatchSearch'
  | 'Watchlists'
  | 'IntelligenceReport'
  | 'InvestigationTools'
  | 'Settings'
  | 'OCRProcessing'
  | 'SearchDetail'
  | 'DossierBloque'
  | 'EscaladeSuperieur'
  | 'Archivage';

const CONSEILLER_SCREENS: AppScreen[] = [
  'Dashboard',
  'NewDossier',
  'DocumentCapture',
  'OCRProcessing',
  'OCRResult',
  'IdentityVerification',
  'ValidationFinale',
  'DossierBloque',
  'Settings',
];

const CAISSE_SCREENS: AppScreen[] = [
  ...CONSEILLER_SCREENS,
  // La caisse voit aussi le scoring (lecture seule) pour justifier le refus
  'Scoring',
];

const REFERENT_SCREENS: AppScreen[] = [
  ...CAISSE_SCREENS,
  'Exceptions',
  'ExceptionHandling',
  'EscaladeSuperieur',
  'Timeline',
  'ResearchHub',
  'UniversalSearch',
  'SearchDetail',
  'Watchlists',
  'Archivage',
];

const RESPONSABLE_SCREENS: AppScreen[] = [
  ...REFERENT_SCREENS,
  'BatchSearch',
  'IntelligenceReport',
  'InvestigationTools',
];

const ADMIN_SCREENS: AppScreen[] = [...RESPONSABLE_SCREENS];

export const ROLE_SCREENS: Record<UserRole, AppScreen[]> = {
  conseiller:  CONSEILLER_SCREENS,
  caisse:      CAISSE_SCREENS,
  referent:    REFERENT_SCREENS,
  responsable: RESPONSABLE_SCREENS,
  admin:       ADMIN_SCREENS,
};

/** Retourne true si le rôle donné peut accéder à l'écran. */
export function canRoleAccess(role: UserRole, screen: AppScreen): boolean {
  return ROLE_SCREENS[role]?.includes(screen) ?? false;
}

/** Métadonnées affichées dans le Dashboard selon le rôle. */
export interface RoleMeta {
  label: string;
  description: string;
  color: string;         // couleur badge
  quickActions: AppScreen[];
}

export const ROLE_META: Record<UserRole, RoleMeta> = {
  conseiller: {
    label: 'Conseiller',
    description: 'Création et suivi des dossiers clients',
    color: '#1D3260',
    quickActions: ['NewDossier', 'IdentityVerification'],
  },
  caisse: {
    label: 'Caisse',
    description: 'Génère des dossiers et valide les transactions',
    color: '#0A1628',
    quickActions: ['NewDossier', 'ValidationFinale'],
  },
  referent: {
    label: 'Référent Conformité',
    description: 'Valide les dossiers critiques, gère les watchlists et supervise son site',
    color: '#8A6800',
    quickActions: ['Exceptions', 'Watchlists', 'UniversalSearch'],
  },
  responsable: {
    label: 'Responsable',
    description: 'Supervise tous les employés et accède aux KPI globaux',
    color: '#1A6B50',
    quickActions: ['Settings', 'InvestigationTools', 'BatchSearch', 'IntelligenceReport'],
  },
  admin: {
    label: 'Administrateur',
    description: 'Accès complet à toutes les fonctionnalités',
    color: '#8B1C1C',
    quickActions: ['InvestigationTools', 'Watchlists', 'BatchSearch', 'Settings'],
  },
};
