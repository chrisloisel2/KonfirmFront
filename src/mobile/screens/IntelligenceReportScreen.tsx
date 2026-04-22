import React, { useState } from 'react';
import {
	View, StyleSheet, ScrollView, TouchableOpacity,
	ActivityIndicator, StatusBar, Alert, Platform,
} from 'react-native';
import { Text, Card, Chip, ProgressBar, Button, TextInput } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../../shared/services/AuthContext';

import { API_BASE } from '../../shared/config/api';

const RISK_COLORS: Record<string, string> = {
	CRITIQUE: '#7C3AED',
	ELEVE:    '#DC2626',
	MOYEN:    '#D97706',
	FAIBLE:   '#059669',
	AUCUN:    '#64748B',
};

const VIGILANCE_COLORS: Record<string, string> = {
	REFUS_RECOMMANDE: '#7C3AED',
	RENFORCEE:        '#DC2626',
	STANDARD:         '#D97706',
	SIMPLIFIEE:       '#059669',
};

interface RouteParams {
	nom?: string;
	prenom?: string;
	dateNaissance?: string;
	nationalite?: string;
	clientId?: string;
	dossierId?: string;
}

export default function IntelligenceReportScreen() {
	const navigation = useNavigation();
	const route = useRoute();
	const { token } = useAuth() as any;
	const params = (route.params as RouteParams) || {};

	const [nom, setNom] = useState(params.nom || '');
	const [prenom, setPrenom] = useState(params.prenom || '');
	const [dateNaissance, setDateNaissance] = useState(params.dateNaissance || '');
	const [nationalite, setNationalite] = useState(params.nationalite || '');
	const [report, setReport] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [activeSection, setActiveSection] = useState<string | null>(null);

	const generateReport = async () => {
		if (!nom.trim()) {
			Alert.alert('Erreur', 'Le nom est requis');
			return;
		}

		setLoading(true);
		setReport(null);

		try {
			const resp = await fetch(`${API_BASE}/intelligence/report`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					nom: nom.trim(),
					prenom: prenom.trim() || undefined,
					dateNaissance: dateNaissance.trim() || undefined,
					nationalite: nationalite.trim() || undefined,
					clientId: params.clientId,
					dossierId: params.dossierId,
					subjectType: 'PERSON',
				}),
			});

			const data = await resp.json();
			if (data.success) {
				setReport(data.data.report);
			} else {
				Alert.alert('Erreur', data.error?.message || 'Impossible de générer le rapport');
			}
		} catch (e) {
			Alert.alert('Erreur réseau', 'Impossible de contacter le serveur');
		} finally {
			setLoading(false);
		}
	};

	const toggleSection = (s: string) => setActiveSection(prev => prev === s ? null : s);

	const renderRiskBadge = (level: string) => (
		<View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[level] + '20', borderColor: RISK_COLORS[level] }]}>
			<Text style={[styles.riskText, { color: RISK_COLORS[level] }]}>{level}</Text>
		</View>
	);

	const renderSectionHeader = (id: string, icon: string, title: string, hasAlert?: boolean) => (
		<TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(id)}>
			<View style={styles.sectionHeaderLeft}>
				<MaterialIcons name={icon as any} size={20} color={colors.primary} />
				<Text style={styles.sectionTitle}>{title}</Text>
				{hasAlert && <View style={styles.alertDot} />}
			</View>
			<MaterialIcons
				name={activeSection === id ? 'expand-less' : 'expand-more'}
				size={22} color={colors.textTertiary}
			/>
		</TouchableOpacity>
	);

	if (loading) {
		return (
			<View style={[styles.container, styles.centered]}>
				<AppHeader title="Rapport d'Intelligence" onBack={() => navigation.goBack()} />
				<View style={styles.loadingBox}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingTitle}>Analyse en cours...</Text>
					<Text style={styles.loadingSubtitle}>Interrogation de 18+ sources OSINT simultanément</Text>
					<View style={styles.sourcesList}>
						{['OpenSanctions', 'OFAC SDN', 'EU Sanctions', 'ONU', 'Interpol', 'DG Trésor', 'BODACC', 'Pappers', 'Google News', 'Wikipedia', 'FATF', 'Légifrance', 'TI CPI', 'World Bank', 'UK HM Treasury', 'SECO CH', 'DuckDuckGo', 'OpenCorporates'].map(s => (
							<Chip key={s} compact style={styles.sourceChip} textStyle={{ fontSize: 10 }}>{s}</Chip>
						))}
					</View>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
			<AppHeader
				title="Rapport d'Intelligence OSINT"
				subtitle="Analyse multi-sources complète"
				onBack={() => navigation.goBack()}
			/>

			<ScrollView contentContainerStyle={styles.content}>
				{/* Input form */}
				{!report && (
					<Card style={styles.formCard}>
						<Card.Content>
							<Text style={styles.formTitle}>Sujet de l'analyse</Text>
							<TextInput
								label="Nom *"
								value={nom}
								onChangeText={setNom}
								mode="outlined"
								style={styles.input}
								dense
							/>
							<TextInput
								label="Prénom"
								value={prenom}
								onChangeText={setPrenom}
								mode="outlined"
								style={styles.input}
								dense
							/>
							<TextInput
								label="Date de naissance (JJ/MM/AAAA)"
								value={dateNaissance}
								onChangeText={setDateNaissance}
								mode="outlined"
								style={styles.input}
								dense
							/>
							<TextInput
								label="Nationalité"
								value={nationalite}
								onChangeText={setNationalite}
								mode="outlined"
								style={styles.input}
								dense
							/>
							<Button
								mode="contained"
								onPress={generateReport}
								style={styles.generateBtn}
								icon="travel-explore"
							>
								Générer le rapport complet
							</Button>
						</Card.Content>
					</Card>
				)}

				{report && (
					<>
						{/* Executive Summary */}
						<Card style={[styles.summaryCard, { borderLeftColor: RISK_COLORS[report.executiveSummary?.overallRisk] || colors.primary }]}>
							<Card.Content>
								<View style={styles.summaryHeader}>
									<View>
										<Text style={styles.summarySubject}>
											{report.subject?.prenom} {report.subject?.nom}
										</Text>
										<Text style={styles.summaryGenerated}>
											Généré le {new Date(report.generatedAt).toLocaleDateString('fr-FR')} · {Math.round(report.durationMs / 1000)}s
										</Text>
									</View>
									{renderRiskBadge(report.executiveSummary?.overallRisk || 'AUCUN')}
								</View>

								{/* Risk score */}
								<View style={styles.scoreRow}>
									<Text style={styles.scoreLabel}>Score de risque</Text>
									<Text style={[styles.scoreValue, { color: RISK_COLORS[report.executiveSummary?.overallRisk] }]}>
										{report.executiveSummary?.riskScore}/100
									</Text>
								</View>
								<ProgressBar
									progress={(report.executiveSummary?.riskScore || 0) / 100}
									color={RISK_COLORS[report.executiveSummary?.overallRisk] || colors.primary}
									style={styles.scoreBar}
								/>

								{/* Vigilance level */}
								<View style={[styles.vigilanceBadge, { backgroundColor: VIGILANCE_COLORS[report.executiveSummary?.vigilanceLevel] + '15' }]}>
									<MaterialIcons
										name={report.executiveSummary?.vigilanceLevel === 'REFUS_RECOMMANDE' ? 'block' : 'shield'}
										size={16}
										color={VIGILANCE_COLORS[report.executiveSummary?.vigilanceLevel]}
									/>
									<Text style={[styles.vigilanceText, { color: VIGILANCE_COLORS[report.executiveSummary?.vigilanceLevel] }]}>
										{report.executiveSummary?.vigilanceLevel?.replace(/_/g, ' ')}
									</Text>
								</View>

								{/* Key alerts */}
								{(report.executiveSummary?.keyAlerts || []).map((alert: string, i: number) => (
									<View key={i} style={styles.alertRow}>
										<Text style={styles.alertText}>{alert}</Text>
									</View>
								))}

								{/* Recommendation */}
								<View style={styles.recommendationBox}>
									<Text style={styles.recommendationText}>{report.executiveSummary?.recommendation}</Text>
								</View>

								{/* Quick indicators */}
								<View style={styles.indicatorsRow}>
									{[
										{ label: 'Sanctions', value: report.executiveSummary?.sanctionsExposure, danger: true },
										{ label: 'Gel avoirs', value: report.executiveSummary?.assetFreezeExposure, danger: true },
										{ label: 'PPE', value: report.executiveSummary?.pepScore >= 50, danger: false },
										{ label: 'Judiciaire', value: report.executiveSummary?.judicialRecord, danger: true },
										{ label: 'Presse négative', value: report.executiveSummary?.negativePress, danger: false },
									].map(({ label, value, danger }) => (
										<View key={label} style={[styles.indicator, value && danger && styles.indicatorDanger, value && !danger && styles.indicatorWarning]}>
											<MaterialIcons
												name={value ? (danger ? 'dangerous' : 'warning') : 'check-circle'}
												size={12}
												color={value ? (danger ? '#DC2626' : '#D97706') : '#059669'}
											/>
											<Text style={[styles.indicatorText, { color: value ? (danger ? '#DC2626' : '#D97706') : '#059669' }]}>
												{label}
											</Text>
										</View>
									))}
								</View>
							</Card.Content>
						</Card>

						{/* Sections */}
						{[
							{ id: 'sanctionsEtGel', icon: 'block', title: 'Sanctions & Gel des Avoirs', hasAlert: report.sections?.sanctionsEtGel?.hasSanctions || report.sections?.sanctionsEtGel?.hasAssetFreeze },
							{ id: 'ppe', icon: 'account-balance', title: 'Personne Politiquement Exposée', hasAlert: report.sections?.ppe?.isPPE },
							{ id: 'judiciaire', icon: 'gavel', title: 'Mentions Judiciaires', hasAlert: report.sections?.judiciaire?.hasRecord },
							{ id: 'entreprises', icon: 'business', title: 'Entreprises & Registres', hasAlert: report.sections?.entreprises?.dissolutions > 0 },
							{ id: 'repuationPresse', icon: 'newspaper', title: 'Réputation & Presse', hasAlert: report.sections?.repuationPresse?.sentiment === 'NEGATIVE' },
							{ id: 'risquePays', icon: 'flag', title: 'Risque Géographique / Pays', hasAlert: (report.sections?.risquePays?.flaggedCountries || []).length > 0 },
							{ id: 'interne', icon: 'folder-special', title: 'Données Internes Konfirm', hasAlert: report.sections?.interne?.criticalExceptions > 0 },
							{ id: 'osintSources', icon: 'travel-explore', title: 'Sources OSINT détaillées', hasAlert: false },
						].map(({ id, icon, title, hasAlert }) => (
							<Card key={id} style={styles.sectionCard}>
								{renderSectionHeader(id, icon, title, hasAlert)}

								{activeSection === id && (
									<View style={styles.sectionContent}>
										<SectionContent id={id} report={report} />
									</View>
								)}
							</Card>
						))}

						{/* Regenerate */}
						<Button
							mode="outlined"
							onPress={() => { setReport(null); }}
							style={styles.regenerateBtn}
							icon="refresh"
						>
							Nouvelle recherche
						</Button>
					</>
				)}
			</ScrollView>
		</View>
	);
}

