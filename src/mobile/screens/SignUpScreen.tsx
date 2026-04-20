import React, { useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform,
  Alert, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../shared/services/AuthContext';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';

interface SignUpForm {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  password: string;
  confirmPassword: string;
  activationKey: string;
}

const schema = yup.object().shape({
  firstName: yup.string().required('Prénom requis').min(2, 'Minimum 2 caractères'),
  lastName: yup.string().required('Nom requis').min(2, 'Minimum 2 caractères'),
  companyName: yup.string().required('Société requise').min(2, 'Minimum 2 caractères'),
  email: yup.string().required('Email requis').email('Format invalide'),
  password: yup.string().required('Mot de passe requis').min(8, 'Minimum 8 caractères'),
  confirmPassword: yup.string()
    .required('Confirmation requise')
    .oneOf([yup.ref('password')], 'Les mots de passe ne correspondent pas'),
  activationKey: yup.string().required('Clé d’activation requise').min(8, 'Clé invalide'),
});

export default function SignUpScreen() {
  const navigation = useNavigation<any>();
  const { signup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<SignUpForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      companyName: '',
      email: '',
      password: '',
      confirmPassword: '',
      activationKey: '',
    },
  });

  const onSubmit = async (data: SignUpForm) => {
    setLoading(true);
    try {
      const result = await signup(data);
      if (result.success) {
        Alert.alert('Compte activé', 'Votre abonnement est actif. Vous pouvez continuer.', [
          { text: 'Continuer' }
        ]);
        return;
      }
      Alert.alert('Inscription refusée', result.message || 'Impossible de créer le compte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <View style={styles.topBand}>
        <View style={styles.logoMark}>
          <View style={styles.logoBar} />
          <View style={[styles.logoBar, { width: 14 }]} />
          <View style={styles.logoBar} />
        </View>
        <Text style={styles.brand}>KONFIRM</Text>
        <Text style={styles.brandSub}>Activation & abonnement</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Créer un compte</Text>
          <Text style={styles.cardSub}>Inscription avec clé d’activation payante</Text>

          <View style={styles.row}>
            <Field control={control} name="firstName" label="PRÉNOM" icon="person" error={errors.firstName?.message} editable={!loading} />
            <Field control={control} name="lastName" label="NOM" icon="badge" error={errors.lastName?.message} editable={!loading} />
          </View>

          <Field control={control} name="companyName" label="SOCIÉTÉ" icon="apartment" error={errors.companyName?.message} editable={!loading} />
          <Field control={control} name="email" label="EMAIL" icon="email" error={errors.email?.message} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
          <Field control={control} name="activationKey" label="CLÉ D’ACTIVATION" icon="vpn-key" error={errors.activationKey?.message} autoCapitalize="characters" editable={!loading} />

          <Field
            control={control}
            name="password"
            label="MOT DE PASSE"
            icon="lock"
            error={errors.password?.message}
            secureTextEntry={!showPassword}
            editable={!loading}
            rightAction={
              <TouchableOpacity onPress={() => setShowPassword((value) => !value)} style={styles.eyeBtn}>
                <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            }
          />

          <Field
            control={control}
            name="confirmPassword"
            label="CONFIRMATION"
            icon="verified-user"
            error={errors.confirmPassword?.message}
            secureTextEntry={!showConfirmPassword}
            editable={!loading}
            rightAction={
              <TouchableOpacity onPress={() => setShowConfirmPassword((value) => !value)} style={styles.eyeBtn}>
                <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit(onSubmit)}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.submitText}>{loading ? 'Activation…' : 'Activer mon compte'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.switchLink}>
            <Text style={styles.switchText}>Déjà abonné ? Se connecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: any) {
  const { control, name, label, icon, error, rightAction, ...inputProps } = props;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <View style={[styles.inputWrap, error && styles.inputError]}>
            <MaterialIcons name={icon} size={18} color={error ? colors.error : colors.textTertiary} style={styles.inputIcon} />
            <NativeInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder=""
              {...inputProps}
            />
            {rightAction}
          </View>
        )}
      />
      {!!error && <Text style={styles.errorMsg}>{error}</Text>}
    </View>
  );
}

function NativeInput(props: any) {
  const RNTextInput = require('react-native').TextInput;
  return (
    <RNTextInput
      {...props}
      style={styles.nativeInput}
      placeholderTextColor={colors.textTertiary}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBand: {
    backgroundColor: colors.primary,
    paddingTop: 56,
    paddingBottom: 32,
    alignItems: 'center',
  },
  logoMark: { gap: 5, alignItems: 'flex-start', marginBottom: 16 },
  logoBar: { width: 22, height: 3, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 },
  brand: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 4 },
  brandSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, marginTop: 4, textTransform: 'uppercase' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: 4 },
  cardSub: { ...typography.body2, color: colors.textSecondary, marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  fieldGroup: { marginBottom: spacing.md, flex: 1 },
  label: { ...typography.label, color: colors.textTertiary, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  inputError: { borderColor: colors.error, backgroundColor: colors.errorLight },
  inputIcon: { marginRight: 8 },
  nativeInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  eyeBtn: { padding: 4 },
  errorMsg: { fontSize: 12, color: colors.error, marginTop: 4, marginLeft: 4 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { ...typography.button, color: '#fff', fontSize: 15 },
  switchLink: { marginTop: spacing.md, alignItems: 'center' },
  switchText: { ...typography.body2, color: colors.accent, fontWeight: '600' as const },
});
