import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
	View, StyleSheet, FlatList, TouchableOpacity,
	TextInput, ActivityIndicator, Animated, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, Chip, Card, Badge, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../../shared/services/AuthContext';

import { API_BASE } from '../../shared/config/api';

type EntityType = 'CLIENT' | 'DOSSIER' | 'DOCUMENT' | 'EXCEPTION' | 'TRACFIN' | 'AUDIT' | 'RECHERCHE' | 'SCORING';

const ENTITY_CONFIG: Record<EntityType, { icon: string; color: string; label: string }> = {
	CLIENT:    { icon: 'person', color: '#2563EB', label: 'Client' },
	DOSSIER:   { icon: 'folder', color: '#059669', label: 'Dossier' },
	DOCUMENT:  { icon: 'description', color: '#7C3AED', label: 'Document' },
	EXCEPTION: { icon: 'warning', color: '#D97706', label: 'Exception' },
	TRACFIN:   { icon: 'gavel', color: '#DC2626', label: 'TRACFIN' },
	AUDIT:     { icon: 'history', color: '#64748B', label: 'Audit' },
	RECHERCHE: { icon: 'search', color: '#0284C7', label: 'Recherche' },
	SCORING:   { icon: 'speed', color: '#D97706', label: 'Scoring' },
};

const RISK_COLOR: Record<string, string> = {
	CRITIQUE: '#7C3AED',
	ELEVE:    '#DC2626',
	MOYEN:    '#D97706',
	FAIBLE:   '#059669',
};

interface SearchResult {
	entityType: EntityType;
	entityId:   string;
	score:      number;
	highlight:  Record<string, string>;
	data:       any;
	dossierId?: string;
	dossierNumero?: string;
	clientName?: string;
}

interface SearchFacets {
	CLIENT: number; DOSSIER: number; DOCUMENT: number; EXCEPTION: number;
	TRACFIN: number; AUDIT: number; RECHERCHE: number; SCORING: number;
}

interface SearchResponse {
	results: SearchResult[];
	total: number;
	totalByType: SearchFacets;
	page: number;
	hasMore: boolean;
	durationMs: number;
	suggestions?: string[];
}