function SectionContent({ id, report }: { id: string; report: any }) {
	const section = report.sections?.[id];

	if (id === 'sanctionsEtGel') {
		return (
			<View>
				<Row label="Sanctions internationales" value={section?.hasSanctions ? '🚨 OUI' : '✅ Non'} danger={section?.hasSanctions} />
				<Row label="Gel des avoirs" value={section?.hasAssetFreeze ? '🚨 OUI' : '✅ Non'} danger={section?.hasAssetFreeze} />
				<Row label="Sources vérifiées" value={(section?.sources || []).join(', ')} />
				{(section?.matches || []).slice(0, 3).map((m: any, i: number) => (
					<View key={i} style={styles.matchItem}>
						<Text style={styles.matchName}>{m.name}</Text>
						<Text style={styles.matchDetail}>Source: {m.sourceId} · Confiance: {(m.matchScore * 100).toFixed(0)}%</Text>
						{m.snippet && <Text style={styles.matchSnippet}>{m.snippet}</Text>}
					</View>
				))}
				{section?.notes?.map((n: string, i: number) => <Text key={i} style={styles.note}>{n}</Text>)}
			</View>
		);
	}

	if (id === 'ppe') {
		return (
			<View>
				<Row label="PPE identifié" value={section?.isPPE ? '⚠️ OUI' : '✅ Non'} danger={section?.isPPE} />
				<Row label="Score PPE" value={`${section?.pepScore || 0}/100`} />
				<Row label="Fonctions politiques" value={(section?.politicalFunctions || []).join(', ') || 'Aucune détectée'} />
				{section?.notes?.map((n: string, i: number) => <Text key={i} style={styles.note}>{n}</Text>)}
			</View>
		);
	}

	if (id === 'judiciaire') {
		return (
			<View>
				<Row label="Mentions judiciaires" value={section?.hasRecord ? '⚠️ OUI' : '✅ Non'} danger={section?.hasRecord} />
				<Row label="Sources" value={(section?.sources || []).join(', ') || 'Aucune source touchée'} />
				{(section?.decisions || []).slice(0, 3).map((d: any, i: number) => (
					<View key={i} style={styles.matchItem}>
						<Text style={styles.matchName}>{d.details?.title || d.name}</Text>
						<Text style={styles.matchDetail}>{d.details?.date || ''} · {d.details?.jurisdiction || ''}</Text>
					</View>
				))}
			</View>
		);
	}

	if (id === 'entreprises') {
		return (
			<View>
				<Row label="Entreprises trouvées" value={`${section?.totalCompanies || 0}`} />
				<Row label="Dissolutions/liquidations" value={`${section?.dissolutions || 0}`} danger={(section?.dissolutions || 0) > 0} />
				{(section?.companies || []).slice(0, 5).map((c: any, i: number) => (
					<View key={i} style={styles.matchItem}>
						<Text style={styles.matchName}>{c.name}</Text>
						<Text style={styles.matchDetail}>{c.details?.forme_juridique || ''} · {c.details?.statut || c.details?.status || ''}</Text>
					</View>
				))}
				{(section?.beneficialOwnership || []).length > 0 && (
					<Row label="Bénéficiaires effectifs" value={(section.beneficialOwnership as string[]).slice(0, 3).join(', ')} />
				)}
			</View>
		);
	}

	if (id === 'repuationPresse') {
		return (
			<View>
				<Row label="Sentiment" value={section?.sentiment || 'NEUTRAL'} danger={section?.sentiment === 'NEGATIVE'} />
				<Row label="Articles trouvés" value={`${(section?.articles || []).length}`} />
				{(section?.articles || []).slice(0, 5).map((a: any, i: number) => (
					<View key={i} style={styles.matchItem}>
						<Text style={styles.matchSnippet}>{a.snippet}</Text>
						<Text style={[styles.matchDetail, a.severity === 'HIGH' && { color: '#DC2626' }]}>
							{a.sourceId} · {a.severity}
						</Text>
					</View>
				))}
			</View>
		);
	}

	if (id === 'risquePays') {
		return (
			<View>
				<Row label="Pays à risque FATF" value={(section?.fatfStatus || []).join(', ') || '✅ Aucun'} danger={(section?.fatfStatus || []).length > 0} />
				<Row label="Pays haute corruption" value={(section?.corruptionIndex || []).map((c: any) => `${c.country} (${c.cpi})`).join(', ') || '✅ Aucun'} danger={(section?.corruptionIndex || []).length > 0} />
			</View>
		);
	}

	if (id === 'interne') {
		return (
			<View>
				<Row label="Dossiers en base" value={`${section?.dossierCount || 0}`} />
				<Row label="Exceptions totales" value={`${section?.totalExceptions || 0}`} />
				<Row label="Exceptions critiques" value={`${section?.criticalExceptions || 0}`} danger={(section?.criticalExceptions || 0) > 0} />
				<Row label="Déclarations TRACFIN" value={`${section?.tracfinCount || 0}`} danger={(section?.tracfinCount || 0) > 0} />
				<Row label="Score risque max" value={`${section?.maxRiskScore || 0}/100`} danger={(section?.maxRiskScore || 0) >= 70} />
				{section?.notes?.map((n: string, i: number) => <Text key={i} style={styles.note}>{n}</Text>)}
			</View>
		);
	}

	if (id === 'osintSources') {
		const sources = report.osintReport?.sources || [];
		return (
			<View>
				<Text style={styles.sourceSummary}>
					{sources.filter((s: any) => s.status === 'SUCCESS').length}/{sources.length} sources interrogées
					· {report.osintReport?.totalMatches || 0} correspondances totales
				</Text>
				{sources.map((s: any, i: number) => (
					<View key={i} style={styles.sourceRow}>
						<View style={[styles.sourceStatus, {
							backgroundColor:
								s.status === 'SUCCESS' ? (s.matchCount > 0 ? '#FEF2F2' : '#ECFDF5') :
								s.status === 'TIMEOUT' ? '#FFFBEB' : '#F8FAFC'
						}]}>
							<MaterialIcons
								name={
									s.status === 'SUCCESS' ? (s.matchCount > 0 ? 'warning' : 'check') :
									s.status === 'TIMEOUT' ? 'timer-off' : 'error-outline'
								}
								size={12}
								color={
									s.status === 'SUCCESS' ? (s.matchCount > 0 ? '#DC2626' : '#059669') :
									s.status === 'TIMEOUT' ? '#D97706' : '#64748B'
								}
							/>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={styles.sourceLabel}>{s.label}</Text>
							<Text style={styles.sourceDetail}>
								{s.matchCount > 0 ? `${s.matchCount} correspondance(s)` : s.status}
								{s.durationMs ? ` · ${s.durationMs}ms` : ''}
							</Text>
						</View>
					</View>
				))}
			</View>
		);
	}

	return <Text style={{ color: colors.textSecondary, padding: 8 }}>Section en cours de chargement...</Text>;
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={[styles.rowValue, danger && { color: '#DC2626', fontWeight: '600' }]}>{value}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.background },
	centered: {},
	content: { padding: 16, paddingBottom: 60 },
	loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
	loadingTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 20 },
	loadingSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginVertical: 8 },
	sourcesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' },
	sourceChip: { backgroundColor: colors.accentLight },
	formCard: { marginBottom: 16, borderRadius: 12 },
	formTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
	input: { marginBottom: 8 },
	generateBtn: { marginTop: 8 },
	summaryCard: {
		marginBottom: 12, borderRadius: 12, overflow: 'hidden',
		borderLeftWidth: 4,
	},
	summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
	summarySubject: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
	summaryGenerated: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
	riskBadge: {
		paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
		borderWidth: 1.5,
	},
	riskText: { fontSize: 12, fontWeight: '700' },
	scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
	scoreLabel: { fontSize: 13, color: colors.textSecondary },
	scoreValue: { fontSize: 18, fontWeight: '700' },
	scoreBar: { height: 6, borderRadius: 3, marginBottom: 12 },
	vigilanceBadge: {
		flexDirection: 'row', alignItems: 'center', gap: 6,
		padding: 10, borderRadius: 8, marginBottom: 12,
	},
	vigilanceText: { fontWeight: '700', fontSize: 13 },
	alertRow: { paddingVertical: 4 },
	alertText: { fontSize: 13, color: colors.textPrimary },
	recommendationBox: {
		backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10,
		borderLeftWidth: 3, borderLeftColor: colors.primary, marginTop: 8,
	},
	recommendationText: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 19 },
	indicatorsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
	indicator: {
		flexDirection: 'row', alignItems: 'center', gap: 4,
		paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
		backgroundColor: '#ECFDF5',
	},
	indicatorDanger: { backgroundColor: '#FEF2F2' },
	indicatorWarning: { backgroundColor: '#FFFBEB' },
	indicatorText: { fontSize: 10, fontWeight: '600' },
	sectionCard: { marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
	sectionHeader: {
		flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
		padding: 14,
	},
	sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
	alertDot: {
		width: 8, height: 8, borderRadius: 4,
		backgroundColor: '#DC2626', marginLeft: 4,
	},
	sectionContent: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border },
	row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
	rowLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
	rowValue: { fontSize: 13, color: colors.textPrimary, flex: 1, textAlign: 'right' },
	matchItem: {
		backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8,
		marginTop: 6, borderLeftWidth: 3, borderLeftColor: '#DC2626',
	},
	matchName: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
	matchDetail: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
	matchSnippet: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 3 },
	note: { fontSize: 12, color: '#D97706', fontWeight: '500', marginTop: 4 },
	sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
	sourceStatus: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
	sourceLabel: { fontSize: 13, color: colors.textPrimary },
	sourceDetail: { fontSize: 11, color: colors.textSecondary },
	sourceSummary: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: '500' },
	regenerateBtn: { marginTop: 8 },
});
