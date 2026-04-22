import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput as RNInput, StatusBar, Switch, Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import { MaterialIcons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../../shared/services/AuthContext';
import { API_BASE } from '../../shared/config/api';

// Interface étendue pour conformité LCB-FT GODECHOT PAULIET
interface NewDossierForm {
  clientType: 'physique' | 'moral';
  montant: string;
  docType: 'cni' | 'passeport';

  // Nouveaux champs intermédiaire (obligatoires selon procédures)
  hasIntermediaire: boolean;
  intermediaire?: {
    nom: string;
    prenom: string;
    numeroIdentite: string;
    lienClient: string;
    mandatType: 'email' | 'whatsapp' | 'attestation';
    mandatDescription: string;
  };

  // Nouveaux champs moyen de paiement (obligatoires LCB-FT)
  moyenPaiement: {
    type: 'carte' | 'especes' | 'virement' | 'cheque' | 'lien_paiement';
    origineCompte?: string;
    paysCompte?: string;
    bicSwift?: string;
    nombreLiensPaiement?: number;
    raison?: string;
  };
}

// Schema de validation étendu selon procédures GODECHOT PAULIET
const schema = yup.object().shape({
  clientType: yup.string().required('Sélectionnez un type de client'),
  montant: yup.string().required('Montant requis')
    .test('valid', 'Montant invalide', v => !isNaN(Number(v?.replace(',', '.'))))
    .test('positive', 'Montant doit être > 0', v => Number(v?.replace(',', '.')) > 0),
  docType: yup.string().required('Sélectionnez un type de pièce d\'identité'),

  // Validation intermédiaire
  hasIntermediaire: yup.boolean(),
  intermediaire: yup.object().when('hasIntermediaire', {
    is: true,
    then: (schema) => schema.shape({
      nom: yup.string().required('Nom de l\'intermédiaire requis'),
      prenom: yup.string().required('Prénom de l\'intermédiaire requis'),
      numeroIdentite: yup.string().required('Pièce d\'identité de l\'intermédiaire requise'),
      lienClient: yup.string().required('Lien avec le client requis'),
      mandatType: yup.string().required('Type de mandat requis'),
      mandatDescription: yup.string().required('Description du mandat requise')
    }),
    otherwise: (schema) => schema.nullable()
  }),

  // Validation moyen de paiement (obligatoire)
  moyenPaiement: yup.object().shape({
    type: yup.string().required('Moyen de paiement requis'),
    origineCompte: yup.string().when('type', {
      is: (type: string) => ['virement', 'cheque'].includes(type),
      then: (schema) => schema.required('Nom du titulaire du compte requis'),
      otherwise: (schema) => schema.nullable()
    }),
    paysCompte: yup.string().when('type', {
      is: 'virement',
      then: (schema) => schema.required('Pays du compte requis pour virement'),
      otherwise: (schema) => schema.nullable()
    }),
    nombreLiensPaiement: yup.number().when('type', {
      is: 'lien_paiement',
      then: (schema) => schema.min(1).max(3, 'Maximum 3 liens de paiement selon procédures LCB-FT'),
      otherwise: (schema) => schema.nullable()
    }),
    raison: yup.string().when('type', {
      is: 'lien_paiement',
      then: (schema) => schema.required('Raison de l\'utilisation de liens de paiement requise'),
      otherwise: (schema) => schema.nullable()
    })
  })
});

// Constantes étendues
const CLIENT_TYPES = [
  { key: 'physique', label: 'Personne physique', sub: 'Particulier', icon: 'person' },
  { key: 'moral', label: 'Personne morale', sub: 'Entreprise', icon: 'business' },
];

const DOC_TYPES = [
  { key: 'cni', label: 'Carte nationale d\'identité', sub: 'CNI recto/verso', icon: 'credit-card', accent: colors.accent },
  { key: 'passeport', label: 'Passeport', sub: 'Page biométrique', icon: 'menu-book', accent: '#7C3AED' },
];

const MOYENS_PAIEMENT = [
  { key: 'carte', label: 'Carte bancaire', sub: 'CB/VISA/Mastercard', icon: 'credit-card', accent: colors.primary },
  { key: 'especes', label: 'Espèces', sub: 'Liquide', icon: 'euro', accent: '#10B981' },
  { key: 'virement', label: 'Virement', sub: 'UE/EEE uniquement', icon: 'account-balance', accent: '#F59E0B' },
  { key: 'cheque', label: 'Chèque', sub: 'Chèque bancaire', icon: 'receipt', accent: '#8B5CF6' },
  { key: 'lien_paiement', label: 'Lien de paiement', sub: 'Max 3 liens', icon: 'link', accent: '#EF4444' },
];

const LIENS_CLIENT = [
  { key: 'famille', label: 'Famille' },
  { key: 'ami', label: 'Ami(e)' },
  { key: 'assistant', label: 'Assistant(e)' },
  { key: 'representant_legal', label: 'Représentant légal' },
  { key: 'tuteur', label: 'Tuteur/Curateur' },
  { key: 'autre', label: 'Autre' },
];

const MANDAT_TYPES = [
  { key: 'email', label: 'Email', icon: 'email' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'message' },
  { key: 'attestation', label: 'Attestation signée', icon: 'description' },
];

// Pays UE/EEE pour validation virements
const PAYS_UE_EEE = [
  'Allemagne', 'Autriche', 'Belgique', 'Bulgarie', 'Chypre', 'Croatie', 'Danemark',
  'Espagne', 'Estonie', 'Finlande', 'France', 'Grèce', 'Hongrie', 'Irlande', 'Italie',
  'Lettonie', 'Lituanie', 'Luxembourg', 'Malte', 'Pays-Bas', 'Pologne', 'Portugal',
  'République tchèque', 'Roumanie', 'Slovaquie', 'Slovénie', 'Suède',
  'Islande', 'Liechtenstein', 'Norvège'
];

class AuthSessionError extends Error {
  constructor(message = 'Session expirée') {
    super(message);
    this.name = 'AuthSessionError';
  }
}

export default function NewDossierScreen() {
  const navigation = useNavigation();
  const { token, logout } = useAuth();
  const [showIntermediaireDetails, setShowIntermediaireDetails] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { control, handleSubmit, watch, formState: { errors, isValid } } = useForm<NewDossierForm>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      clientType: undefined,
      montant: '',
      docType: undefined,
      hasIntermediaire: false,
      moyenPaiement: { type: undefined }
    },
    mode: 'onChange',
  });

  const montantNum = Number(watch('montant')?.replace(',', '.') || 0);
  const hasIntermediaire = watch('hasIntermediaire');
  const moyenPaiementType = watch('moyenPaiement.type');

  // Logique des seuils LCB-FT selon GODECHOT PAULIET
  const getSeuilInfo = () => {
    if (montantNum >= 15000) {
      return {
        label: 'Client occasionnel - Vigilance renforcée (≥ 15 000€)',
        color: colors.error,
        bg: colors.errorLight,
        icon: 'warning',
        type: 'occasionnel'
      };
    } else if (montantNum >= 10000) {
      return {
        label: 'Relation d\'affaires - Seuil standard (≥ 10 000€)',
        color: colors.warning,
        bg: colors.warningLight,
        icon: 'info',
        type: 'relation_affaires'
      };
    } else if (montantNum > 0) {
      return {
        label: 'Sous seuil déclaratif (< 10 000€)',
        color: colors.success,
        bg: colors.successLight,
        icon: 'check-circle',
        type: 'sans_seuil'
      };
    }
    return null;
  };

  const seuilInfo = getSeuilInfo();

  const validateMoyenPaiement = () => {
    if (moyenPaiementType === 'especes' && montantNum > 3000) {
      Alert.alert(
        'Attention - Espèces',
        'Paiement en espèces supérieur à 3 000€. Vérification d\'origine des fonds requise.',
        [{ text: 'Compris' }]
      );
    }
  };

  const onSubmit = async (data: NewDossierForm) => {
    if (!token) {
      await logout();
      // @ts-ignore
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }

    setIsCreating(true);

    try {
      const payload = {
        typeOuverture: 'achat',
        clientType: data.clientType,
        docType: data.docType,
        montantInitial: Number(data.montant.replace(',', '.')),
        intermediaire: data.hasIntermediaire ? {
          utilise: true,
          nom: data.intermediaire?.nom,
          prenom: data.intermediaire?.prenom,
          numeroIdentite: data.intermediaire?.numeroIdentite,
          lienClient: data.intermediaire?.lienClient,
          mandatPresent: true,
          mandatType: data.intermediaire?.mandatType,
          mandatDescription: data.intermediaire?.mandatDescription,
        } : { utilise: false },
        moyenPaiement: data.moyenPaiement,
        seuilLCBFT: seuilInfo?.type || 'sans_seuil',
      };

      const response = await fetch(`${API_BASE}/dossiers/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (response.status === 401 || response.status === 403) {
        throw new AuthSessionError(result?.message || result?.error || 'Session expirée');
      }

      if (!response.ok || !result?.success || !result.data?.dossier?.id) {
        throw new Error(result?.message || result?.error || 'Création du dossier impossible');
      }

      const createdDossier = result.data.dossier;
      const dossierData = {
        id: createdDossier.id,
        numero: createdDossier.numero,
        status: createdDossier.status,
        type: 'achat' as const,
        docType: data.docType,
        clientType: data.clientType,
        montant: Number(data.montant.replace(',', '.')),
        intermediaire: data.hasIntermediaire ? data.intermediaire : undefined,
        moyenPaiement: data.moyenPaiement,
        seuilLCBFT: seuilInfo?.type || 'sans_seuil',
      };

      // @ts-ignore
      navigation.navigate('DocumentCapture', {
        docType: data.docType,
        dossierData,
      });
    } catch (error) {
      if (error instanceof AuthSessionError) {
        await logout();
        Alert.alert(
          'Session expirée',
          'Reconnectez-vous pour créer un dossier.',
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

      console.error('Erreur de création du dossier:', error);
      Alert.alert('Création impossible', 'Le dossier n’a pas pu être enregistré en base. Réessayez.');
    } finally {
      setIsCreating(false);
    }
  };

  const badge = (
    <View style={styles.opBadge}>
      <MaterialIcons name="shopping-cart" size={13} color={colors.accent} />
      <Text style={styles.opBadgeText}>Achat</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <AppHeader
        title="Nouveau dossier"
        subtitle="Achat — Conformité LCB-FT"
        onBack={() => navigation.goBack()}
        right={badge}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Step 1 — Type de client */}
        <SectionCard step="1" title="Type de client">
          <Controller
            control={control} name="clientType"
            render={({ field: { onChange, value } }) => (
              <View style={styles.clientRow}>
                {CLIENT_TYPES.map(ct => {
                  const selected = value === ct.key;
                  return (
                    <TouchableOpacity
                      key={ct.key}
                      style={[styles.clientTile, selected && styles.clientTileSelected]}
                      onPress={() => onChange(ct.key)}
                      activeOpacity={0.75}
                    >
                      <MaterialIcons name={ct.icon as any} size={22} color={selected ? colors.accent : colors.textTertiary} />
                      <Text style={[styles.clientLabel, selected && styles.clientLabelSelected]}>{ct.label}</Text>
                      <Text style={styles.clientSub}>{ct.sub}</Text>
                      {selected && (
                        <View style={styles.checkMark}>
                          <MaterialIcons name="check" size={12} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
          {errors.clientType && <Text style={styles.err}>{errors.clientType.message}</Text>}
        </SectionCard>

        {/* Step 2 — Montant */}
        <SectionCard step="2" title="Montant de l'opération">
          <Controller
            control={control} name="montant"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={[styles.amountWrap, errors.montant && styles.amountError]}>
                <Text style={styles.currencySymbol}>€</Text>
                <RNInput
                  style={styles.amountInput}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0,00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
            )}
          />
          {errors.montant && <Text style={styles.err}>{errors.montant.message}</Text>}
          {seuilInfo && (
            <View style={[styles.seuilBanner, { backgroundColor: seuilInfo.bg }]}>
              <MaterialIcons name={seuilInfo.icon as any} size={15} color={seuilInfo.color} />
              <Text style={[styles.seuilText, { color: seuilInfo.color }]}>{seuilInfo.label}</Text>
            </View>
          )}
        </SectionCard>

        {/* Step 3 — Moyen de paiement (NOUVEAU - obligatoire LCB-FT) */}
        <SectionCard step="3" title="Moyen de paiement">
          <View style={styles.lcbftNotice}>
            <MaterialIcons name="security" size={14} color={colors.info} />
            <Text style={styles.lcbftNoticeText}>Information obligatoire selon procédures LCB-FT</Text>
          </View>
          <Controller
            control={control} name="moyenPaiement.type"
            render={({ field: { onChange, value } }) => (
              <View style={styles.paymentGrid}>
                {MOYENS_PAIEMENT.map(mp => {
                  const selected = value === mp.key;
                  return (
                    <TouchableOpacity
                      key={mp.key}
                      style={[styles.paymentTile, selected && { borderColor: mp.accent, backgroundColor: mp.accent + '08' }]}
                      onPress={() => {
                        onChange(mp.key);
                        validateMoyenPaiement();
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.paymentIcon, { backgroundColor: selected ? mp.accent + '18' : colors.borderLight }]}>
                        <MaterialIcons name={mp.icon as any} size={16} color={selected ? mp.accent : colors.textTertiary} />
                      </View>
                      <Text style={[styles.paymentLabel, selected && { color: mp.accent }]}>{mp.label}</Text>
                      <Text style={styles.paymentSub}>{mp.sub}</Text>
                      {selected && <View style={[styles.selectedDot, { backgroundColor: mp.accent }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
          {errors.moyenPaiement?.type && <Text style={styles.err}>{errors.moyenPaiement.type.message}</Text>}

          {/* Champs spécifiques selon le moyen de paiement */}
          {(moyenPaiementType === 'virement' || moyenPaiementType === 'cheque') && (
            <View style={styles.paymentDetails}>
              <Controller
                control={control} name="moyenPaiement.origineCompte"
                render={({ field: { onChange, onBlur, value } }) => (
                  <RNInput
                    style={styles.detailInput}
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Nom du titulaire du compte"
                    placeholderTextColor={colors.textTertiary}
                  />
                )}
              />
              {moyenPaiementType === 'virement' && (
                <>
                  <Controller
                    control={control} name="moyenPaiement.paysCompte"
                    render={({ field: { onChange, value } }) => (
                      <TouchableOpacity
                        style={styles.countrySelector}
                        onPress={() => {
                          Alert.alert(
                            'Sélection du pays',
                            'Sélectionnez le pays du compte bancaire (UE/EEE uniquement)',
                            PAYS_UE_EEE.slice(0, 10).map(pays => ({
                              text: pays,
                              onPress: () => onChange(pays)
                            })).concat([{ text: 'Annuler', onPress: () => {} }])
                          );
                        }}
                      >
                        <Text style={[styles.countrySelectorText, value ? { color: colors.textPrimary } : undefined]}>
                          {value || 'Sélectionner le pays du compte'}
                        </Text>
                        <MaterialIcons name="expand-more" size={20} color={colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  />
                  <Controller
                    control={control} name="moyenPaiement.bicSwift"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <RNInput
                        style={styles.detailInput}
                        value={value || ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="Code BIC/SWIFT (optionnel)"
                        placeholderTextColor={colors.textTertiary}
                      />
                    )}
                  />
                </>
              )}
            </View>
          )}

          {moyenPaiementType === 'lien_paiement' && (
            <View style={styles.paymentDetails}>
              <Controller
                control={control} name="moyenPaiement.nombreLiensPaiement"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.linkCountSelector}>
                    <Text style={styles.linkLabel}>Nombre de liens :</Text>
                    {[1, 2, 3].map(num => (
                      <TouchableOpacity
                        key={num}
                        style={[styles.linkCountBtn, value === num && styles.linkCountBtnSelected]}
                        onPress={() => onChange(num)}
                      >
                        <Text style={[styles.linkCountText, value === num && styles.linkCountTextSelected]}>{num}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
              <Controller
                control={control} name="moyenPaiement.raison"
                render={({ field: { onChange, onBlur, value } }) => (
                  <RNInput
                    style={styles.detailInput}
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Raison de l'utilisation de liens de paiement"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                )}
              />
            </View>
          )}
        </SectionCard>

        {/* Step 4 — Intermédiaire (NOUVEAU - selon procédures) */}
        <SectionCard step="4" title="Intermédiaire">
          <View style={styles.intermediateToggle}>
            <View>
              <Text style={styles.intermediateLabel}>Un intermédiaire agit pour le client</Text>
              <Text style={styles.intermediateSub}>Ami, famille, assistant, etc.</Text>
            </View>
            <Controller
              control={control} name="hasIntermediaire"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value}
                  onValueChange={(val) => {
                    onChange(val);
                    setShowIntermediaireDetails(val);
                  }}
                  trackColor={{ false: colors.border, true: colors.accentLight }}
                  thumbColor={value ? colors.accent : colors.textTertiary}
                />
              )}
            />
          </View>

          {hasIntermediaire && (
            <View style={styles.intermediateDetails}>
              <Text style={styles.detailTitle}>Informations de l'intermédiaire</Text>

              <View style={styles.nameRow}>
                <Controller
                  control={control} name="intermediaire.prenom"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <RNInput
                      style={[styles.nameInput, styles.halfWidth]}
                      value={value || ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Prénom"
                      placeholderTextColor={colors.textTertiary}
                    />
                  )}
                />
                <Controller
                  control={control} name="intermediaire.nom"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <RNInput
                      style={[styles.nameInput, styles.halfWidth]}
                      value={value || ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Nom"
                      placeholderTextColor={colors.textTertiary}
                    />
                  )}
                />
              </View>

              <Controller
                control={control} name="intermediaire.numeroIdentite"
                render={({ field: { onChange, onBlur, value } }) => (
                  <RNInput
                    style={styles.detailInput}
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Numéro de pièce d'identité"
                    placeholderTextColor={colors.textTertiary}
                  />
                )}
              />

              <Controller
                control={control} name="intermediaire.lienClient"
                render={({ field: { onChange, value } }) => (
                  <TouchableOpacity
                    style={styles.linkSelector}
                    onPress={() => {
                      Alert.alert(
                        'Lien avec le client',
                        'Quel est le lien entre l\'intermédiaire et le client ?',
                        LIENS_CLIENT.map(lien => ({
                          text: lien.label,
                          onPress: () => onChange(lien.key)
                        })).concat([{ text: 'Annuler', onPress: () => {} }])
                      );
                    }}
                  >
                    <Text style={[styles.linkSelectorText, value ? { color: colors.textPrimary } : undefined]}>
                      {LIENS_CLIENT.find(l => l.key === value)?.label || 'Sélectionner le lien'}
                    </Text>
                    <MaterialIcons name="expand-more" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              />

              <Text style={styles.mandatSectionTitle}>Mandat de l'intermédiaire</Text>

              <Controller
                control={control} name="intermediaire.mandatType"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.mandatRow}>
                    {MANDAT_TYPES.map(mt => (
                      <TouchableOpacity
                        key={mt.key}
                        style={[styles.mandatTile, value === mt.key && styles.mandatTileSelected]}
                        onPress={() => onChange(mt.key)}
                      >
                        <MaterialIcons name={mt.icon as any} size={14} color={value === mt.key ? colors.accent : colors.textTertiary} />
                        <Text style={[styles.mandatLabel, value === mt.key && { color: colors.accent }]}>{mt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />

              <Controller
                control={control} name="intermediaire.mandatDescription"
                render={({ field: { onChange, onBlur, value } }) => (
                  <RNInput
                    style={styles.mandatDescription}
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Description détaillée du mandat"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                )}
              />

              {/* Affichage des erreurs intermédiaire */}
              {errors.intermediaire && (
                <View style={styles.errorSection}>
                  {Object.entries(errors.intermediaire).map(([field, error]) => (
                    <Text key={field} style={styles.err}>{(error as any)?.message}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </SectionCard>

        {/* Step 5 — Pièce d'identité */}
        <SectionCard step="5" title="Pièce d'identité à scanner">
          <View style={styles.docNotice}>
            <MaterialIcons name="camera-alt" size={14} color={colors.info} />
            <Text style={styles.docNoticeText}>Une photo sera requise après validation</Text>
          </View>
          <Controller
            control={control} name="docType"
            render={({ field: { onChange, value } }) => (
              <View style={styles.docRow}>
                {DOC_TYPES.map(dt => {
                  const selected = value === dt.key;
                  return (
                    <TouchableOpacity
                      key={dt.key}
                      style={[styles.docTile, selected && { borderColor: dt.accent, backgroundColor: dt.accent + '08' }]}
                      onPress={() => onChange(dt.key)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.docIcon, { backgroundColor: selected ? dt.accent + '18' : colors.borderLight }]}>
                        <MaterialIcons name={dt.icon as any} size={20} color={selected ? dt.accent : colors.textTertiary} />
                      </View>
                      <Text style={[styles.docLabel, selected && { color: dt.accent }]}>{dt.label}</Text>
                      <Text style={styles.docSub}>{dt.sub}</Text>
                      {selected && <View style={[styles.selectedDot, { backgroundColor: dt.accent }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
          {errors.docType && <Text style={styles.err}>{errors.docType.message}</Text>}
        </SectionCard>

      </ScrollView>

      {/* Footer avec indicateurs de conformité */}
      <View style={styles.footer}>
        {seuilInfo && (
          <View style={[styles.complianceIndicator, { backgroundColor: seuilInfo.bg }]}>
            <MaterialIcons name={seuilInfo.icon as any} size={16} color={seuilInfo.color} />
            <Text style={[styles.complianceText, { color: seuilInfo.color }]}>
              Conformité LCB-FT : {seuilInfo.type === 'occasionnel' ? 'Client occasionnel' : 'Relation d\'affaires'}
            </Text>
          </View>
        )}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, (!isValid || isCreating) && styles.submitDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isCreating}
          >
            <MaterialIcons name="camera-alt" size={18} color="#fff" />
            <Text style={styles.submitText}>{isCreating ? 'Création du dossier…' : 'Scanner la pièce d\'identité'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function SectionCard({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <View style={card.wrap}>
      <View style={card.titleRow}>
        <View style={card.stepBadge}><Text style={card.stepNum}>{step}</Text></View>
        <Text style={card.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
const card = StyleSheet.create({
  wrap:     { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm, marginBottom: 6, ...shadows.sm, borderWidth: 1, borderColor: colors.borderLight },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  stepBadge:{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepNum:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  title:    { ...typography.h4, color: colors.textPrimary },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  opBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  opBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  scroll: { padding: spacing.sm, paddingBottom: 120 },

  // Client selection
  clientRow: { flexDirection: 'row', gap: 8 },
  clientTile: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
    position: 'relative',
  },
  clientTileSelected: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  clientLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  clientLabelSelected: { color: colors.accent },
  clientSub: { fontSize: 10, color: colors.textTertiary },
  checkMark: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Amount input
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  amountError: { borderColor: colors.error },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },

  // Seuil banner
  seuilBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  seuilText: { fontSize: 11, fontWeight: '600' },

  // LCB-FT notice
  lcbftNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.infoLight,
    padding: 4,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  lcbftNoticeText: { fontSize: 10, color: colors.info, fontWeight: '500' },

  // Payment method selection
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paymentTile: {
    width: '48%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 6,
    gap: 2,
    position: 'relative',
  },
  paymentIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  paymentSub: { fontSize: 9, color: colors.textTertiary, textAlign: 'center' },

  // Payment details
  paymentDetails: {
    marginTop: spacing.sm,
    gap: 6,
  },
  detailInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 6,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  countrySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 6,
    backgroundColor: colors.surface,
  },
  countrySelectorText: { fontSize: 13, color: colors.textTertiary },

  // Links count selector
  linkCountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  linkCountBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkCountBtnSelected: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  linkCountText: { fontSize: 14, fontWeight: '600', color: colors.textTertiary },
  linkCountTextSelected: { color: colors.accent },

  // Intermediate toggle
  intermediateToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  intermediateLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  intermediateSub: { fontSize: 11, color: colors.textTertiary },

  // Intermediate details
  intermediateDetails: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 6,
  },
  detailTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  nameRow: { flexDirection: 'row', gap: 6 },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 6,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  halfWidth: { flex: 1 },
  linkSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 6,
    backgroundColor: colors.surface,
  },
  linkSelectorText: { fontSize: 13, color: colors.textTertiary },

  // Mandat section
  mandatSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 4,
  },
  mandatRow: { flexDirection: 'row', gap: 6 },
  mandatTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 6,
    justifyContent: 'center',
  },
  mandatTileSelected: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  mandatLabel: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  mandatDescription: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 6,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    height: 56,
    textAlignVertical: 'top',
  },

  // Document selection
  docNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.infoLight,
    padding: 4,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  docNoticeText: { fontSize: 10, color: colors.info },
  docRow: { flexDirection: 'row', gap: 8 },
  docTile: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 6,
    gap: 4,
    position: 'relative',
  },
  docIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  docSub: { fontSize: 9, color: colors.textTertiary, textAlign: 'center' },
  selectedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4
  },

  // Error handling
  err: { color: colors.error, fontSize: 12, marginTop: 4, fontWeight: '500' },
  errorSection: { marginTop: spacing.sm },

  // Footer with compliance
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: spacing.sm,
    gap: 6,
  },
  complianceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderRadius: radius.sm,
  },
  complianceText: { fontSize: 11, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  submitDisabled: { backgroundColor: colors.textTertiary },
  submitText: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
