import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { Text, Card, TextInput, Button, ActivityIndicator, Chip } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { OCRData } from '../../shared/types';
import { colors, spacing, radius } from '../../shared/theme/theme';
import { MaterialIcons } from '@expo/vector-icons';

// Écrans 11-12 selon rules.md: OCR/MRZ + Résultat OCR avec correction

interface CaptureData {
  docType: 'cni' | 'passeport';
  recto: string;
  verso?: string;
}

interface RouteParams {
  captureData: CaptureData;
}

interface OCRFormData {
  nom: string;
  prenom: string;
  dateNaissance: string;
  nationalite: string;
  numeroDocument: string;
  dateExpiration: string;
  confidence: number;
}

const ocrSchema = yup.object().shape({
  nom: yup.string().required('Le nom est requis'),
  prenom: yup.string().required('Le prénom est requis'),
  dateNaissance: yup.string()
    .required('La date de naissance est requise')
    .matches(/^\d{2}\/\d{2}\/\d{4}$/, 'Format attendu: JJ/MM/AAAA'),
  nationalite: yup.string().required('La nationalité est requise'),
  numeroDocument: yup.string().required('Le numéro de document est requis'),
  dateExpiration: yup.string()
    .required('La date d\'expiration est requise')
    .matches(/^\d{2}\/\d{2}\/\d{4}$/, 'Format attendu: JJ/MM/AAAA'),
});

