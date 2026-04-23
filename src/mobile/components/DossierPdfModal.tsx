import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../shared/services/AuthContext';
import { API_BASE } from '../../shared/config/api';
import { colors, radius, shadows } from '../../shared/theme/theme';

interface DossierPdfModalProps {
  dossierId: string;
  numeroDossier?: string;
  children: (open: () => void) => React.ReactNode;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; blobUrl: string }
  | { kind: 'error'; message: string };

export default function DossierPdfModal({ dossierId, numeroDossier, children }: DossierPdfModalProps) {
  const { token } = useAuth();
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });

  const open = useCallback(async () => {
    if (!token) return;
    setVisible(true);
    setState({ kind: 'loading' });

    try {
      // 1. Récupérer la liste des archives du dossier
      const listRes = await fetch(`${API_BASE}/archivage/${dossierId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) throw new Error(`Archives introuvables (${listRes.status})`);

      const listJson = await listRes.json();
      const archives: Array<{ id: string; filename: string; archivedAt: string }> =
        listJson.data?.archives ?? [];

      if (archives.length === 0) {
        setState({ kind: 'error', message: 'Aucun rapport PDF archivé pour ce dossier.' });
        return;
      }

      // 2. Prendre la dernière archive (déjà triée desc par le backend)
      const latest = archives[0];

      // 3. Télécharger le PDF binaire
      const pdfRes = await fetch(
        `${API_BASE}/archivage/${dossierId}/${latest.id}/telecharger`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!pdfRes.ok) throw new Error(`Téléchargement échoué (${pdfRes.status})`);

      const buffer = await pdfRes.arrayBuffer();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      setState({ kind: 'ready', blobUrl });
    } catch (err: any) {
      setState({ kind: 'error', message: err?.message ?? 'Erreur lors du chargement du PDF' });
    }
  }, [dossierId, token]);

  const close = useCallback(() => {
    if (state.kind === 'ready') {
      URL.revokeObjectURL(state.blobUrl);
    }
    setState({ kind: 'idle' });
    setVisible(false);
  }, [state]);

  return (
    <>
      {children(open)}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MaterialIcons name="picture-as-pdf" size={18} color={colors.error} />
                <Text style={styles.title}>
                  {numeroDossier ? `Rapport — ${numeroDossier}` : 'Rapport PDF'}
                </Text>
              </View>
              <TouchableOpacity onPress={close} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Contenu */}
            <View style={styles.body}>
              {state.kind === 'loading' && (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Chargement du rapport…</Text>
                </View>
              )}

              {state.kind === 'error' && (
                <View style={styles.center}>
                  <MaterialIcons name="error-outline" size={40} color={colors.textTertiary} />
                  <Text style={styles.errorText}>{state.message}</Text>
                </View>
              )}

              {state.kind === 'ready' && Platform.OS === 'web' && (
                // @ts-ignore — iframe est valide uniquement sur web
                <iframe
                  src={state.blobUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Rapport PDF"
                />
              )}

              {state.kind === 'ready' && Platform.OS !== 'web' && (
                <View style={styles.center}>
                  <MaterialIcons name="check-circle" size={36} color={colors.success} />
                  <Text style={styles.loadingText}>PDF prêt — ouverture dans le lecteur système</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 860,
    height: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
  },
  body: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
