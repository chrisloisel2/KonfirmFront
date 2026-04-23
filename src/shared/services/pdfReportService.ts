/**
 * Service de génération du rapport PDF LCB-FT
 *
 * Génère un document HTML stylisé converti en PDF via expo-print.
 * Le rapport contient : identité, score global, détail des 4 critères,
 * explication du calcul, résultats source par source, décision finale.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Recherche, ScoringResult } from '../types';
import { uploadPdfPourArchivage } from './archivageApiService';

type VerificationStatus = 'clear' | 'alert' | 'warning' | 'pending' | 'error';
type Category = 'document' | 'sanctions' | 'pep' | 'reputation' | 'judicial';
type FinalStatus = 'validated' | 'escalated' | 'blocked' | 'under_review';

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

interface ValidationDecision {
	exceptionId: string;
	type: string;
	description: string;
	decision: string;
	decisionLabel: string;
	justification: string;
}

export interface ReportInput {
	dossierId: string;
	finalStatus: FinalStatus;
	identity: {
		nom: string;
		prenom: string;
		dateNaissance?: string;
		nationalite?: string;
		numeroDocument?: string;
		dateExpiration?: string;
		docType?: string;
	};
	dossier: {
		type?: string;
		clientType?: string;
		montant?: number;
		seuilLCBFT?: string;
		moyenPaiement?: any;
		intermediaire?: any;
	};
	verificationResults: VerificationResult[];
	recherches: Recherche[];
	scoring: ScoringResult;
	validation?: {
		completedAt: Date;
		summary: string;
		decisions: ValidationDecision[];
	};
	agentName?: string;
	branchName?: string;
	authToken?: string;
}

const STATUS_META: Record<VerificationStatus, { label: string; color: string; bg: string }> = {
	clear: { label: 'Conforme', color: '#166534', bg: '#DCFCE7' },
	alert: { label: 'Alerte', color: '#B91C1C', bg: '#FEE2E2' },
	warning: { label: 'Avertissement', color: '#B45309', bg: '#FEF3C7' },
	pending: { label: 'En attente', color: '#1D4ED8', bg: '#DBEAFE' },
	error: { label: 'Indisponible', color: '#64748B', bg: '#E2E8F0' },
};

const FINAL_STATUS_META: Record<FinalStatus, { label: string; color: string; bg: string; conclusion: string }> = {
	validated: {
		label: 'Dossier validé',
		color: '#166534',
		bg: '#DCFCE7',
		conclusion: 'Les vérifications et recherches disponibles ne justifient pas d’opposition à ce stade. Le dossier est clôturé avec validation.',
	},
	escalated: {
		label: 'Escalade requise',
		color: '#6D28D9',
		bg: '#EDE9FE',
		conclusion: 'Le dossier doit être transmis à un niveau de décision supérieur compte tenu des signaux relevés et des arbitrages réalisés.',
	},
	blocked: {
		label: 'Dossier bloqué',
		color: '#B91C1C',
		bg: '#FEE2E2',
		conclusion: 'Le dossier ne peut pas être poursuivi en l’état. Les éléments relevés imposent une mesure conservatoire et une traçabilité renforcée.',
	},
	under_review: {
		label: 'Revue en cours',
		color: '#B45309',
		bg: '#FEF3C7',
		conclusion: 'Le dossier reste en revue. Des compléments sont nécessaires avant la clôture définitive.',
	},
};

const RECHERCHE_LABELS: Record<string, string> = {
	ppe: 'Personne politiquement exposée',
	sanctions: 'Listes de sanctions',
	gel_avoirs: 'Gel des avoirs',
	pays_liste: 'Pays et listes à risque',
	reputation: 'Réputation et presse',
	beneficiaires_effectifs: 'Bénéficiaires effectifs',
};

const CATEGORY_LABELS: Record<Category, string> = {
	document: 'Vérification documentaire',
	sanctions: 'Sanctions',
	pep: 'PPE',
	reputation: 'Réputation',
	judicial: 'Judiciaire',
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function formatDateTime(value: Date | string | undefined): string {
	if (!value) return 'Non horodaté';
	const date = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return 'Date invalide';
	return date.toLocaleDateString('fr-FR', {
		day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
	});
}

function formatCurrency(value?: number): string {
	if (typeof value !== 'number' || Number.isNaN(value)) return 'Non renseigné';
	return `${value.toLocaleString('fr-FR')} EUR`;
}

function scoreColor(value: number): string {
	if (value >= 75) return '#B91C1C';
	if (value >= 45) return '#B45309';
	return '#166534';
}

function asText(value: unknown): string {
	if (value == null) return 'Non renseigné';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) {
		if (value.length === 0) return 'Aucun élément';
		return value.slice(0, 6).map((entry) => asText(entry)).join(' | ');
	}
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>).slice(0, 8);
		if (entries.length === 0) return 'Objet vide';
		return entries.map(([key, entry]) => `${key}: ${asText(entry)}`).join(' | ');
	}
	return 'Valeur non exploitable';
}

function buildRawResultBlock(title: string, payload: unknown): string {
	return `
    <div class="raw-block">
      <div class="raw-title">${escapeHtml(title)}</div>
      <div class="raw-value">${escapeHtml(asText(payload))}</div>
    </div>
  `;
}

function buildVerificationRows(results: VerificationResult[]): string {
	if (results.length === 0) {
		return '<tr><td colspan="6" class="empty-cell">Aucun retour scrappé disponible.</td></tr>';
	}

	return results.map((result, index) => {
		const status = STATUS_META[result.overriddenByUser ? 'clear' : result.status];
		return `
      <tr>
        <td>${index + 1}</td>
        <td>
          <div class="cell-title">${escapeHtml(result.sourceLabel)}</div>
          <div class="cell-subtitle">${escapeHtml(CATEGORY_LABELS[result.category] || result.category)}</div>
        </td>
        <td>${escapeHtml(result.summary || 'Aucun résumé')}</td>
        <td>${escapeHtml(result.details || 'Aucun détail')}</td>
        <td>
          <span class="badge" style="color:${status.color};background:${status.bg}">
            ${escapeHtml(status.label)}
          </span>
        </td>
        <td>${result.confidence ? `${Math.round(result.confidence * 100)}%` : '—'}</td>
      </tr>
      ${result.url || (result.matches && result.matches.length > 0)
				? `
        <tr class="sub-row">
          <td></td>
          <td colspan="5">
            ${result.url ? buildRawResultBlock('Lien source', result.url) : ''}
            ${result.matches && result.matches.length > 0 ? buildRawResultBlock('Correspondances', result.matches) : ''}
          </td>
        </tr>
      `
				: ''}
    `;
	}).join('');
}

function buildRechercheRows(recherches: Recherche[]): string {
	if (recherches.length === 0) {
		return '<tr><td colspan="6" class="empty-cell">Aucune recherche complémentaire n’a été transmise dans ce flux.</td></tr>';
	}

	return recherches.map((recherche, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <div class="cell-title">${escapeHtml(RECHERCHE_LABELS[recherche.type] || recherche.type)}</div>
        <div class="cell-subtitle">${escapeHtml(recherche.source || 'Source non précisée')}</div>
      </td>
      <td>${escapeHtml(recherche.status)}</td>
      <td>${recherche.confidence ? `${Math.round(recherche.confidence * 100)}%` : '—'}</td>
      <td>${escapeHtml(formatDateTime(recherche.executedAt as unknown as string))}</td>
      <td>${escapeHtml(asText(recherche.result))}</td>
    </tr>
  `).join('');
}

function buildDecisionRows(decisions: ValidationDecision[]): string {
	if (decisions.length === 0) {
		return '<tr><td colspan="4" class="empty-cell">Aucun arbitrage manuel requis.</td></tr>';
	}

	return decisions.map((decision, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <div class="cell-title">${escapeHtml(decision.description)}</div>
        <div class="cell-subtitle">${escapeHtml(decision.type)}</div>
      </td>
      <td>${escapeHtml(decision.decisionLabel)}</td>
      <td>${escapeHtml(decision.justification || 'Sans justification transmise')}</td>
    </tr>
  `).join('');
}

function buildTimeline(input: ReportInput): string {
	const timeline = [
		{
			label: 'Analyse scoring',
			value: formatDateTime(input.scoring.calculatedAt),
			detail: `${input.scoring.scoreFinal}/100 · ${input.scoring.decision}`,
		},
		...(input.validation ? [{
			label: 'Clôture validation',
			value: formatDateTime(input.validation.completedAt),
			detail: input.validation.summary,
		}] : []),
	];

	const latestVerification = input.verificationResults
		.map((item) => item.checkedAt)
		.filter(Boolean)
		.sort()
		.pop();

	if (latestVerification) {
		timeline.unshift({
			label: 'Dernier retour scrappé',
			value: formatDateTime(latestVerification),
			detail: `${input.verificationResults.length} source(s) de vérification`,
		});
	}

	const latestRecherche = input.recherches
		.map((item) => item.executedAt as unknown as string)
		.filter(Boolean)
		.sort()
		.pop();

	if (latestRecherche) {
		timeline.splice(1, 0, {
			label: 'Dernière recherche complémentaire',
			value: formatDateTime(latestRecherche),
			detail: `${input.recherches.length} recherche(s) exécutée(s)`,
		});
	}

	return timeline.map((entry) => `
    <div class="timeline-item">
      <div class="timeline-date">${escapeHtml(entry.value)}</div>
      <div class="timeline-content">
        <div class="timeline-title">${escapeHtml(entry.label)}</div>
        <div class="timeline-detail">${escapeHtml(entry.detail)}</div>
      </div>
    </div>
  `).join('');
}

function buildHtml(input: ReportInput): string {
	const finalMeta = FINAL_STATUS_META[input.finalStatus];
	const activeAlerts = input.verificationResults.filter((item) => item.status === 'alert' && !item.overriddenByUser).length;
	const activeWarnings = input.verificationResults.filter((item) => item.status === 'warning' && !item.overriddenByUser).length;
	const ignoredAlerts = input.verificationResults.filter((item) => item.overriddenByUser).length;

	return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Compte rendu conformité - ${escapeHtml(input.dossierId)}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #172033;
      font-size: 11px;
      line-height: 1.5;
      background: #fff;
    }

    .page-break {
      page-break-before: always;
    }

    .header {
      background: linear-gradient(135deg, #0A1628 0%, #11284f 60%, #1e4f91 100%);
      border-radius: 14px;
      padding: 22px 24px;
      color: #fff;
      margin-bottom: 18px;
    }

    .header-grid {
      display: table;
      width: 100%;
    }

    .header-left,
    .header-right {
      display: table-cell;
      vertical-align: top;
    }

    .header-right {
      text-align: right;
      width: 38%;
      font-size: 10px;
      line-height: 1.7;
    }

    .eyebrow {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1.7px;
      opacity: 0.6;
      margin-bottom: 10px;
    }

    .logo-lockup {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2px;
      margin-bottom: 0;
      line-height: 1.1;
    }

    .brand-accent {
      color: #BFA063;
    }

    .brand-sep {
      height: 1px;
      background: #BFA063;
      margin: 4px 0;
      opacity: 0.7;
    }

    .brand-tagline {
      font-size: 7.5px;
      letter-spacing: 4px;
      opacity: 0.65;
      font-weight: 300;
      text-transform: uppercase;
    }

    .subtitle {
      font-size: 11px;
      opacity: 0.75;
      margin-top: 4px;
    }

    .identity-strip {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.2);
    }

    .identity-strip div {
      margin-bottom: 3px;
    }

    .identity-name {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 5px;
    }

    .section {
      margin-bottom: 16px;
      border: 1px solid #dbe3ee;
      border-radius: 12px;
      overflow: hidden;
    }

    .section-title {
      padding: 10px 14px;
      background: #f5f8fc;
      border-bottom: 1px solid #dbe3ee;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 1.2px;
      color: #58708e;
    }

    .section-body {
      padding: 14px;
    }

    .hero-summary {
      display: table;
      width: 100%;
      table-layout: fixed;
    }

    .hero-box {
      display: table-cell;
      width: 25%;
      padding: 12px 10px;
      border-right: 1px solid #e5ebf3;
      text-align: center;
    }

    .hero-box:last-child {
      border-right: none;
    }

    .hero-value {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 2px;
    }

    .hero-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7c93;
    }

    .status-banner {
      margin-top: 14px;
      padding: 14px 16px;
      border-radius: 10px;
      border-left: 5px solid ${finalMeta.color};
      background: ${finalMeta.bg};
    }

    .status-title {
      font-size: 16px;
      font-weight: 800;
      color: ${finalMeta.color};
      margin-bottom: 6px;
    }

    .status-text {
      color: #334155;
    }

    .two-col {
      display: table;
      width: 100%;
      table-layout: fixed;
    }

    .col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 8px;
    }

    .col:last-child {
      padding-right: 0;
      padding-left: 8px;
    }

    .info-row {
      display: table;
      width: 100%;
      margin-bottom: 8px;
      border-bottom: 1px solid #eef2f7;
      padding-bottom: 8px;
    }

    .info-label,
    .info-value {
      display: table-cell;
      vertical-align: top;
    }

    .info-label {
      width: 42%;
      color: #64748b;
      font-weight: 600;
    }

    .info-value {
      font-weight: 700;
      text-align: right;
    }

    .timeline-item {
      display: table;
      width: 100%;
      margin-bottom: 10px;
    }

    .timeline-date,
    .timeline-content {
      display: table-cell;
      vertical-align: top;
    }

    .timeline-date {
      width: 34%;
      color: #475569;
      font-weight: 700;
      padding-right: 10px;
    }

    .timeline-title {
      font-weight: 700;
      margin-bottom: 2px;
    }

    .timeline-detail {
      color: #64748b;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }

    thead th {
      background: #163766;
      color: #fff;
      text-align: left;
      padding: 8px 9px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    tbody td {
      border-bottom: 1px solid #e9eef5;
      padding: 8px 9px;
      vertical-align: top;
    }

    tbody tr:nth-child(even) {
      background: #fbfcfe;
    }

    .cell-title {
      font-weight: 700;
      margin-bottom: 2px;
    }

    .cell-subtitle {
      color: #64748b;
      font-size: 9px;
    }

    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 3px 8px;
      font-weight: 800;
      font-size: 9px;
    }

    .raw-block {
      margin-top: 6px;
      padding: 8px 10px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    .raw-title {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .raw-value {
      color: #334155;
      line-height: 1.6;
    }

    .sub-row td {
      background: #f8fafc;
    }

    .empty-cell {
      color: #64748b;
      text-align: center;
      padding: 14px;
      font-style: italic;
    }

    .footer-note {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px solid #dbe3ee;
      color: #64748b;
      font-size: 9.5px;
      line-height: 1.7;
      display: table;
      width: 100%;
    }

    .footer-note div {
      display: table-cell;
      vertical-align: top;
    }

    .footer-note .right {
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-grid">
      <div class="header-left">
        <div class="eyebrow">Compte rendu professionnel de conformité LCB-FT</div>
        <div class="logo-lockup">
          <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 40 40" style="flex-shrink:0">
            <polygon points="20,2 38,20 20,38 2,20" stroke="#BFA063" stroke-width="1.5" fill="none"/>
            <text x="20" y="27" text-anchor="middle" font-size="20" font-family="Georgia, 'Times New Roman', serif" fill="white">K</text>
          </svg>
          <div class="brand-text">
            <div class="brand"><span class="brand-accent">K</span>onfirme</div>
            <div class="brand-sep"></div>
            <div class="brand-tagline">Compliance Intelligence</div>
          </div>
        </div>
        <div class="subtitle">Synthèse complète des recherches, retours scrappés, validations et arbitrages du dossier</div>
      </div>
      <div class="header-right">
        <div><strong>Dossier :</strong> ${escapeHtml(input.dossierId)}</div>
        <div><strong>Date d’édition :</strong> ${escapeHtml(formatDateTime(new Date()))}</div>
        <div><strong>Agence :</strong> ${escapeHtml(input.branchName || 'Non renseignée')}</div>
        <div><strong>Opérateur :</strong> ${escapeHtml(input.agentName || 'Non renseigné')}</div>
      </div>
    </div>
    <div class="identity-strip">
      <div class="identity-name">${escapeHtml(`${input.identity.prenom} ${input.identity.nom}`.trim() || 'Identité non renseignée')}</div>
      <div>Nationalité : ${escapeHtml(input.identity.nationalite || 'Non renseignée')} · Date de naissance : ${escapeHtml(input.identity.dateNaissance || 'Non renseignée')}</div>
      <div>Document : ${escapeHtml(input.identity.docType || 'Non renseigné')} · Numéro : ${escapeHtml(input.identity.numeroDocument || 'Non renseigné')}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Synthèse décisionnelle</div>
    <div class="section-body">
      <div class="hero-summary">
        <div class="hero-box">
          <div class="hero-value" style="color:${scoreColor(input.scoring.scoreFinal)}">${input.scoring.scoreFinal}</div>
          <div class="hero-label">Score global</div>
        </div>
        <div class="hero-box">
          <div class="hero-value" style="color:${activeAlerts > 0 ? '#B91C1C' : '#64748B'}">${activeAlerts}</div>
          <div class="hero-label">Alertes actives</div>
        </div>
        <div class="hero-box">
          <div class="hero-value" style="color:${activeWarnings > 0 ? '#B45309' : '#64748B'}">${activeWarnings}</div>
          <div class="hero-label">Avertissements</div>
        </div>
        <div class="hero-box">
          <div class="hero-value" style="color:${ignoredAlerts > 0 ? '#475569' : '#64748B'}">${ignoredAlerts}</div>
          <div class="hero-label">Faux positifs validés</div>
        </div>
      </div>

      <div class="status-banner">
        <div class="status-title">${escapeHtml(finalMeta.label)}</div>
        <div class="status-text">${escapeHtml(input.validation?.summary ?? 'Analyse de score complète')}</div>
        <div class="status-text" style="margin-top:6px"><strong>Conclusion :</strong> ${escapeHtml(finalMeta.conclusion)}</div>
      </div>
    </div>
  </div>

  <div class="two-col" style="margin-bottom: 16px;">
    <div class="col">
      <div class="section">
        <div class="section-title">Situation dossier</div>
        <div class="section-body">
          <div class="info-row"><div class="info-label">Type d’opération</div><div class="info-value">${escapeHtml(input.dossier.type || 'Non renseigné')}</div></div>
          <div class="info-row"><div class="info-label">Type de client</div><div class="info-value">${escapeHtml(input.dossier.clientType || 'Non renseigné')}</div></div>
          <div class="info-row"><div class="info-label">Montant</div><div class="info-value">${escapeHtml(formatCurrency(input.dossier.montant))}</div></div>
          <div class="info-row"><div class="info-label">Seuil LCB-FT</div><div class="info-value">${escapeHtml(input.dossier.seuilLCBFT || 'Non déterminé')}</div></div>
          <div class="info-row"><div class="info-label">Moyen de paiement</div><div class="info-value">${escapeHtml(asText(input.dossier.moyenPaiement?.type || input.dossier.moyenPaiement))}</div></div>
          <div class="info-row" style="border-bottom:none;padding-bottom:0;margin-bottom:0"><div class="info-label">Intermédiaire</div><div class="info-value">${escapeHtml(input.dossier.intermediaire ? 'Oui' : 'Non')}</div></div>
        </div>
      </div>
    </div>
    <div class="col">
      <div class="section">
        <div class="section-title">Chronologie de traitement</div>
        <div class="section-body">
          ${buildTimeline(input)}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Lecture analytique du scoring</div>
    <div class="section-body">
      <div class="two-col">
        <div class="col">
          <div class="info-row"><div class="info-label">Décision scoring</div><div class="info-value">${escapeHtml(input.scoring.decision)}</div></div>
          <div class="info-row"><div class="info-label">Score PPE</div><div class="info-value">${input.scoring.scorePPE}/100</div></div>
          <div class="info-row"><div class="info-label">Score signaux</div><div class="info-value">${input.scoring.scoreSignaux}/100</div></div>
          <div class="info-row" style="border-bottom:none;padding-bottom:0;margin-bottom:0"><div class="info-label">Score pays</div><div class="info-value">${input.scoring.scorePays}/100</div></div>
        </div>
        <div class="col">
          <div class="info-row"><div class="info-label">Score réputation</div><div class="info-value">${input.scoring.scoreReputation}/100</div></div>
          <div class="info-row"><div class="info-label">Date de calcul</div><div class="info-value">${escapeHtml(formatDateTime(input.scoring.calculatedAt))}</div></div>
          <div class="info-row" style="border-bottom:none;padding-bottom:0;margin-bottom:0"><div class="info-label">Justification</div><div class="info-value" style="text-align:left">${escapeHtml(input.scoring.justification)}</div></div>
        </div>
      </div>
    </div>
  </div>

  <div class="section page-break">
    <div class="section-title">Retours récupérés et scrappés</div>
    <div class="section-body">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Source</th>
            <th>Résumé</th>
            <th>Détail consolidé</th>
            <th>Statut</th>
            <th>Confiance</th>
          </tr>
        </thead>
        <tbody>
          ${buildVerificationRows(input.verificationResults)}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Recherches effectuées et retours collectés</div>
    <div class="section-body">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Recherche</th>
            <th>Statut</th>
            <th>Confiance</th>
            <th>Horodatage</th>
            <th>Retour récupéré</th>
          </tr>
        </thead>
        <tbody>
          ${buildRechercheRows(input.recherches)}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Arbitrages, validations et justification humaine</div>
    <div class="section-body">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Exception / sujet</th>
            <th>Décision</th>
            <th>Justification</th>
          </tr>
        </thead>
        <tbody>
          ${buildDecisionRows(input.validation?.decisions ?? [])}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Cadre documentaire et conclusion</div>
    <div class="section-body">
      <div style="margin-bottom:10px">Ce compte rendu rassemble l’ensemble des recherches effectuées, des retours automatisés récupérés, des données scrappées par source et des validations réalisées sur le dossier. Il est destiné à constituer une pièce de synthèse exploitable en revue interne, contrôle qualité ou audit conformité.</div>
      <div style="margin-bottom:10px">Références de conformité mobilisées : Code monétaire et financier, vigilance LCB-FT, traitement des PPE, sanctions internationales, gel des avoirs, revue réputationnelle et traçabilité des décisions.</div>
      <div><strong>Conclusion finale :</strong> ${escapeHtml(finalMeta.conclusion)}</div>
    </div>
  </div>

  <div class="footer-note">
    <div>
      <div><strong>Konfirme</strong> · Compliance Intelligence · Compte rendu de conformité LCB-FT</div>
      <div>Document confidentiel généré et archivé automatiquement le ${escapeHtml(formatDateTime(new Date()))}</div>
      <div>Conservation légale 5 ans — Art. L. 561-12 CMF · Directive UE 2015/849</div>
    </div>
    <div class="right">
      <div>Dossier ${escapeHtml(input.dossierId)}</div>
      <div>${escapeHtml(finalMeta.label)}</div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateAndSharePDF(input: ReportInput): Promise<void> {
	const html = buildHtml(input);
	const { uri } = await Print.printToFileAsync({ html, base64: false });

	// Partage immédiat avec l'utilisateur
	await Sharing.shareAsync(uri, {
		mimeType: 'application/pdf',
		dialogTitle: `Compte rendu conformité — ${input.dossierId}`,
		UTI: 'com.adobe.pdf',
	});

	// Archivage asynchrone côté serveur (non-bloquant)
	if (input.authToken) {
		uploadPdfPourArchivage(input.dossierId, uri, input.authToken).catch(() => {
			// Silencieux : l'archivage automatique sera déclenché côté backend
			// lors de la transition de statut. Cet upload est un complément.
		});
	}
}

/**
 * Génère, partage et archive le PDF de conformité en une seule opération.
 * Retourne le résultat de l'archivage si disponible.
 */
export async function generateShareAndArchive(
	input: ReportInput & { authToken: string }
): Promise<{ shared: true; archived: boolean }> {
	const html = buildHtml(input);
	const { uri } = await Print.printToFileAsync({ html, base64: false });

	// Partage
	await Sharing.shareAsync(uri, {
		mimeType: 'application/pdf',
		dialogTitle: `Compte rendu conformité — ${input.dossierId}`,
		UTI: 'com.adobe.pdf',
	});

	// Archivage
	try {
		await uploadPdfPourArchivage(input.dossierId, uri, input.authToken);
		return { shared: true, archived: true };
	} catch {
		return { shared: true, archived: false };
	}
}
