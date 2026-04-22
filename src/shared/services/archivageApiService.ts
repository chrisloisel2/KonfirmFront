/**
 * Service API d'archivage LCB-FT
 *
 * Gère tous les appels vers /api/archivage :
 *  - Upload d'un PDF pour archivage
 *  - Liste des archives d'un dossier
 *  - Vérification d'intégrité
 *  - Téléchargement du Certificat de Conformité
 *  - Téléchargement du PDF archivé
 *  - Déclaration de fin de relation d'affaires
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_BASE } from '../config/api';

export interface ArchivedPdfItem {
  id: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  sha256Hash: string;
  sealCertFingerprint: string;
  timestampTime: string | null;
  timestampTsa: string | null;
  isPdfa: boolean;
  retentionExpiry: string;
  isImmutable: boolean;
  archivedAt: string;
  triggerStatus: string | null;
}

export interface ArchivageResult {
  archiveId: string;
  sha256Hash: string;
  sealCertFingerprint: string;
  hasTimestamp: boolean;
  timestampTime: string | null;
  retentionExpiry: string;
  archivedAt: string;
  isPdfa: boolean;
}

export interface IntegrityResult {
  archiveId: string;
  dossierId: string;
  filename: string;
  sha256Hash: string;
  integrityValid: boolean;
  retentionExpiry: string;
  retentionExpired: boolean;
  verifiedAt: string;
}

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Soumet un PDF généré côté client pour archivage complet côté serveur.
 * Le fichier est lu depuis son URI Expo et envoyé en multipart/form-data.
 */
export async function uploadPdfPourArchivage(
  dossierId: string,
  fileUri: string,
  token: string
): Promise<ArchivageResult> {
  const filename = `rapport-lcbft-${dossierId}.pdf`;

  // Lecture du fichier en base64 puis construction du FormData
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64
  });

  const formData = new FormData();
  formData.append('pdf', {
    uri: fileUri,
    name: filename,
    type: 'application/pdf'
  } as any);

  const response = await fetch(`${API_BASE}/archivage/${dossierId}/pdf`, {
    method: 'POST',
    headers: headers(token),
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Archivage échoué (${response.status})`);
  }

  const json = await response.json();
  return json.data as ArchivageResult;
}

/**
 * Récupère la liste des archives d'un dossier.
 */
export async function getArchivesDossier(
  dossierId: string,
  token: string
): Promise<ArchivedPdfItem[]> {
  const response = await fetch(`${API_BASE}/archivage/${dossierId}`, {
    headers: headers(token)
  });

  if (!response.ok) throw new Error(`Impossible de récupérer les archives (${response.status})`);

  const json = await response.json();
  return (json.data?.archives ?? []) as ArchivedPdfItem[];
}

/**
 * Vérifie l'intégrité d'une archive (recalcul SHA-256 côté serveur).
 */
export async function verifierIntegrite(
  dossierId: string,
  archiveId: string,
  token: string
): Promise<IntegrityResult> {
  const response = await fetch(`${API_BASE}/archivage/${dossierId}/${archiveId}/verifier`, {
    headers: headers(token)
  });

  if (!response.ok) throw new Error(`Vérification impossible (${response.status})`);

  const json = await response.json();
  return json.data as IntegrityResult;
}

/**
 * Télécharge et partage le Certificat de Conformité d'Archivage (PDF officiel).
 * Ce document est la preuve opposable aux autorités (ACPR, TRACFIN, etc.)
 */
export async function telechargerEtPartagerCertificat(
  dossierId: string,
  archiveId: string,
  numeroDossier: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/archivage/${dossierId}/${archiveId}/certificat`,
    { headers: headers(token) }
  );

  if (!response.ok) throw new Error(`Génération du certificat impossible (${response.status})`);

  const arrayBuffer = await response.arrayBuffer();
  const base64 = _arrayBufferToBase64(arrayBuffer);

  const tempPath = FileSystem.cacheDirectory + `certificat-${archiveId.slice(-8)}.pdf`;
  await FileSystem.writeAsStringAsync(tempPath, base64, {
    encoding: FileSystem.EncodingType.Base64
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(tempPath, {
      mimeType: 'application/pdf',
      dialogTitle: `Certificat de conformité — Dossier ${numeroDossier}`,
      UTI: 'com.adobe.pdf'
    });
  }
}

/**
 * Télécharge et partage le PDF archivé (document source scellé).
 */
export async function telechargerPdfArchive(
  dossierId: string,
  archiveId: string,
  filename: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/archivage/${dossierId}/${archiveId}/telecharger`,
    { headers: headers(token) }
  );

  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status})`);

  const arrayBuffer = await response.arrayBuffer();
  const base64 = _arrayBufferToBase64(arrayBuffer);

  const tempPath = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(tempPath, base64, {
    encoding: FileSystem.EncodingType.Base64
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(tempPath, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf'
    });
  }
}

/**
 * Enregistre la date de cessation de la relation d'affaires
 * et recalcule la rétention légale sur toutes les archives du dossier.
 */
export async function enregistrerFinRelation(
  dossierId: string,
  dateFinRelationAffaires: Date,
  token: string
): Promise<{ retentionExpiry: string; message: string }> {
  const response = await fetch(`${API_BASE}/archivage/${dossierId}/fin-relation`, {
    method: 'PATCH',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateFinRelationAffaires: dateFinRelationAffaires.toISOString() })
  });

  if (!response.ok) throw new Error(`Mise à jour impossible (${response.status})`);

  const json = await response.json();
  return json.data;
}

function _arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
