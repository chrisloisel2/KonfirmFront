import React, { useState, useEffect, useCallback } from 'react';
import {
	View, StyleSheet, FlatList, TouchableOpacity,
	StatusBar, RefreshControl, TextInput,
} from 'react-native';
import { Text, Card, Chip } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../../shared/services/AuthContext';

import { API_BASE } from '../../shared/config/api';

const EVENT_ICONS: Record<string, string> = {
	DOSSIER_CREATED:    'create-new-folder',
	DOSSIER_UPDATED:    'folder',
	DOCUMENT_UPLOADED:  'upload-file',
	SCORING_CALCULATED: 'speed',
	TRACFIN_DECLARATION:'gavel',
	AUDIT_LOGIN:        'login',
	AUDIT_LOGOUT:       'logout',
	AUDIT_CREATE:       'add-circle',
	AUDIT_UPDATE:       'edit',
	AUDIT_DELETE:       'delete',
	AUDIT_EXPORT:       'file-download',
	AUDIT_VALIDATION:   'verified',
	AUDIT_ACCESS_DENIED:'block',
};

const EVENT_COLORS: Record<string, string> = {
	info:    '#0284C7',
	success: '#059669',
	warning: '#D97706',
	error:   '#DC2626',
};

interface RouteParams {
	clientId?:  string;
	dossierId?: string;
	userId?:    string;
	title?:     string;
}