export default function OCRResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { captureData } = (route.params as RouteParams) || {};

  const [isProcessing, setIsProcessing] = useState(true);
  const [ocrData, setOcrData] = useState<OCRData | null>(null);
  const [confidence, setConfidence] = useState(0);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<OCRFormData>({
    resolver: yupResolver(ocrSchema) as any,
    defaultValues: {
      nom: '',
      prenom: '',
      dateNaissance: '',
      nationalite: '',
      numeroDocument: '',
      dateExpiration: '',
      confidence: 0,
    },
  });

  useEffect(() => {
    performOCR();
  }, []);

  const performOCR = async () => {
    try {
      // TODO: Intégrer avec Tesseract.js ou service OCR backend

      // Simulation du traitement OCR
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Données simulées pour demo
      const extractedData: OCRFormData = {
        nom: 'MARTIN',
        prenom: 'Jean Pierre',
        dateNaissance: '15/03/1985',
        nationalite: 'Française',
        numeroDocument: captureData.docType === 'cni' ? '123456789' : 'AB1234567',
        dateExpiration: '15/03/2030',
        confidence: 0.92,
      };

      setOcrData(extractedData as any);
      setConfidence(extractedData.confidence);

      // Remplir le formulaire avec les données extraites
      setValue('nom', extractedData.nom);
      setValue('prenom', extractedData.prenom);
      setValue('dateNaissance', extractedData.dateNaissance);
      setValue('nationalite', extractedData.nationalite);
      setValue('numeroDocument', extractedData.numeroDocument);
      setValue('dateExpiration', extractedData.dateExpiration);

    } catch (error) {
      console.error('Erreur OCR:', error);
      Alert.alert(
        'Erreur OCR',
        'Impossible d\'extraire les données du document. Veuillez les saisir manuellement.',
        [
          { text: 'Reprendre photo', onPress: () => navigation.goBack() },
          { text: 'Saisie manuelle', onPress: () => setIsProcessing(false) },
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const onSubmit = (data: OCRFormData) => {
    // Validation des dates
    const birthDate = parseFrenchDate(data.dateNaissance);
    const expirationDate = parseFrenchDate(data.dateExpiration);

    if (!birthDate || !expirationDate) {
      Alert.alert('Erreur', 'Veuillez vérifier le format des dates');
      return;
    }

    if (expirationDate < new Date()) {
      Alert.alert(
        'Document expiré',
        'Ce document est expiré. Impossible de continuer.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Vérification de cohérence des données
    if (hasDataInconsistency(data)) {
      Alert.alert(
        'Incohérence détectée',
        'Les données extraites semblent incohérentes. Veuillez vérifier.',
        [
          { text: 'Corriger', style: 'cancel' },
          { text: 'Continuer quand même', onPress: () => proceedWithData(data) },
        ]
      );
      return;
    }

    proceedWithData(data);
  };

  const parseFrenchDate = (dateStr: string): Date | null => {
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const [, day, month, year] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  };

  const hasDataInconsistency = (data: OCRFormData): boolean => {
    // Vérifications basiques de cohérence
    const birthDate = parseFrenchDate(data.dateNaissance);
    if (birthDate && birthDate > new Date()) {
      return true; // Date de naissance dans le futur
    }

    // Autres vérifications possibles
    return false;
  };

  const proceedWithData = (data: OCRFormData) => {
    const documentData = {
      ...captureData,
      ocrData: data,
      confidence,
      isManuallyEdited: isDirty,
    };

    // Navigation vers vérification identité
    // @ts-ignore - Navigation typée
    navigation.navigate('IdentityVerification', { documentData });
  };

  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.9) return colors.success;
    if (conf >= 0.7) return colors.warning;
    return colors.error;
  };

  const getConfidenceLabel = (conf: number): string => {
    if (conf >= 0.9) return 'Très fiable';
    if (conf >= 0.7) return 'Fiable';
    return 'Peu fiable';
  };

  if (isProcessing) {
    return (
      <View style={styles.processingContainer}>
        <Card style={styles.processingCard}>
          <Card.Content style={styles.processingContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingTitle}>Extraction en cours</Text>
            <Text style={styles.processingText}>
              Analyse du document avec OCR...
            </Text>

            {captureData && (
              <Image
                source={{ uri: captureData.recto }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Vérification des données</Text>
        {confidence > 0 && (
          <Chip
            mode="outlined"
            style={[styles.confidenceChip, { borderColor: getConfidenceColor(confidence) }]}
            textStyle={{ color: getConfidenceColor(confidence) }}
            icon={() => (
              <MaterialIcons
                name={confidence >= 0.9 ? 'check-circle' : confidence >= 0.7 ? 'warning' : 'error'}
                size={16}
                color={getConfidenceColor(confidence)}
              />
            )}
          >
            {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
          </Chip>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Document preview */}
        {captureData && (
          <Card style={styles.previewCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Document scanné</Text>
              <Image
                source={{ uri: captureData.recto }}
                style={styles.documentPreview}
                resizeMode="contain"
              />
            </Card.Content>
          </Card>
        )}

        {/* Données extraites */}
        <Card style={styles.formCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>
              Données extraites - Corrigez si nécessaire
            </Text>

            <Controller
              control={control}
              name="nom"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label="Nom de famille"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.nom}
                  style={styles.input}
                  autoCapitalize="characters"
                />
              )}
            />
            {errors.nom && <Text style={styles.errorText}>{errors.nom.message}</Text>}

            <Controller
              control={control}
              name="prenom"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label="Prénom(s)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.prenom}
                  style={styles.input}
                  autoCapitalize="words"
                />
              )}
            />
            {errors.prenom && <Text style={styles.errorText}>{errors.prenom.message}</Text>}

            <Controller
              control={control}
              name="dateNaissance"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label="Date de naissance"
                  placeholder="JJ/MM/AAAA"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.dateNaissance}
                  style={styles.input}
                  keyboardType="numeric"
                />
              )}
            />
            {errors.dateNaissance && <Text style={styles.errorText}>{errors.dateNaissance.message}</Text>}

            <Controller
              control={control}
              name="nationalite"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label="Nationalité"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.nationalite}
                  style={styles.input}
                  autoCapitalize="words"
                />
              )}
            />
            {errors.nationalite && <Text style={styles.errorText}>{errors.nationalite.message}</Text>}

            <Controller
              control={control}
              name="numeroDocument"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label={`Numéro ${captureData?.docType === 'cni' ? 'CNI' : 'passeport'}`}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.numeroDocument}
                  style={styles.input}
                  autoCapitalize="characters"
                />
              )}
            />
            {errors.numeroDocument && <Text style={styles.errorText}>{errors.numeroDocument.message}</Text>}

            <Controller
              control={control}
              name="dateExpiration"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label="Date d'expiration"
                  placeholder="JJ/MM/AAAA"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.dateExpiration}
                  style={styles.input}
                  keyboardType="numeric"
                />
              )}
            />
            {errors.dateExpiration && <Text style={styles.errorText}>{errors.dateExpiration.message}</Text>}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
        >
          Reprendre photo
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          style={styles.confirmButton}
        >
          Confirmer
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  processingCard: {
    elevation: 3,
  },
  processingContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: spacing.md,
    textAlign: 'center',
  },
  processingText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  previewImage: {
    width: 200,
    height: 120,
    borderRadius: radius.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    elevation: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  confidenceChip: {
    marginLeft: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  previewCard: {
    marginBottom: spacing.lg,
    elevation: 2,
  },
  documentPreview: {
    width: '100%',
    height: 150,
    marginTop: spacing.sm,
    borderRadius: radius.sm,
  },
  formCard: {
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  actions: {
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
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
});