export default function UniversalSearchScreen() {
	const navigation = useNavigation();
	const { token } = useAuth() as any;

	const [query, setQuery] = useState('');
	const [results, setResults] = useState<SearchResult[]>([]);
	const [facets, setFacets] = useState<SearchFacets | null>(null);
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([]);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [total, setTotal] = useState(0);
	const [durationMs, setDurationMs] = useState(0);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [recentSearches, setRecentSearches] = useState<string[]>([]);

	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fadeAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		loadRecentSearches();
	}, []);

	const loadRecentSearches = async () => {
		try {
			const resp = await fetch(`${API_BASE}/search/history?limit=8`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await resp.json();
			setRecentSearches((data.data?.history || []).map((h: any) => h.query));
		} catch {}
	};

	const fetchSuggestions = useCallback(async (q: string) => {
		if (q.length < 2) { setSuggestions([]); return; }
		try {
			const resp = await fetch(`${API_BASE}/search/suggestions?q=${encodeURIComponent(q)}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await resp.json();
			setSuggestions(data.data?.suggestions || []);
		} catch {}
	}, [token]);

	const performSearch = useCallback(async (q: string, pageNum = 1, append = false) => {
		if (!q.trim()) { setResults([]); setTotal(0); setFacets(null); return; }

		if (pageNum === 1) setLoading(true);
		else setLoadingMore(true);

		try {
			const types = selectedTypes.length > 0 ? selectedTypes.join(',') : '';
			const url = `${API_BASE}/search?q=${encodeURIComponent(q)}&page=${pageNum}&limit=20${types ? `&types=${types}` : ''}`;

			const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
			const data = await resp.json();

			if (data.success) {
				const r: SearchResponse = data.data;
				if (append) {
					setResults(prev => [...prev, ...r.results]);
				} else {
					setResults(r.results);
					Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
				}
				setFacets(r.totalByType);
				setTotal(r.total);
				setHasMore(r.hasMore);
				setPage(pageNum);
				setDurationMs(r.durationMs);
				setSuggestions(r.suggestions || []);
			}
		} catch (e) {
			console.error('Search error:', e);
		} finally {
			setLoading(false);
			setLoadingMore(false);
		}
	}, [token, selectedTypes, fadeAnim]);

	const handleQueryChange = (text: string) => {
		setQuery(text);
		setShowSuggestions(true);
		fadeAnim.setValue(0);

		if (searchTimer.current) clearTimeout(searchTimer.current);
		searchTimer.current = setTimeout(() => {
			performSearch(text, 1);
			fetchSuggestions(text);
		}, 350);
	};

	const handleSuggestionPress = (s: string) => {
		setQuery(s);
		setShowSuggestions(false);
		performSearch(s, 1);
	};

	const toggleType = (type: EntityType) => {
		const next = selectedTypes.includes(type)
			? selectedTypes.filter(t => t !== type)
			: [...selectedTypes, type];
		setSelectedTypes(next);
		if (query.trim()) performSearch(query, 1);
	};

	const loadMore = () => {
		if (!hasMore || loadingMore) return;
		performSearch(query, page + 1, true);
	};

	const navigateToResult = (result: SearchResult) => {
		switch (result.entityType) {
			case 'CLIENT':
			case 'DOSSIER':
				(navigation as any).navigate('DossierDetail', { dossierId: result.dossierId || result.entityId });
				break;
			case 'EXCEPTION':
				(navigation as any).navigate('Exceptions', { dossierId: result.dossierId });
				break;
			default:
				if (result.dossierId) {
					(navigation as any).navigate('DossierDetail', { dossierId: result.dossierId });
				}
				break;
		}
	};

	const renderResult = ({ item }: { item: SearchResult }) => {
		const cfg = ENTITY_CONFIG[item.entityType] || ENTITY_CONFIG.DOSSIER;
		const relevance = Math.round(item.score * 100);

		const title =
			item.clientName ||
			item.highlight?.nom ? `${item.highlight.prenom || ''} ${item.highlight.nom}`.trim() :
			item.highlight?.numero ||
			item.highlight?.fileName ||
			item.entityId;

		const subtitle = Object.entries(item.highlight)
			.filter(([k]) => !['nom', 'prenom'].includes(k))
			.map(([, v]) => v)
			.filter(Boolean)
			.slice(0, 2)
			.join(' · ');

		return (
			<TouchableOpacity onPress={() => navigateToResult(item)} activeOpacity={0.7}>
				<Animated.View style={{ opacity: fadeAnim }}>
					<Card style={styles.resultCard} elevation={1}>
						<View style={styles.resultRow}>
							<View style={[styles.entityIcon, { backgroundColor: cfg.color + '18' }]}>
								<MaterialIcons name={cfg.icon as any} size={20} color={cfg.color} />
							</View>
							<View style={styles.resultContent}>
								<View style={styles.resultHeader}>
									<Text style={styles.resultTitle} numberOfLines={1}>{title}</Text>
									<View style={[styles.relevanceBadge, { backgroundColor: relevance >= 80 ? '#ECFDF5' : '#F8FAFC' }]}>
										<Text style={[styles.relevanceText, { color: relevance >= 80 ? colors.success : colors.textTertiary }]}>
											{relevance}%
										</Text>
									</View>
								</View>

								<View style={styles.resultMeta}>
									<Chip
										mode="flat"
										style={[styles.typeChip, { backgroundColor: cfg.color + '15' }]}
										textStyle={[styles.typeChipText, { color: cfg.color }]}
										compact
									>
										{cfg.label}
									</Chip>
									{item.dossierNumero && (
										<Text style={styles.dossierRef}>{item.dossierNumero}</Text>
									)}
								</View>

								{subtitle ? (
									<Text style={styles.resultSubtitle} numberOfLines={2}>{subtitle}</Text>
								) : null}
							</View>
							<MaterialIcons name="chevron-right" size={18} color={colors.textTertiary} />
						</View>
					</Card>
				</Animated.View>
			</TouchableOpacity>
		);
	};

	const renderFacets = () => {
		if (!facets) return null;
		return (
			<View style={styles.facetsContainer}>
				<FlatList
					horizontal
					showsHorizontalScrollIndicator={false}
					data={Object.entries(ENTITY_CONFIG) as [EntityType, any][]}
					keyExtractor={([type]) => type}
					renderItem={({ item: [type, cfg] }) => {
						const count = facets[type] || 0;
						const selected = selectedTypes.includes(type);
						return (
							<TouchableOpacity
								onPress={() => toggleType(type)}
								style={[
									styles.facetChip,
									selected && { backgroundColor: cfg.color, borderColor: cfg.color },
									count === 0 && { opacity: 0.4 }
								]}
							>
								<MaterialIcons
									name={cfg.icon as any}
									size={14}
									color={selected ? '#fff' : cfg.color}
								/>
								<Text style={[styles.facetLabel, selected && { color: '#fff' }]}>
									{cfg.label}
								</Text>
								{count > 0 && (
									<View style={[styles.facetCount, { backgroundColor: selected ? 'rgba(255,255,255,0.3)' : cfg.color + '20' }]}>
										<Text style={[styles.facetCountText, { color: selected ? '#fff' : cfg.color }]}>
											{count}
										</Text>
									</View>
								)}
							</TouchableOpacity>
						);
					}}
					contentContainerStyle={{ paddingHorizontal: spacing.lg }}
				/>
			</View>
		);
	};

	const renderEmptyState = () => {
		if (loading) return null;
		if (!query.trim()) {
			return (
				<View style={styles.emptyState}>
					<MaterialIcons name="search" size={64} color={colors.textTertiary} />
					<Text style={styles.emptyTitle}>Recherche universelle</Text>
					<Text style={styles.emptySubtitle}>
						Cherchez dans tous vos dossiers, clients, documents, exceptions, TRACFIN et audits simultanément
					</Text>
					{recentSearches.length > 0 && (
						<View style={styles.recentSection}>
							<Text style={styles.recentTitle}>Recherches récentes</Text>
							{recentSearches.map((s, i) => (
								<TouchableOpacity key={i} style={styles.recentItem} onPress={() => handleSuggestionPress(s)}>
									<MaterialIcons name="history" size={16} color={colors.textTertiary} />
									<Text style={styles.recentText}>{s}</Text>
								</TouchableOpacity>
							))}
						</View>
					)}
					<View style={styles.quickLinks}>
						<Text style={styles.recentTitle}>Recherche avancée</Text>
						<View style={styles.quickLinkRow}>
							<TouchableOpacity
								style={styles.quickLink}
								onPress={() => (navigation as any).navigate('AdvancedSearch')}
							>
								<MaterialIcons name="tune" size={24} color={colors.primary} />
								<Text style={styles.quickLinkText}>50+ filtres</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.quickLink}
								onPress={() => (navigation as any).navigate('Intelligence')}
							>
								<MaterialIcons name="policy" size={24} color={colors.primary} />
								<Text style={styles.quickLinkText}>Rapport OSINT</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.quickLink}
								onPress={() => (navigation as any).navigate('Watchlist')}
							>
								<MaterialIcons name="notifications-active" size={24} color={colors.primary} />
								<Text style={styles.quickLinkText}>Surveillance</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.quickLink}
								onPress={() => (navigation as any).navigate('BatchSearch')}
							>
								<MaterialIcons name="list" size={24} color={colors.primary} />
								<Text style={styles.quickLinkText}>Lot CSV</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			);
		}
		if (results.length === 0) {
			return (
				<View style={styles.emptyState}>
					<MaterialIcons name="search-off" size={48} color={colors.textTertiary} />
					<Text style={styles.emptyTitle}>Aucun résultat</Text>
					<Text style={styles.emptySubtitle}>Aucune correspondance pour « {query} »</Text>
					<TouchableOpacity
						style={styles.osintButton}
						onPress={() => (navigation as any).navigate('Intelligence', { nom: query.split(' ').pop(), prenom: query.split(' ').slice(0, -1).join(' ') })}
					>
						<MaterialIcons name="travel-explore" size={18} color="#fff" />
						<Text style={styles.osintButtonText}>Lancer une recherche OSINT externe</Text>
					</TouchableOpacity>
				</View>
			);
		}
		return null;
	};

	return (
		<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
			<StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
			<AppHeader
				title="Recherche"
				subtitle="Omnisearch — tous les systèmes"
				onBack={() => navigation.goBack()}
			>
				<View style={styles.searchBarContainer}>
					<View style={styles.searchBar}>
						<MaterialIcons name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
						<TextInput
							style={styles.searchInput}
							placeholder="Nom, dossier, document, exception..."
							placeholderTextColor={colors.textTertiary}
							value={query}
							onChangeText={handleQueryChange}
							onFocus={() => setShowSuggestions(true)}
							autoFocus
							autoCorrect={false}
							returnKeyType="search"
							onSubmitEditing={() => performSearch(query, 1)}
						/>
						{query.length > 0 && (
							<TouchableOpacity onPress={() => { setQuery(''); setResults([]); setTotal(0); setFacets(null); }}>
								<MaterialIcons name="close" size={20} color={colors.textTertiary} />
							</TouchableOpacity>
						)}
					</View>
					{total > 0 && (
						<Text style={styles.resultCount}>
							{total} résultat{total > 1 ? 's' : ''} · {durationMs}ms
						</Text>
					)}
				</View>
			</AppHeader>

			{/* Suggestions overlay */}
			{showSuggestions && suggestions.length > 0 && query.trim() && (
				<View style={styles.suggestionsContainer}>
					{suggestions.map((s, i) => (
						<TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => handleSuggestionPress(s)}>
							<MaterialIcons name="search" size={16} color={colors.textTertiary} />
							<Text style={styles.suggestionText}>{s}</Text>
						</TouchableOpacity>
					))}
				</View>
			)}

			{/* Facets */}
			{renderFacets()}

			{/* Results */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingText}>Recherche en cours...</Text>
				</View>
			) : (
				<FlatList
					data={results}
					keyExtractor={(item, idx) => `${item.entityType}-${item.entityId}-${idx}`}
					renderItem={renderResult}
					ListEmptyComponent={renderEmptyState}
					contentContainerStyle={styles.listContent}
					onEndReached={loadMore}
					onEndReachedThreshold={0.3}
					ListFooterComponent={
						loadingMore ? (
							<View style={styles.loadingMore}>
								<ActivityIndicator size="small" color={colors.primary} />
							</View>
						) : hasMore ? (
							<TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
								<Text style={styles.loadMoreText}>Charger plus de résultats</Text>
							</TouchableOpacity>
						) : null
					}
				/>
			)}

			{/* Bottom action bar */}
			<View style={styles.bottomBar}>
				<TouchableOpacity
					style={styles.bottomAction}
					onPress={() => (navigation as any).navigate('AdvancedSearch')}
				>
					<MaterialIcons name="tune" size={20} color={colors.primary} />
					<Text style={styles.bottomActionText}>Filtres avancés</Text>
				</TouchableOpacity>
				<View style={styles.bottomDivider} />
				<TouchableOpacity
					style={styles.bottomAction}
					onPress={() => (navigation as any).navigate('Intelligence')}
				>
					<MaterialIcons name="policy" size={20} color={colors.primary} />
					<Text style={styles.bottomActionText}>OSINT</Text>
				</TouchableOpacity>
				<View style={styles.bottomDivider} />
				<TouchableOpacity
					style={styles.bottomAction}
					onPress={() => (navigation as any).navigate('Watchlist')}
				>
					<MaterialIcons name="notifications" size={20} color={colors.primary} />
					<Text style={styles.bottomActionText}>Watchlist</Text>
				</TouchableOpacity>
				<View style={styles.bottomDivider} />
				<TouchableOpacity
					style={styles.bottomAction}
					onPress={() => (navigation as any).navigate('BatchSearch')}
				>
					<MaterialIcons name="upload-file" size={20} color={colors.primary} />
					<Text style={styles.bottomActionText}>Lot</Text>
				</TouchableOpacity>
			</View>
		</KeyboardAvoidingView>
	);
}

const screenSpacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as any;

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.background },
	searchBarContainer: { marginTop: 8, marginBottom: 4 },
	searchBar: {
		flexDirection: 'row', alignItems: 'center',
		backgroundColor: 'rgba(255,255,255,0.15)',
		borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
		borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
	},
	searchIcon: { marginRight: 8 },
	searchInput: { flex: 1, fontSize: 15, color: '#fff', paddingVertical: 0 },
	resultCount: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'right' },
	suggestionsContainer: {
		position: 'absolute', top: 120, left: 0, right: 0,
		backgroundColor: '#fff', zIndex: 100, elevation: 8,
		borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
		shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
	},
	suggestionItem: {
		flexDirection: 'row', alignItems: 'center',
		paddingHorizontal: 16, paddingVertical: 12,
		borderBottomWidth: 1, borderBottomColor: colors.border,
	},
	suggestionText: { marginLeft: 12, fontSize: 14, color: colors.textPrimary },
	facetsContainer: { paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
	facetChip: {
		flexDirection: 'row', alignItems: 'center', gap: 4,
		paddingHorizontal: 10, paddingVertical: 6, marginRight: 8,
		borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	facetLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
	facetCount: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, minWidth: 20, alignItems: 'center' },
	facetCountText: { fontSize: 10, fontWeight: '700' },
	listContent: { padding: 16, paddingBottom: 80 },
	resultCard: { marginBottom: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
	resultRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
	entityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
	resultContent: { flex: 1, gap: 4 },
	resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	resultTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
	relevanceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 8 },
	relevanceText: { fontSize: 10, fontWeight: '700' },
	resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	typeChip: { height: 22, paddingHorizontal: 2 },
	typeChipText: { fontSize: 10, fontWeight: '600' },
	dossierRef: { fontSize: 11, color: colors.textTertiary, fontFamily: 'monospace' },
	resultSubtitle: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
	loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
	loadingText: { color: colors.textSecondary, fontSize: 14 },
	emptyState: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
	emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
	emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
	recentSection: { width: '100%', marginTop: 24 },
	recentTitle: { fontSize: 13, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
	recentItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
	recentText: { fontSize: 14, color: colors.textSecondary },
	quickLinks: { width: '100%', marginTop: 20 },
	quickLinkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
	quickLink: {
		flex: 1, minWidth: '44%', alignItems: 'center', gap: 6,
		paddingVertical: 16, borderRadius: 12,
		backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
	},
	quickLinkText: { fontSize: 12, fontWeight: '600', color: colors.primary },
	osintButton: {
		flexDirection: 'row', alignItems: 'center', gap: 8,
		backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12,
		borderRadius: 12, marginTop: 16,
	},
	osintButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
	loadingMore: { paddingVertical: 16, alignItems: 'center' },
	loadMoreBtn: { alignItems: 'center', paddingVertical: 14 },
	loadMoreText: { color: colors.primary, fontWeight: '600' },
	bottomBar: {
		position: 'absolute', bottom: 0, left: 0, right: 0,
		flexDirection: 'row', backgroundColor: colors.surface,
		borderTopWidth: 1, borderTopColor: colors.border,
		paddingBottom: Platform.OS === 'ios' ? 20 : 0,
	},
	bottomAction: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
	bottomActionText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
	bottomDivider: { width: 1, backgroundColor: colors.border, marginVertical: 6 },
});