export default function TimelineScreen() {
	const navigation = useNavigation();
	const route = useRoute();
	const { token } = useAuth() as any;
	const params = (route.params as RouteParams) || {};

	const [events, setEvents] = useState<any[]>([]);
	const [filtered, setFiltered] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [search, setSearch] = useState('');
	const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');
	const [total, setTotal] = useState(0);

	const typeGroups = [
		{ label: 'Dossiers', types: ['DOSSIER'] },
		{ label: 'Documents', types: ['DOCUMENT'] },
		{ label: 'Exceptions', types: ['EXCEPTION'] },
		{ label: 'Recherches', types: ['RECHERCHE'] },
		{ label: 'Scoring', types: ['SCORING'] },
		{ label: 'TRACFIN', types: ['TRACFIN'] },
		{ label: 'Audit', types: ['AUDIT'] },
	];

	const loadTimeline = useCallback(async () => {
		setLoading(true);
		try {
			const queryParams = new URLSearchParams();
			if (params.clientId)  queryParams.set('clientId',  params.clientId);
			if (params.dossierId) queryParams.set('dossierId', params.dossierId);
			if (params.userId)    queryParams.set('userId',    params.userId);
			if (dateFrom)         queryParams.set('dateFrom',  dateFrom);
			if (dateTo)           queryParams.set('dateTo',    dateTo);
			queryParams.set('limit', '500');

			const resp = await fetch(`${API_BASE}/intelligence/timeline?${queryParams}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await resp.json();

			if (data.success) {
				setEvents(data.data.events || []);
				setTotal(data.data.total || 0);
			}
		} catch (e) {
			console.error('Timeline error:', e);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [token, params.clientId, params.dossierId, params.userId, dateFrom, dateTo]);

	useEffect(() => { loadTimeline(); }, [loadTimeline]);

	useEffect(() => {
		let result = events;

		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter(e =>
				e.title.toLowerCase().includes(q) ||
				e.description.toLowerCase().includes(q) ||
				e.type.toLowerCase().includes(q)
			);
		}

		if (selectedTypes.length > 0) {
			result = result.filter(e =>
				selectedTypes.some(t => e.entityType === t || e.type.startsWith(t))
			);
		}

		setFiltered(result);
	}, [events, search, selectedTypes]);

	const toggleType = (typeGroup: { label: string; types: string[] }) => {
		const newTypes = [...selectedTypes];
		const allSelected = typeGroup.types.every(t => selectedTypes.includes(t));
		if (allSelected) {
			typeGroup.types.forEach(t => {
				const i = newTypes.indexOf(t);
				if (i !== -1) newTypes.splice(i, 1);
			});
		} else {
			typeGroup.types.forEach(t => {
				if (!newTypes.includes(t)) newTypes.push(t);
			});
		}
		setSelectedTypes(newTypes);
	};

	const groupByDate = (evts: any[]) => {
		const groups: { [date: string]: any[] } = {};
		for (const e of evts) {
			const date = new Date(e.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
			if (!groups[date]) groups[date] = [];
			groups[date].push(e);
		}
		return Object.entries(groups).map(([date, items]) => ({ date, items }));
	};

	const grouped = groupByDate(filtered);
	const flatData: any[] = [];
	for (const g of grouped) {
		flatData.push({ type: 'header', date: g.date });
		for (const item of g.items) {
			flatData.push({ type: 'event', ...item });
		}
	}

	const renderItem = ({ item }: { item: any }) => {
		if (item.type === 'header') {
			return (
				<View style={styles.dateHeader}>
					<View style={styles.dateLine} />
					<Text style={styles.dateText}>{item.date}</Text>
					<View style={styles.dateLine} />
				</View>
			);
		}

		const icon = EVENT_ICONS[item.type] || 'radio-button-on';
		const color = EVENT_COLORS[item.severity] || EVENT_COLORS.info;
		const time = new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

		return (
			<View style={styles.eventRow}>
				{/* Timeline line */}
				<View style={styles.timelineColumn}>
					<Text style={styles.timeText}>{time}</Text>
					<View style={[styles.eventDot, { backgroundColor: color }]}>
						<MaterialIcons name={icon as any} size={12} color="#fff" />
					</View>
					<View style={[styles.verticalLine, { backgroundColor: color + '30' }]} />
				</View>

				{/* Event card */}
				<Card style={[styles.eventCard, { borderLeftColor: color, borderLeftWidth: 2 }]}>
					<View style={styles.eventContent}>
						<Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
						<Text style={styles.eventDescription} numberOfLines={3}>{item.description}</Text>

						<View style={styles.eventMeta}>
							<Chip compact textStyle={styles.entityTypeText} style={styles.entityTypeChip}>
								{item.entityType}
							</Chip>
							{item.dossierNumero && (
								<Text style={styles.dossierRef}>{item.dossierNumero}</Text>
							)}
							{item.userName && (
								<Text style={styles.userName}>
									<MaterialIcons name="person" size={10} /> {item.userName}
								</Text>
							)}
						</View>
					</View>
				</Card>
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
			<AppHeader
				title={params.title || 'Frise Chronologique'}
				subtitle={`${total} événement${total !== 1 ? 's' : ''} dans l'historique`}
				onBack={() => navigation.goBack()}
			/>

			{/* Filters */}
			<View style={styles.filtersContainer}>
				<View style={styles.searchRow}>
					<MaterialIcons name="search" size={18} color={colors.textTertiary} style={{ marginRight: 6 }} />
					<TextInput
						style={styles.searchInput}
						placeholder="Filtrer les événements..."
						placeholderTextColor={colors.textTertiary}
						value={search}
						onChangeText={setSearch}
					/>
					{search.length > 0 && (
						<TouchableOpacity onPress={() => setSearch('')}>
							<MaterialIcons name="close" size={18} color={colors.textTertiary} />
						</TouchableOpacity>
					)}
				</View>

				<FlatList
					horizontal
					showsHorizontalScrollIndicator={false}
					data={typeGroups}
					keyExtractor={g => g.label}
					contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}
					renderItem={({ item }) => {
						const isActive = item.types.every(t => selectedTypes.includes(t));
						return (
							<TouchableOpacity
								style={[styles.filterChip, isActive && styles.filterChipActive]}
								onPress={() => toggleType(item)}
							>
								<Text style={[styles.filterChipText, isActive && { color: '#fff' }]}>
									{item.label}
								</Text>
							</TouchableOpacity>
						);
					}}
				/>

				{filtered.length !== events.length && (
					<Text style={styles.filterInfo}>
						{filtered.length}/{events.length} événements affichés
					</Text>
				)}
			</View>

			{loading ? (
				<View style={styles.centered}>
					<Text style={styles.loadingText}>Chargement de l'historique...</Text>
				</View>
			) : (
				<FlatList
					data={flatData}
					keyExtractor={(item, idx) => item.id || `${item.type}-${idx}`}
					renderItem={renderItem}
					contentContainerStyle={styles.listContent}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadTimeline} />}
					ListEmptyComponent={
						<View style={styles.emptyState}>
							<MaterialIcons name="timeline" size={48} color={colors.textTertiary} />
							<Text style={styles.emptyText}>Aucun événement trouvé</Text>
						</View>
					}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.background },
	filtersContainer: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
	searchRow: {
		flexDirection: 'row', alignItems: 'center',
		marginHorizontal: 12, marginTop: 8,
		backgroundColor: colors.surfaceAlt,
		borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
	},
	searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
	filterChip: {
		paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
		borderRadius: 16, backgroundColor: colors.surfaceAlt,
		borderWidth: 1, borderColor: colors.border,
	},
	filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
	filterChipText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
	filterInfo: { fontSize: 11, color: colors.textTertiary, paddingHorizontal: 12, paddingBottom: 6 },
	listContent: { padding: 12, paddingBottom: 60 },
	dateHeader: {
		flexDirection: 'row', alignItems: 'center',
		marginVertical: 12, paddingHorizontal: 4,
	},
	dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
	dateText: {
		fontSize: 12, fontWeight: '600', color: colors.textTertiary,
		marginHorizontal: 10, textTransform: 'uppercase', letterSpacing: 0.5,
	},
	eventRow: { flexDirection: 'row', marginBottom: 8 },
	timelineColumn: { width: 56, alignItems: 'center' },
	timeText: { fontSize: 10, color: colors.textTertiary, marginBottom: 4 },
	eventDot: {
		width: 24, height: 24, borderRadius: 12,
		alignItems: 'center', justifyContent: 'center',
		shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
	},
	verticalLine: { flex: 1, width: 2, marginTop: 2 },
	eventCard: { flex: 1, marginLeft: 8, borderRadius: 10, backgroundColor: colors.surface },
	eventContent: { padding: 10 },
	eventTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, lineHeight: 18 },
	eventDescription: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
	eventMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' },
	entityTypeChip: { height: 20, backgroundColor: colors.accentLight },
	entityTypeText: { fontSize: 9, color: colors.primary },
	dossierRef: { fontSize: 10, color: colors.textTertiary, fontFamily: 'monospace' },
	userName: { fontSize: 10, color: colors.textTertiary },
	centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	loadingText: { color: colors.textSecondary, fontSize: 14 },
	emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
	emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
});
