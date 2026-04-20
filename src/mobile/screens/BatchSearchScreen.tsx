import React, { useState, useCallback } from 'react';
import {
	View, StyleSheet, ScrollView, TouchableOpacity,
	StatusBar, Alert, FlatList, Platform,
} from 'react-native';
import { Text, Card, Chip, Button, ProgressBar, Checkbox, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../../shared/services/AuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

const RISK_COLORS: Record<string, string> = {
	CRITIQUE: '#7C3AED',
	ELEVE:    '#DC2626',
	MOYEN:    '#D97706',
	FAIBLE:   '#059669',
	AUCUN:    '#94A3B8',
};

const SEARCH_TYPES = [
	{ id: 'SANCTIONS',   label: 'Sanctions internat.', icon: 'block', default: true },
	{ id: 'GEL_AVOIRS',  label: 'Gel des avoirs FR', icon: 'lock', default: true },
	{ id: 'PPE',         label: 'PPE', icon: 'account-balance', default: true },
	{ id: 'INTERPOL',    label: 'Interpol', icon: 'security', default: true },
	{ id: 'PAYS_RISQUE', label: 'Pays à risque', icon: 'flag', default: true },
	{ id: 'PRESSE',      label: 'Presse / Web', icon: 'newspaper', default: false },
	{ id: 'ENTREPRISE',  label: 'Registres entreprises', icon: 'business', default: false },
];

export default function BatchSearchScreen() {
	const navigation = useNavigation();
	const { token } = useAuth() as any;

	const [activeTab, setActiveTab] = useState<'new' | 'results'>('new');
	const [batchName, setBatchName] = useState('');
	const [selectedTypes, setSelectedTypes] = useState<string[]>(
		SEARCH_TYPES.filter(t => t.default).map(t => t.id)
	);
	const [csvText, setCsvText] = useState('');
	const [manualRecords, setManualRecords] = useState<string>('');
	const [inputMode, setInputMode] = useState<'csv' | 'manual'>('manual');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<any>(null);
	const [previousBatches, setPreviousBatches] = useState<any[]>([]);
	const [loadingBatches, setLoadingBatches] = useState(false);

	const loadPreviousBatches = useCallback(async () => {
		setLoadingBatches(true);
		try {
			const resp = await fetch(`${API_BASE}/search/batch`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await resp.json();
			if (data.success) setPreviousBatches(data.data.searches || []);
		} catch {}
		setLoadingBatches(false);
	}, [token]);

	const toggleType = (id: string) => {
		setSelectedTypes(prev =>
			prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
		);
	};

	const parseManualInput = () => {
		const lines = manualRecords.trim().split('\n').filter(Boolean);
		return lines.map((line, idx) => {
			const parts = line.split(/[\t,;]/).map(p => p.trim());
			return {
				rowIndex: idx + 1,
				nom: parts[1] || parts[0] || '',
				prenom: parts[0] && parts[1] ? parts[0] : undefined,
				dateNaissance: parts[2] || undefined,
				nationalite: parts[3] || undefined,
			};
		}).filter(r => r.nom);
	};

	const runBatch = async () => {
		const records = inputMode === 'manual' ? parseManualInput() : [];

		if (records.length === 0 && inputMode === 'manual') {
			Alert.alert(
				'Format attendu',
				'Saisissez une personne par ligne:\nPrénom Nom[;date_naissance;nationalite]\n\nExemple:\nJean Dupont\nMarie Martin;01/01/1980;Française'
			);
			return;
		}
		if (selectedTypes.length === 0) {
			Alert.alert('Erreur', 'Sélectionnez au moins un type de recherche');
			return;
		}

		setLoading(true);
		setResult(null);

		try {
			const resp = await fetch(`${API_BASE}/search/batch`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					name: batchName || `Lot ${new Date().toLocaleDateString('fr-FR')}`,
					records,
					searchTypes: selectedTypes,
					confidenceThreshold: 0.72,
					concurrency: 3,
				}),
			});

			const data = await resp.json();
			if (data.success) {
				setResult(data.data);
				setActiveTab('results');
			} else {
				Alert.alert('Erreur', data.error?.message || 'Erreur lors de la recherche');
			}
		} catch (e) {
			Alert.alert('Erreur réseau', 'Impossible de contacter le serveur');
		} finally {
			setLoading(false);
		}
	};

	const exportCSV = async (batchId: string) => {
		try {
			const resp = await fetch(`${API_BASE}/search/batch/${batchId}/export`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const csv = await resp.text();
			Alert.alert('Export', `Données prêtes (${csv.length} caractères). Intégration partage fichier à configurer.`);
		} catch {
			Alert.alert('Erreur', 'Export impossible');
		}
	};

	const renderSummary = () => {
		if (!result) return null;
		const { summary, batchId } = result;

		return (
			<View>
				{/* Summary card */}
				<Card style={[styles.summaryCard, { borderLeftColor: summary.criticalCount > 0 ? '#7C3AED' : summary.highCount > 0 ? '#DC2626' : colors.success }]}>
					<Card.Content>
						<Text style={styles.summaryTitle}>{result.name}</Text>
						<Text style={styles.summarySubtitle}>
							{result.processedCount} personnes vérifiées · {result.hitCount} correspondance(s)
						</Text>

						<ProgressBar
							progress={result.processedCount / result.totalRecords}
							color={colors.success}
							style={styles.progressBar}
						/>

						<View style={styles.summaryStats}>
							{[
								{ label: 'Traités', value: summary.totalProcessed, color: colors.textPrimary },
								{ label: 'Alertes', value: summary.totalHits, color: summary.totalHits > 0 ? '#DC2626' : colors.success },
								{ label: 'Critiques', value: summary.criticalCount, color: '#7C3AED' },
								{ label: 'Taux', value: summary.hitRate, color: colors.textSecondary },
							].map(({ label, value, color }) => (
								<View key={label} style={styles.statBox}>
									<Text style={[styles.statValue, { color }]}>{value}</Text>
									<Text style={styles.statLabel}>{label}</Text>
								</View>
							))}
						</View>

						{/* By type breakdown */}
						<View style={styles.typeBreakdown}>
							{Object.entries(summary.byType || {}).filter(([, v]) => (v as number) > 0).map(([type, count]) => (
								<View key={type} style={styles.typeRow}>
									<Text style={styles.typeLabel}>{type}</Text>
									<Text style={styles.typeCount}>{String(count)}</Text>
								</View>
							))}
						</View>

						<View style={styles.exportRow}>
							<Button
								mode="outlined"
								icon="file-download"
								onPress={() => exportCSV(batchId)}
								compact
							>
								Exporter CSV
							</Button>
						</View>
					</Card.Content>
				</Card>

				{/* Top risk entities */}
				{(result.results || []).filter((r: any) => r.hasHit).slice(0, 20).map((r: any, i: number) => (
					<Card key={i} style={[styles.resultCard, { borderLeftColor: RISK_COLORS[r.riskLevel] }]}>
						<View style={styles.resultRow}>
							<View style={[styles.riskDot, { backgroundColor: RISK_COLORS[r.riskLevel] }]} />
							<View style={{ flex: 1 }}>
								<View style={styles.resultHeader}>
									<Text style={styles.resultName}>
										{r.prenom ? `${r.prenom} ${r.nom}` : r.nom}
									</Text>
									<Text style={[styles.riskLevel, { color: RISK_COLORS[r.riskLevel] }]}>
										{r.riskLevel}
									</Text>
								</View>
								{r.reference && <Text style={styles.resultRef}>Réf: {r.reference}</Text>}

								<View style={styles.hitsRow}>
									{r.sanctionsHit && <HitBadge label="Sanctions" color="#DC2626" />}
									{r.gelAvoirsHit && <HitBadge label="Gel avoirs" color="#7C3AED" />}
									{r.pepHit && <HitBadge label="PPE" color="#D97706" />}
									{r.interpolHit && <HitBadge label="Interpol" color="#DC2626" />}
									{r.paysRisqueHit && <HitBadge label="Pays risque" color="#D97706" />}
									{r.presseHit && <HitBadge label="Presse" color="#64748B" />}
								</View>

								{r.topMatches?.slice(0, 1).map((m: any, j: number) => (
									<Text key={j} style={styles.topMatch}>
										{m.source}: {m.name} ({(m.score * 100).toFixed(0)}%)
									</Text>
								))}
							</View>
						</View>
					</Card>
				))}

				{(result.results || []).filter((r: any) => !r.hasHit).length > 0 && (
					<Card style={styles.noHitCard}>
						<Card.Content>
							<View style={styles.noHitHeader}>
								<MaterialIcons name="check-circle" size={20} color={colors.success} />
								<Text style={styles.noHitText}>
									{(result.results || []).filter((r: any) => !r.hasHit).length} personne(s) sans alerte
								</Text>
							</View>
						</Card.Content>
					</Card>
				)}
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
			<AppHeader
				title="Recherche par Lot"
				subtitle="Vérification simultanée de multiples personnes"
				onBack={() => navigation.goBack()}
			/>

			{/* Tabs */}
			<View style={styles.tabs}>
				{[
					{ id: 'new', label: 'Nouvelle recherche' },
					{ id: 'results', label: result ? `Résultats (${result.hitCount} alertes)` : 'Résultats' },
				].map(tab => (
					<TouchableOpacity
						key={tab.id}
						style={[styles.tab, activeTab === tab.id && styles.tabActive]}
						onPress={() => {
							if (tab.id === 'results' && !result) {
								loadPreviousBatches();
							}
							setActiveTab(tab.id as any);
						}}
					>
						<Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
							{tab.label}
						</Text>
					</TouchableOpacity>
				))}
			</View>

			<ScrollView contentContainerStyle={styles.content}>
				{activeTab === 'new' ? (
					<View>
						<TextInput
							label="Nom du lot (optionnel)"
							value={batchName}
							onChangeText={setBatchName}
							mode="outlined"
							style={styles.input}
							dense
						/>

						{/* Input mode */}
						<View style={styles.inputModeTabs}>
							{[
								{ id: 'manual', label: '✏️ Saisie manuelle' },
								{ id: 'csv', label: '📄 CSV' },
							].map(m => (
								<TouchableOpacity
									key={m.id}
									style={[styles.modeTab, inputMode === m.id && styles.modeTabActive]}
									onPress={() => setInputMode(m.id as any)}
								>
									<Text style={[styles.modeTabText, inputMode === m.id && { color: '#fff' }]}>
										{m.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						{inputMode === 'manual' ? (
							<View>
								<Text style={styles.hint}>
									Une personne par ligne: Prénom Nom;DateNaissance;Nationalité{'\n'}
									Ex: Jean Dupont;01/01/1980;Française
								</Text>
								<TextInput
									label="Liste des personnes"
									value={manualRecords}
									onChangeText={setManualRecords}
									mode="outlined"
									multiline
									numberOfLines={10}
									style={styles.textArea}
									placeholder="Jean Dupont&#10;Marie Martin;01/01/1980&#10;Ahmed Ben Ali;15/03/1975;Tunisienne"
								/>
								{manualRecords.trim() && (
									<Text style={styles.recordCount}>
										{manualRecords.trim().split('\n').filter(l => l.trim()).length} personnes saisies
									</Text>
								)}
							</View>
						) : (
							<View style={styles.csvSection}>
								<Text style={styles.hint}>Format CSV: nom;prénom;date_naissance;nationalite;pays</Text>
								<TextInput
									label="Contenu CSV"
									value={csvText}
									onChangeText={setCsvText}
									mode="outlined"
									multiline
									numberOfLines={8}
									style={styles.textArea}
									placeholder="nom;prenom;date_naissance;nationalite&#10;Dupont;Jean;01/01/1980;Française"
								/>
							</View>
						)}

						{/* Search type selection */}
						<Text style={styles.sectionLabel}>Types de vérification</Text>
						<View style={styles.typesGrid}>
							{SEARCH_TYPES.map(type => (
								<TouchableOpacity
									key={type.id}
									style={[styles.typeItem, selectedTypes.includes(type.id) && styles.typeItemActive]}
									onPress={() => toggleType(type.id)}
								>
									<MaterialIcons
										name={type.icon as any}
										size={18}
										color={selectedTypes.includes(type.id) ? '#fff' : colors.textSecondary}
									/>
									<Text style={[styles.typeItemText, selectedTypes.includes(type.id) && { color: '#fff' }]}>
										{type.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						<Button
							mode="contained"
							onPress={runBatch}
							loading={loading}
							disabled={loading}
							style={styles.runButton}
							icon="search"
						>
							{loading ? 'Recherche en cours...' : 'Lancer la vérification'}
						</Button>

						{loading && (
							<View style={styles.loadingInfo}>
								<ProgressBar indeterminate color={colors.primary} style={{ marginBottom: 8 }} />
								<Text style={styles.loadingText}>Interrogation de 6+ sources OSINT...</Text>
							</View>
						)}
					</View>
				) : (
					renderSummary() || (
						<View style={styles.emptyResults}>
							<MaterialIcons name="playlist-play" size={48} color={colors.textTertiary} />
							<Text style={styles.emptyText}>Aucun résultat pour l'instant</Text>
							<Text style={styles.emptySubtext}>Lancez une recherche dans l'onglet "Nouvelle recherche"</Text>
						</View>
					)
				)}
			</ScrollView>
		</View>
	);
}

function HitBadge({ label, color }: { label: string; color: string }) {
	return (
		<View style={[styles.hitBadge, { backgroundColor: color + '20', borderColor: color }]}>
			<Text style={[styles.hitBadgeText, { color }]}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.background },
	content: { padding: 16, paddingBottom: 60 },
	tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
	tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
	tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
	tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
	tabTextActive: { color: colors.primary, fontWeight: '700' },
	input: { marginBottom: 12 },
	inputModeTabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 3, marginBottom: 12 },
	modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
	modeTabActive: { backgroundColor: colors.primary },
	modeTabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
	hint: { fontSize: 12, color: colors.textTertiary, marginBottom: 8, lineHeight: 18 },
	textArea: { marginBottom: 4 },
	recordCount: { fontSize: 12, color: colors.success, fontWeight: '600', marginBottom: 12 },
	csvSection: {},
	sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 10 },
	typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
	typeItem: {
		flexDirection: 'row', alignItems: 'center', gap: 6,
		paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
		borderWidth: 1.5, borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	typeItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
	typeItemText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
	runButton: { marginTop: 8 },
	loadingInfo: { marginTop: 16 },
	loadingText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
	summaryCard: {
		marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderLeftWidth: 4,
	},
	summaryTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
	summarySubtitle: { fontSize: 13, color: colors.textSecondary, marginVertical: 6 },
	progressBar: { height: 6, borderRadius: 3, marginBottom: 12 },
	summaryStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
	statBox: { alignItems: 'center' },
	statValue: { fontSize: 20, fontWeight: '700' },
	statLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
	typeBreakdown: { marginBottom: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
	typeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
	typeLabel: { fontSize: 12, color: colors.textSecondary },
	typeCount: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
	exportRow: { flexDirection: 'row', justifyContent: 'flex-end' },
	resultCard: {
		marginBottom: 8, borderRadius: 10, overflow: 'hidden',
		backgroundColor: colors.surface, borderLeftWidth: 3, padding: 10,
	},
	resultRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
	riskDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
	resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	resultName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
	riskLevel: { fontSize: 12, fontWeight: '700' },
	resultRef: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
	hitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
	hitBadge: {
		paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
	},
	hitBadgeText: { fontSize: 10, fontWeight: '600' },
	topMatch: { fontSize: 11, color: colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
	noHitCard: { marginTop: 8, borderRadius: 12 },
	noHitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	noHitText: { fontSize: 14, fontWeight: '600', color: colors.success },
	emptyResults: { alignItems: 'center', paddingTop: 60, gap: 12 },
	emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
	emptySubtext: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
});
