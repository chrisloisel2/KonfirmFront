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
import { useAuth } from '../../shared/services/AuthContext';
import { colors, spacing, radius, shadows, typography } from '../../shared/theme/theme';
import { MaterialIcons } from '@expo/vector-icons';

interface LoginForm { email: string; password: string; }

const schema = yup.object().shape({
  email:    yup.string().required('Email requis').email('Format invalide'),
  password: yup.string().required('Mot de passe requis').min(8, 'Minimum 8 caractères'),
});

export default function LoginScreen() {
	const navigation = useNavigation<any>();
	const { login }   = useAuth();
	const [loading, setLoading]     = useState(false);
	const [showPass, setShowPass]   = useState(false);

	const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
		resolver: yupResolver(schema),
		defaultValues: { email: '', password: '' },
	});

	const onSubmit = async (data: LoginForm) => {
		setLoading(true);
		try {
			const result = await login(data.email, data.password);
			if (!result.success) {
				Alert.alert('Connexion refusée', result.error || 'Identifiants incorrects.');
			}
		} catch {mù
			Alert.alert('Erreur réseau', 'Impossible de joindre le serveur.');
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

			{/* Top brand band */}
			<View style={styles.topBand}>
				<View style={styles.logoMark}>
					<View style={styles.logoBar} />
					<View style={[styles.logoBar, { width: 14 }]} />
					<View style={styles.logoBar} />
				</View>
				<Text style={styles.brand}>KONFIRM</Text>
				<Text style={styles.brandSub}>Conformité LCB-FT</Text>
			</View>

			<ScrollView contentContainerStyle={[styles.scroll, { justifyContent: 'center', flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
				<View style={styles.card}>
					<Text style={styles.cardTitle}>Connexion</Text>
					<Text style={styles.cardSub}>Accédez à votre espace sécurisé</Text>

					{/* Email */}
					<View style={styles.fieldGroup}>
						<Text style={styles.label}>ADRESSE EMAIL</Text>
						<Controller
							control={control} name="email"
							render={({ field: { onChange, onBlur, value } }) => (
								<View style={[styles.inputWrap, errors.email && styles.inputError]}>
									<MaterialIcons name="email" size={18} color={errors.email ? colors.error : colors.textTertiary} style={styles.inputIcon} />
									<View style={styles.inputInner} onStartShouldSetResponder={() => false}>
										<NativeInput
											value={value}
											onChangeText={onChange}
											onBlur={onBlur}
											placeholder="votre@email.fr"
											keyboardType="email-address"
											autoCapitalize="none"
											autoComplete="email"
											editable={!loading}
										/>
									</View>
								</View>
							)}
						/>
						{errors.email && <Text style={styles.errorMsg}>{errors.email.message}</Text>}
					</View>

					{/* Password */}
					<View style={styles.fieldGroup}>
						<Text style={styles.label}>MOT DE PASSE</Text>
						<Controller
							control={control} name="password"
							render={({ field: { onChange, onBlur, value } }) => (
								<View style={[styles.inputWrap, errors.password && styles.inputError]}>
									<MaterialIcons name="lock" size={18} color={errors.password ? colors.error : colors.textTertiary} style={styles.inputIcon} />
									<View style={styles.inputInner}>
										<NativeInput
											value={value}
											onChangeText={onChange}
											onBlur={onBlur}
											placeholder="••••••••"
											secureTextEntry={!showPass}
											autoComplete="password"
											editable={!loading}
										/>
									</View>
									<TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
										<MaterialIcons name={showPass ? 'visibility-off' : 'visibility'} size={18} color={colors.textTertiary} />
									</TouchableOpacity>
								</View>
							)}
						/>
						{errors.password && <Text style={styles.errorMsg}>{errors.password.message}</Text>}
					</View>

					{/* Submit */}
					<TouchableOpacity
						style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
						onPress={handleSubmit(onSubmit)}
						activeOpacity={0.85}
						disabled={loading}
					>
						{loading
							? <Text style={styles.submitText}>Connexion…</Text>
							: <>
									<Text style={styles.submitText}>Se connecter</Text>
									<MaterialIcons name="arrow-forward" size={18} color="#fff" />
								</>
						}
					</TouchableOpacity>

					<TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.switchLink}>
						<Text style={styles.switchText}>Pas encore de compte ? Activer un abonnement</Text>
					</TouchableOpacity>
				</View>

				{/* Legal */}
				<View style={styles.legalRow}>
					<MaterialIcons name="shield" size={13} color={colors.textTertiary} />
					<Text style={styles.legalText}>Accès réservé au personnel autorisé</Text>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

/* Wrapper léger autour de TextInput RN pour éviter le padding react-native-paper */
function NativeInput(props: any) {
  const { View: V, TextInput } = require('react-native');
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
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoMark: { gap: 5, alignItems: 'flex-start', marginBottom: 16 },
  logoBar:  { width: 22, height: 3, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 },
  brand:    { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 4 },
  brandSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, marginTop: 4, textTransform: 'uppercase' },

  scroll: { padding: spacing.lg, paddingTop: spacing.xl },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: 4 },
  cardSub:   { ...typography.body2, color: colors.textSecondary, marginBottom: spacing.lg },

  fieldGroup: { marginBottom: spacing.md },
  label: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  inputError: { borderColor: colors.error, backgroundColor: colors.errorLight },
  inputIcon:  { marginRight: 8 },
  inputInner: { flex: 1 },
  inputNativeHint: { display: 'none' },
  eyeBtn:     { padding: 4 },
  nativeInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  errorMsg: { fontSize: 12, color: colors.error, marginTop: 4, marginLeft: 4 },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { ...typography.button, color: '#fff', fontSize: 15 },

  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.lg,
  },
  legalText: { fontSize: 12, color: colors.textTertiary },
  switchLink: { marginTop: spacing.md, alignItems: 'center' },
  switchText: { ...typography.body2, color: colors.accent, fontWeight: '600' as const },
});
