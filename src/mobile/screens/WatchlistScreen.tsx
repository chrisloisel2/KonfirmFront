import React, { useState, useEffect, useCallback } from 'react';
import {
	View, StyleSheet, FlatList, TouchableOpacity,
	StatusBar, RefreshControl, Alert, Platform,
} from 'react-native';
import { Text, Card, Button, Chip, FAB, Badge } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/theme';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../../shared/services/AuthContext';

import { API_BASE } from '../../shared/config/api';

const SEVERITY_COLORS: Record<string, string> = {
	CRITICAL: '#7C3AED',
	HIGH:     '#DC2626',
	MEDIUM:   '#D97706',
	LOW:      '#059669',
};

const FREQ_LABELS: Record<string, string> = {
	REALTIME: '⚡ Temps réel',
	HOURLY:   '🕐 Toutes les heures',
	DAILY:    '📅 Quotidien',
	WEEKLY:   '📆 Hebdomadaire',
};

export default function WatchlistScreen() {
	const navigation = useNavigation();
	const { token } = useAuth() as any;

	const [watchlists, setWatchlists] = useState<any[]>([]);
	const [alerts, setAlerts] = useState<any[]>([]);
	const [stats, setStats] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [activeTab, setActiveTab] = useState<'watchlists' | 'alerts'>('watchlists');
	const [checkingId, setCheckingId] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		try {
			const [wlResp, alertsResp, statsResp] = await Promise.all([
				fetch(`${API_BASE}/watchlists`, { headers: { Authorization: `Bearer ${token}` } }),
				fetch(`${API_BASE}/watchlists/alerts`, { headers: { Authorization: `Bearer ${token}` } }),
				fetch(`${API_BASE}/watchlists/stats`, { headers: { Authorization: `Bearer ${token}` } }),
			]);

			const [wlData, alertsData, statsData] = await Promise.all([
				wlResp.json(), alertsResp.json(), statsResp.json()
			]);

			if (wlData.success) setWatchlists(wlData.data.watchlists || []);
			if (alertsData.success) setAlerts(alertsData.data.alerts || []);
			if (statsData.success) setStats(statsData.data);
		} catch (e) {
			console.error('Load watchlists error:', e);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [token]);

	useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

	const handleCheck = async (id: string) => {
		setCheckingId(id);
		try {
			const resp = await fetch(`${API_BASE}/watchlists/${id}/check`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await resp.json();
			if (data.success) {
				const { totalNewAlerts } = data.data;
				if (totalNewAlerts > 0) {
					Alert.alert(
						'Nouvelles alertes',
						`${totalNewAlerts} nouvelle(s) alerte(s) détectée(s)`,
						[{ text: 'Voir', onPress: () => setActiveTab('alerts') }, { text: 'OK' }]
					);
				} else {
					Alert.alert('Vérification terminée', 'Aucun changement détecté.');
				}
				await loadData();
			}
		} catch {
			Alert.alert('Erreur', 'Impossible de lancer la vérification');
		} finally {
			setCheckingId(null);
		}
	};

	const handleDelete = (id: string, name: string) => {
		Alert.alert('Supprimer', `Supprimer la watchlist "${name}" ?`, [
			{ text: 'Annuler', style: 'cancel' },
			{
				text: 'Supprimer', style: 'destructive',
				onPress: async () => {
					await fetch(`${API_BASE}/watchlists/${id}`, {
						method: 'DELETE',
						headers: { Authorization: `Bearer ${token}` },
					});
					await loadData();
				}
			}
		]);
	};

	const markAllRead = async () => {
		await fetch(`${API_BASE}/watchlists/alerts/read`, {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ alertIds: 'all' }),
		});
		await loadData();
	};

	const renderWatchlist = ({ item }: { item: any }) => {
		const unreadCount = (item.alerts || []).filter((a: any) => !a.isRead).length;
		const entityCount = (item.entities || []).length;

		return (
			<Card style={[styles.card, { borderLeftColor: item.color || colors.primary, borderLeftWidth: 3 }]}>
				<View style={styles.cardContent}>
					<View style={styles.cardHeader}>
						<View style={{ flex: 1 }}>
							<View style={styles.cardTitleRow}>
								<Text style={styles.cardTitle}>{item.name}</Text>
								{unreadCount > 0 && (
									<Badge style={[styles.unreadBadge, { backgroundColor: '#DC2626' }]}>
										{unreadCount}
									</Badge>
								)}
							</View>
							{item.description && (
								<Text style={styles.cardDescription} numberOfLines={1}>{item.description}</Text>
							)}
						</View>
					</View>

					<View style={styles.cardMeta}>
						<Chip compact textStyle={styles.chipText} style={styles.chip}>
							{entityCount} entité{entityCount !== 1 ? 's' : ''}
						</Chip>
						<Chip compact textStyle={styles.chipText} style={styles.chip}>
							{FREQ_LABELS[item.checkFrequency] || item.checkFrequency}
						</Chip>
						{item.lastCheckedAt && (
							<Text style={styles.lastChecked}>
								Dernière vérif: {new Date(item.lastCheckedAt).toLocaleDateString('fr-FR')}
							</Text>
						)}
					</View>

					{/* Entities preview */}
					<View style={styles.entitiesPreview}>
						{(item.entities || []).slice(0, 3).map((e: any, i: number) => (
							<View key={i} style={styles.entityTag}>
								<MaterialIcons
									name={e.type === 'CLIENT' ? 'person' : e.type === 'DOSSIER' ? 'folder' : 'public'}
									size={12}
									color={colors.textSecondary}
								/>
								<Text style={styles.entityTagText} numberOfLines={1}>
									{e.prenom ? `${e.prenom} ${e.nom}` : e.nom}
								</Text>
							</View>
						))}
						{(item.entities || []).length > 3 && (
							<Text style={styles.moreEntities}>+{item.entities.length - 3} autres</Text>
						)}
					</View>

					<View style={styles.cardActions}>
						<TouchableOpacity
							style={[styles.action, styles.actionCheck]}
							onPress={() => handleCheck(item.id)}
							disabled={checkingId === item.id}
						>
							<MaterialIcons
								name={checkingId === item.id ? 'sync' : 'refresh'}
								size={16}
								color={colors.primary}
							/>
							<Text style={styles.actionText}>{checkingId === item.id ? 'Vérif...' : 'Vérifier'}</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.action, styles.actionDelete]}
							onPress={() => handleDelete(item.id, item.name)}
						>
							<MaterialIcons name="delete-outline" size={16} color="#DC2626" />
							<Text style={[styles.actionText, { color: '#DC2626' }]}>Supprimer</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Card>
		);
	};

	const renderAlert = ({ item }: { item: any }) => (
		<Card style={[styles.alertCard, item.isRead && { opacity: 0.7 }]}>
			<View style={styles.alertRow}>
				<View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[item.severity] || '#64748B' }]} />
				<View style={{ flex: 1 }}>
					<View style={styles.alertHeader}>
						<Text style={styles.alertTitle} numberOfLines={1}>{item.title}</Text>
						<Text style={styles.alertTime}>
							{new Date(item.createdAt).toLocaleDateString('fr-FR')}
						</Text>
					</View>
					<Text style={styles.alertEntity}>{item.entityName}</Text>
					<Text style={styles.alertDesc} numberOfLines={2}>{item.description}</Text>
					<View style={styles.alertMeta}>
						<Chip
							compact textStyle={{ fontSize: 10 }}
							style={[styles.severityChip, { backgroundColor: SEVERITY_COLORS[item.severity] + '15' }]}
						>
							{item.severity}
						</Chip>
						<Text style={styles.watchlistName}>{item.watchlist?.name}</Text>
					</View>
				</View>
			</View>
		</Card>
	);

	return (
		<View style={styles.container}>
			<StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
			<AppHeader
				title="Surveillance"
				subtitle="Watchlists & Alertes temps réel"
				onBack={() => navigation.goBack()}
			>
				{/* Stats bar */}
				{stats && (
					<View style={styles.statsBar}>
						{[
							{ label: 'Listes', value: stats.totalWatchlists },
							{ label: 'Entités', value: stats.totalEntities },
							{ label: 'Non lues', value: stats.unreadAlerts, danger: stats.unreadAlerts > 0 },
							{ label: 'Critiques', value: stats.criticalAlerts, danger: stats.criticalAlerts > 0 },
						].map(({ label, value, danger }) => (
							<View key={label} style={styles.statItem}>
								<Text style={[styles.statValue, danger && value > 0 && { color: '#DC2626' }]}>
									{value}
								</Text>
								<Text style={styles.statLabel}>{label}</Text>
							</View>
						))}
					</View>
				)}
			</AppHeader>

			{/* Tabs */}
			<View style={styles.tabs}>
				<TouchableOpacity
					style={[styles.tab, activeTab === 'watchlists' && styles.tabActive]}
					onPress={() => setActiveTab('watchlists')}
				>
					<Text style={[styles.tabText, activeTab === 'watchlists' && styles.tabTextActive]}>
						Watchlists ({watchlists.length})
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.tab, activeTab === 'alerts' && styles.tabActive]}
					onPress={() => setActiveTab('alerts')}
				>
					<View style={styles.tabBadgeRow}>
						<Text style={[styles.tabText, activeTab === 'alerts' && styles.tabTextActive]}>
							Alertes
						</Text>
						{alerts.filter((a: any) => !a.isRead).length > 0 && (
							<Badge style={styles.tabBadge}>
								{alerts.filter((a: any) => !a.isRead).length}
							</Badge>
						)}
					</View>
				</TouchableOpacity>
			</View>

			{activeTab === 'watchlists' ? (
				<FlatList
					data={watchlists}
					keyExtractor={item => item.id}
					renderItem={renderWatchlist}
					contentContainerStyle={styles.listContent}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
					ListEmptyComponent={
						!loading ? (
							<View style={styles.emptyState}>
								<MaterialIcons name="notifications-off" size={48} color={colors.textTertiary} />
								<Text style={styles.emptyText}>Aucune watchlist créée</Text>
								<Text style={styles.emptySubtext}>
									Surveillez des personnes ou entreprises en continu
								</Text>
							</View>
						) : null
					}
				/>
			) : (
				<FlatList
					data={alerts}
					keyExtractor={item => item.id}
					renderItem={renderAlert}
					contentContainerStyle={styles.listContent}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
					ListHeaderComponent={
						alerts.some((a: any) => !a.isRead) ? (
							<TouchableOpacity style={styles.markAllRead} onPress={markAllRead}>
								<MaterialIcons name="done-all" size={16} color={colors.primary} />
								<Text style={styles.markAllReadText}>Tout marquer comme lu</Text>
							</TouchableOpacity>
						) : null
					}
					ListEmptyComponent={
						<View style={styles.emptyState}>
							<MaterialIcons name="notifications-none" size={48} color={colors.textTertiary} />
							<Text style={styles.emptyText}>Aucune alerte</Text>
						</View>
					}
				/>
			)}

			<FAB
				style={styles.fab}
				icon="plus"
				label="Nouvelle watchlist"
				onPress={() => (navigation as any).navigate('CreateWatchlist')}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.background },
	statsBar: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
	statItem: { alignItems: 'center' },
	statValue: { fontSize: 18, fontWeight: '700', color: '#fff' },
	statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
	tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
	tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
	tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
	tabText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
	tabTextActive: { color: colors.primary, fontWeight: '700' },
	tabBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	tabBadge: { backgroundColor: '#DC2626', fontSize: 10 },
	listContent: { padding: 16, paddingBottom: 100 },
	card: { marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
	cardContent: { padding: 14 },
	cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
	cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
	cardDescription: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
	unreadBadge: { fontSize: 10 },
	cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
	chip: { backgroundColor: colors.accentLight, height: 26 },
	chipText: { fontSize: 11 },
	lastChecked: { fontSize: 11, color: colors.textTertiary, alignSelf: 'center' },
	entitiesPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
	entityTag: {
		flexDirection: 'row', alignItems: 'center', gap: 4,
		backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4,
		borderRadius: 6, maxWidth: 140,
	},
	entityTagText: { fontSize: 11, color: colors.textSecondary },
	moreEntities: { fontSize: 11, color: colors.textTertiary, alignSelf: 'center' },
	cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
	action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
	actionCheck: { borderColor: colors.primary, backgroundColor: colors.accentLight },
	actionDelete: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
	actionText: { fontSize: 12, fontWeight: '600', color: colors.primary },
	alertCard: { marginBottom: 8, borderRadius: 12, backgroundColor: colors.surface, padding: 12 },
	alertRow: { flexDirection: 'row', gap: 10 },
	severityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
	alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
	alertTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
	alertTime: { fontSize: 11, color: colors.textTertiary, marginLeft: 8 },
	alertEntity: { fontSize: 12, color: colors.primary, fontWeight: '500', marginTop: 2 },
	alertDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
	alertMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
	severityChip: { height: 22 },
	watchlistName: { fontSize: 11, color: colors.textTertiary },
	emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
	emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
	emptySubtext: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
	markAllRead: {
		flexDirection: 'row', alignItems: 'center', gap: 6,
		padding: 10, marginBottom: 8, backgroundColor: colors.accentLight,
		borderRadius: 8, justifyContent: 'center',
	},
	markAllReadText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
	fab: {
		position: 'absolute', bottom: 20, right: 20,
		backgroundColor: colors.primary,
	},
});
