import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert, Dimensions, TouchableOpacity, Image, Platform } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../shared/theme/theme';
import { useAuth } from '../../shared/services/AuthContext';
import { API_BASE } from '../../shared/config/api';

const { width: screenWidth } = Dimensions.get('window');

interface RouteParams {
  docType?: 'cni' | 'passeport';
  side?: 'recto' | 'verso';
  rectoUri?: string;
  dossierData?: any;
}

class AuthSessionError extends Error {
  constructor(message = 'Session expirée') {
    super(message);
    this.name = 'AuthSessionError';
  }
}

export default function DocumentCaptureScreen() {
  const navigation = useNavigation();
  const { token, logout } = useAuth();
  const route = useRoute();
  const { docType, side = 'recto', rectoUri, dossierData } = (route.params as RouteParams) || {};

  const cameraRef = useRef<CameraView>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'L\'accès à l\'appareil photo est nécessaire pour scanner les documents.',
          [
            { text: 'Annuler', onPress: () => navigation.goBack() },
          ]
        );
      }
    } catch {
      setHasPermission(false);
    }
  };

  // ── Galerie ──────────────────────────────────────────────────────────────────

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie dans les paramètres.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: docType === 'passeport' ? [3, 4] : [85, 54],
    });
    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const confirmPickedImage = async () => {
    if (!previewUri) return;
    setPreviewUri(null);
    await processPhoto(previewUri);
  };

  // ── Caméra ───────────────────────────────────────────────────────────────────

  const capturePhoto = async () => {
    if (!cameraRef.current || !isReady || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false, skipProcessing: false });
      if (photo) await processPhoto(photo.uri);
    } catch {
      Alert.alert('Erreur de capture', 'Impossible de prendre la photo. Veuillez réessayer.', [{ text: 'OK' }]);
    } finally {
      setIsCapturing(false);
    }
  };

  // ── Pipeline commun ──────────────────────────────────────────────────────────

  const processPhoto = async (photoUri: string) => {
    if (docType === 'cni' && side === 'recto') {
      // @ts-ignore
      navigation.navigate('DocumentCapture', { docType, side: 'verso', rectoUri: photoUri, dossierData });
    } else {
      await runOCRAndNavigate(photoUri);
    }
  };

  const runOCRAndNavigate = async (photoUri: string) => {
    setIsCapturing(true);
    try {
      const identityData = await callOCRApi(photoUri);
      // @ts-ignore
      navigation.navigate('IdentityVerification', { identityData, dossierData, docType, photoUri });
    } catch (err) {
      if (err instanceof AuthSessionError) {
        await logout();
        Alert.alert(
          'Session expirée',
          'Reconnectez-vous pour relancer l’extraction du document.',
          [{
            text: 'Se reconnecter',
            onPress: () => {
              // @ts-ignore
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            },
          }]
        );
        return;
      }
      console.warn('[OCR] Unexpected error, navigating without data:', err);
      // @ts-ignore
      navigation.navigate('IdentityVerification', { identityData: null, dossierData, docType, photoUri });
    } finally {
      setIsCapturing(false);
    }
  };

  /**
   * Envoie l'image au backend OCR.
   * Stratégie :
   *   1. multipart/form-data  (méthode native : iOS/Android)
   *   2. JSON base64          (fallback web + si multer échoue)
   */
  const callOCRApi = async (photoUri: string): Promise<any> => {
    if (!token) {
      throw new AuthSessionError();
    }

    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const API = `${API_BASE}/documents/extract-identity`;
    const dt  = docType ?? 'cni';

    // ── Tentative 1 : multipart  ────────────────────────────────────────────
    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // Sur web, photoUri est une blob: ou data: URL → fetch → Blob → File
        const blobRes  = await fetch(photoUri);
        const blob     = await blobRes.blob();
        const mimeType = blob.type || 'image/jpeg';
        const ext      = mimeType.split('/')[1] ?? 'jpg';
        const file     = new File([blob], `id_photo.${ext}`, { type: mimeType });
        formData.append('image', file);
      } else {
        // Sur iOS/Android, React Native gère les URI fichier nativement
        const ext  = photoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const mime = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg';
        formData.append('image', { uri: photoUri, type: mime, name: `id_photo.${ext}` } as any);
      }

      formData.append('docType', dt);

      const res  = await fetch(API, { method: 'POST', headers, body: formData });
      const json = await res.json();

      if (res.status === 401 || res.status === 403) {
        throw new AuthSessionError(json?.message || json?.error || 'Session expirée');
      }

      if (json.success && json.data?.nom) return json.data;
      // Si multer a reçu le fichier mais OCR vide → tenter base64
    } catch (e) {
      if (e instanceof AuthSessionError) throw e;
      console.warn('[OCR] multipart failed, trying base64:', e);
    }

    // ── Tentative 2 : JSON base64 ───────────────────────────────────────────
    try {
      let base64: string;

      if (Platform.OS === 'web') {
        const blobRes = await fetch(photoUri);
        const blob    = await blobRes.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror   = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: 'base64',
        });
      }

      const res  = await fetch(`${API}-base64`, {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, docType: dt }),
      });
      const json = await res.json();

      if (res.status === 401 || res.status === 403) {
        throw new AuthSessionError(json?.message || json?.error || 'Session expirée');
      }

      if (json.success) return json.data ?? null;
    } catch (e) {
      if (e instanceof AuthSessionError) throw e;
      console.warn('[OCR] base64 fallback also failed:', e);
    }

    return null;
  };

  // ── Flash ────────────────────────────────────────────────────────────────────

  const toggleFlash = () => {
    setFlashMode(cur => {
      if (cur === 'off') return 'on';
      if (cur === 'on')  return 'auto';
      return 'off';
    });
  };

  const flashIcon = flashMode === 'on' ? 'flash-on' : flashMode === 'auto' ? 'flash-auto' : 'flash-off';

  const documentGuide = docType === 'cni'
    ? (side === 'recto' ? 'Placez la face avant de votre carte d\'identité dans le cadre' : 'Placez la face arrière dans le cadre')
    : 'Placez votre passeport ouvert sur la page biométrique';

  // ── Preview après sélection galerie ──────────────────────────────────────────

  if (previewUri) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Vérifier l'image</Text>
          <Text style={styles.instruction}>Assurez-vous que le document est lisible et complet</Text>
        </View>
        <View style={styles.previewContainer}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
        </View>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.galleryBtn} onPress={() => setPreviewUri(null)}>
            <MaterialIcons name="arrow-back" size={20} color="white" />
            <Text style={styles.galleryBtnText}>Choisir une autre</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureButtonTouch, isCapturing && { opacity: 0.6 }]}
            onPress={confirmPickedImage}
            disabled={isCapturing}
            activeOpacity={0.8}
          >
            {isCapturing
              ? <ActivityIndicator size="small" color="white" />
              : <MaterialIcons name="check" size={32} color="white" />
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Chargement permission ─────────────────────────────────────────────────────

  if (hasPermission === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Demande d'autorisation…</Text>
      </View>
    );
  }

  // ── Si caméra refusée : uniquement galerie ────────────────────────────────────

  if (hasPermission === false) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="camera-alt" size={64} color={colors.border} />
        <Text style={styles.errorTitle}>Caméra non disponible</Text>
        <Text style={styles.errorText}>
          Vous pouvez tout de même charger une photo depuis votre galerie.
        </Text>
        <TouchableOpacity style={styles.galleryFallbackBtn} onPress={pickFromGallery}>
          <MaterialIcons name="photo-library" size={20} color="white" />
          <Text style={styles.galleryFallbackText}>Choisir depuis la galerie</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Écran principal : caméra + bouton galerie ─────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {docType === 'cni' ? 'Carte d\'identité' : 'Passeport'}
          {docType === 'cni' && ` — ${side === 'recto' ? 'Recto' : 'Verso'}`}
        </Text>
        <Text style={styles.instruction}>{documentGuide}</Text>
      </View>

      {/* Caméra */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          flash={flashMode}
          onCameraReady={() => setIsReady(true)}
        >
          <View style={styles.overlay}>
            <View style={styles.topOverlay} />
            <View style={styles.middleRow}>
              <View style={styles.sideOverlay} />
              <View style={styles.documentFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.sideOverlay} />
            </View>
            <View style={styles.bottomOverlay} />
          </View>
        </CameraView>
      </View>

      {/* Contrôles */}
      <View style={styles.controls}>
        {/* Ligne annuler + flash */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
            <MaterialIcons name={flashIcon as any} size={20} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
        </View>

        {/* Boutons principaux */}
        <View style={styles.mainControls}>
          {/* Galerie */}
          <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery} disabled={isCapturing}>
            <MaterialIcons name="photo-library" size={22} color="white" />
            <Text style={styles.galleryBtnText}>Galerie</Text>
          </TouchableOpacity>

          {/* Déclencheur */}
          <TouchableOpacity
            style={[styles.captureButtonTouch, (!isReady || isCapturing) && { opacity: 0.5 }]}
            onPress={capturePhoto}
            disabled={!isReady || isCapturing}
            activeOpacity={0.8}
          >
            {isCapturing
              ? <ActivityIndicator size="small" color="white" />
              : <View style={styles.captureInner} />
            }
          </TouchableOpacity>

          {/* Espace symétrique */}
          <View style={{ width: 70 }} />
        </View>

        <Text style={styles.helpText}>
          Cadrez le document entier, bonne lumière
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textPrimary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  galleryFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  galleryFallbackText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  backLink: { marginTop: spacing.sm },
  backLinkText: { color: colors.textSecondary, fontSize: 14 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: 'white',
    marginBottom: spacing.xs,
  },
  instruction: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1 },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  middleRow: { flexDirection: 'row', height: 200 },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  documentFrame: {
    width: screenWidth * 0.78,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: colors.accent,
    borderWidth: 3,
  },
  topLeft:    { top: 0,    left: 0,  borderRightWidth: 0, borderBottomWidth: 0 },
  topRight:   { top: 0,    right: 0, borderLeftWidth: 0,  borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight:{ bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0 },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  iconBtn: {
    padding: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  galleryBtn: {
    width: 70,
    alignItems: 'center',
    gap: 4,
  },
  galleryBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  captureButtonTouch: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'white',
  },
  helpText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});
