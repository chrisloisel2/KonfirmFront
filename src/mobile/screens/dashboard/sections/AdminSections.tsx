import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '../../../../shared/theme/theme';
import { useAuth } from '../../../../shared/services/AuthContext';
import { API_BASE } from '../../../../shared/config/api';
import { MonitoringSummary, SubscriptionItem, PaymentItem, ActivationKeyItem, ShopItem, UserItem } from '../types';
import { euros, humanDate, personName, CHART_W, HALF_CHART } from '../helpers';
import { DonutChart, GaugeMRR, SectionRow, StatusBadge, ActionBtn, EmptyState, InfoRow } from '../components';
import { st } from '../styles';

// ── AdminChartsSection ─────────────────────────────────────────────────────────

interface AdminChartsSectionProps {
  monitoring: MonitoringSummary;
  subscriptions: SubscriptionItem[];
}

export function AdminChartsSection({ monitoring, subscriptions }: AdminChartsSectionProps) {
  const donutData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    subscriptions.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
    return [
      { value: counts['ACTIVE']    || 0, name: 'Actifs',    color: '#1A6B50' },
      { value: counts['PAST_DUE']  || 0, name: 'Échus',     color: colors.gold },
      { value: counts['SUSPENDED'] || 0, name: 'Suspendus', color: '#8B1C1C' },
      { value: counts['CANCELLED'] || 0, name: 'Résiliés',  color: colors.slate3 },
    ].filter(d => d.value > 0);
  }, [subscriptions]);

  const totalSubs = donutData.reduce((a, d) => a + d.value, 0);

  return (
    <View style={st.section}>
      <SectionRow title="Tableau de bord financier" />
      <View style={st.chartsRow}>
        <View style={st.chartCard}>
          <Text style={st.chartTitle}>MRR</Text>
          <GaugeMRR mrr={monitoring.monthlyRecurringRevenueCents} width={HALF_CHART} height={140} />
        </View>
        <View style={st.chartCard}>
          <Text style={st.chartTitle}>Abonnements</Text>
          {totalSubs > 0 ? (
            <>
              <DonutChart data={donutData} width={HALF_CHART} height={140} centerLabel={`${totalSubs}\ntotal`} />
              <View style={st.legendWrap}>
                {donutData.map(d => (
                  <View key={d.name} style={st.legendItem}>
                    <View style={[st.legendDot, { backgroundColor: d.color }]} />
                    <Text style={st.legendText}>{d.name}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialIcons name="donut-large" size={40} color={colors.borderLight} />
              <Text style={st.chartEmptyText}>Aucune donnée</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── SubscriptionFormModal ──────────────────────────────────────────────────────

const PLANS = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'];
const SUB_STATUSES = ['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'];
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22C55E', PAST_DUE: '#F59E0B', SUSPENDED: '#6B7280', CANCELLED: '#EF4444',
};

interface SubForm {
  companyName: string; plan: string; billingCycle: string;
  priceEuros: string; seats: string; maxAccounts: string; maxShops: string;
  features: string; periodEnd: string; status: string;
}

function SubscriptionFormModal({
  visible, editing, onClose, onSaved,
}: {
  visible: boolean;
  editing: SubscriptionItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const isEdit = !!editing;
  const [form, setForm] = useState<SubForm>({
    companyName: '', plan: 'PRO', billingCycle: 'MONTHLY',
    priceEuros: '99', seats: '5', maxAccounts: '10', maxShops: '2',
    features: '', periodEnd: '', status: 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setForm({
        companyName: editing.companyName,
        plan: editing.plan,
        billingCycle: editing.billingCycle,
        priceEuros: String((editing.priceCents || 0) / 100),
        seats: String(editing.seats ?? 1),
        maxAccounts: String(editing.maxAccounts ?? 5),
        maxShops: String(editing.maxShops ?? 1),
        features: (editing.features ?? []).join(', '),
        periodEnd: editing.currentPeriodEnd
          ? new Date(editing.currentPeriodEnd).toISOString().split('T')[0]
          : '',
        status: editing.status,
      });
    } else {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setForm({
        companyName: '', plan: 'PRO', billingCycle: 'MONTHLY',
        priceEuros: '99', seats: '5', maxAccounts: '10', maxShops: '2',
        features: '', periodEnd: nextYear.toISOString().split('T')[0], status: 'ACTIVE',
      });
    }
  }, [visible, editing]);

  const set = (k: keyof SubForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.companyName.trim()) { Alert.alert('Erreur', 'Le nom de la société est requis'); return; }
    setSaving(true);
    try {
      const body = {
        companyName: form.companyName.trim(),
        plan: form.plan,
        billingCycle: form.billingCycle,
        priceCents: Math.round(parseFloat(form.priceEuros || '0') * 100),
        seats: parseInt(form.seats) || 1,
        maxAccounts: parseInt(form.maxAccounts) || -1,
        maxShops: parseInt(form.maxShops) || -1,
        features: form.features ? form.features.split(',').map(f => f.trim()).filter(Boolean) : [],
        currentPeriodEnd: form.periodEnd || undefined,
        ...(isEdit ? { status: form.status } : {}),
      };
      const url = isEdit
        ? `${API_BASE}/dashboard/subscriptions/${editing!.id}`
        : `${API_BASE}/dashboard/subscriptions`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (json?.success) { onClose(); onSaved(); }
      else Alert.alert('Erreur', json?.error?.message || 'Opération impossible');
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={ms.handle} />
          <Text style={ms.sheetTitle}>{isEdit ? 'Modifier l\'abonnement' : 'Nouvel abonnement'}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Text style={ms.label}>Nom de la société *</Text>
            <TextInput
              style={ms.input}
              value={form.companyName}
              onChangeText={v => set('companyName', v)}
              placeholder="Ex : Entreprise DUPONT"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={ms.label}>Plan</Text>
            <View style={ms.chipRow}>
              {PLANS.map(p => (
                <TouchableOpacity key={p} style={[ms.chip, form.plan === p && ms.chipOn]} onPress={() => set('plan', p)}>
                  <Text style={[ms.chipTxt, form.plan === p && ms.chipTxtOn]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={ms.label}>Facturation</Text>
            <View style={ms.toggle}>
              {(['MONTHLY', 'YEARLY'] as const).map(b => (
                <TouchableOpacity key={b} style={[ms.toggleOpt, form.billingCycle === b && ms.toggleOptOn]} onPress={() => set('billingCycle', b)}>
                  <Text style={[ms.toggleTxt, form.billingCycle === b && ms.toggleTxtOn]}>{b === 'MONTHLY' ? 'Mensuel' : 'Annuel'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={ms.label}>Prix (€ TTC)</Text>
            <TextInput style={ms.input} value={form.priceEuros} onChangeText={v => set('priceEuros', v)} keyboardType="decimal-pad" placeholder="99.00" placeholderTextColor={colors.textTertiary} />

            <View style={ms.row3}>
              <View style={ms.col}>
                <Text style={ms.label}>Sièges</Text>
                <TextInput style={ms.input} value={form.seats} onChangeText={v => set('seats', v)} keyboardType="number-pad" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={ms.col}>
                <Text style={ms.label}>Comptes max</Text>
                <TextInput style={ms.input} value={form.maxAccounts} onChangeText={v => set('maxAccounts', v)} keyboardType="number-pad" placeholder="-1=∞" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={ms.col}>
                <Text style={ms.label}>Boutiques max</Text>
                <TextInput style={ms.input} value={form.maxShops} onChangeText={v => set('maxShops', v)} keyboardType="number-pad" placeholder="-1=∞" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>

            <Text style={ms.label}>Fin de période (AAAA-MM-JJ)</Text>
            <TextInput style={ms.input} value={form.periodEnd} onChangeText={v => set('periodEnd', v)} placeholder="2026-12-31" placeholderTextColor={colors.textTertiary} />

            <Text style={ms.label}>Fonctionnalités (séparées par virgule)</Text>
            <TextInput style={ms.input} value={form.features} onChangeText={v => set('features', v)} placeholder="SEARCH, BATCH, REPORTS" placeholderTextColor={colors.textTertiary} />

            {isEdit && (
              <>
                <Text style={ms.label}>Statut</Text>
                <View style={ms.chipRow}>
                  {SUB_STATUSES.map(s => {
                    const c = STATUS_COLORS[s] || colors.textSecondary;
                    const on = form.status === s;
                    return (
                      <TouchableOpacity key={s} style={[ms.chip, on && { borderColor: c, backgroundColor: c + '18' }]} onPress={() => set('status', s)}>
                        <Text style={[ms.chipTxt, on && { color: c, fontWeight: '700' }]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={ms.footer}>
            <TouchableOpacity style={ms.btnCancel} onPress={onClose}>
              <Text style={ms.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ms.btnSave, saving && { opacity: 0.55 }]} onPress={save} disabled={saving}>
              <Text style={ms.btnSaveTxt}>{saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── ShopsManagerModal ──────────────────────────────────────────────────────────

interface ShopForm { name: string; code: string; address: string; city: string; isActive: boolean; }

function ShopsManagerModal({
  visible, subscription, onClose,
}: {
  visible: boolean;
  subscription: SubscriptionItem | null;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<ShopItem | null>(null);
  const [form, setForm] = useState<ShopForm>({ name: '', code: '', address: '', city: '', isActive: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard/subscriptions/${subscription.id}/shops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (json?.success) setShops(json.data.shops);
    } finally { setLoading(false); }
  }, [subscription, token]);

  useEffect(() => {
    if (visible && subscription) { load(); }
    if (!visible) { setShops([]); setFormOpen(false); setEditingShop(null); }
  }, [visible, subscription]);

  function openCreate() {
    setEditingShop(null);
    setForm({ name: '', code: '', address: '', city: '', isActive: true });
    setFormOpen(true);
  }

  function openEdit(shop: ShopItem) {
    setEditingShop(shop);
    setForm({ name: shop.name, code: shop.code || '', address: shop.address || '', city: shop.city || '', isActive: shop.isActive });
    setFormOpen(true);
  }

  async function saveShop() {
    if (!form.name.trim()) { Alert.alert('Erreur', 'Le nom est requis'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        ...(editingShop ? { isActive: form.isActive } : {}),
      };
      const url = editingShop
        ? `${API_BASE}/dashboard/shops/${editingShop.id}`
        : `${API_BASE}/dashboard/subscriptions/${subscription!.id}/shops`;
      const res = await fetch(url, {
        method: editingShop ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (json?.success) { setFormOpen(false); load(); }
      else Alert.alert('Erreur', json?.error?.message || 'Opération impossible');
    } finally { setSaving(false); }
  }

  async function confirmDelete(shop: ShopItem) {
    if (!window.confirm(`Supprimer "${shop.name}" ?`)) return;
    try {
      const res = await fetch(`${API_BASE}/dashboard/shops/${shop.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (json?.success) {
        load();
      } else {
        window.alert(json?.error?.message || 'Impossible de supprimer la boutique');
      }
    } catch {
      window.alert('Impossible de supprimer la boutique');
    }
  }

  const sf = (k: keyof ShopForm, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={ms.handle} />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={ms.sheetTitle} numberOfLines={1}>{subscription?.companyName}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Gestion des boutiques</Text>
            </View>
            {!formOpen && (
              <TouchableOpacity style={ms.addBtn} onPress={openCreate}>
                <MaterialIcons name="add-business" size={16} color={colors.navy} />
                <Text style={ms.addBtnTxt}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>

          {formOpen ? (
            <View>
              <Text style={ms.label}>Nom *</Text>
              <TextInput style={ms.input} value={form.name} onChangeText={v => sf('name', v)} placeholder="Boutique Principale" placeholderTextColor={colors.textTertiary} />
              <Text style={ms.label}>Code</Text>
              <TextInput style={ms.input} value={form.code} onChangeText={v => sf('code', v)} placeholder="BT-001" placeholderTextColor={colors.textTertiary} />
              <View style={ms.row3}>
                <View style={[ms.col, { flex: 2 }]}>
                  <Text style={ms.label}>Adresse</Text>
                  <TextInput style={ms.input} value={form.address} onChangeText={v => sf('address', v)} placeholder="12 rue de la Paix" placeholderTextColor={colors.textTertiary} />
                </View>
                <View style={ms.col}>
                  <Text style={ms.label}>Ville</Text>
                  <TextInput style={ms.input} value={form.city} onChangeText={v => sf('city', v)} placeholder="Paris" placeholderTextColor={colors.textTertiary} />
                </View>
              </View>
              {editingShop && (
                <TouchableOpacity
                  style={[ms.chip, form.isActive && { borderColor: '#22C55E', backgroundColor: '#22C55E18' }]}
                  onPress={() => sf('isActive', !form.isActive)}
                >
                  <Text style={[ms.chipTxt, form.isActive && { color: '#22C55E', fontWeight: '700' }]}>
                    {form.isActive ? '✓ Active' : '○ Inactive'}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={[ms.footer, { marginTop: 16 }]}>
                <TouchableOpacity style={ms.btnCancel} onPress={() => setFormOpen(false)}>
                  <Text style={ms.btnCancelTxt}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.btnSave, saving && { opacity: 0.55 }]} onPress={saveShop} disabled={saving}>
                  <Text style={ms.btnSaveTxt}>{saving ? '…' : editingShop ? 'Modifier' : 'Créer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {loading && <Text style={{ color: colors.textTertiary, textAlign: 'center', padding: 20 }}>Chargement…</Text>}
                {!loading && shops.length === 0 && (
                  <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                    <MaterialIcons name="store" size={34} color={colors.borderLight} />
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Aucune boutique pour cet abonnement</Text>
                  </View>
                )}
                {shops.map(shop => (
                  <View key={shop.id} style={ms.shopRow}>
                    <View style={[ms.shopIcon, { backgroundColor: shop.isActive ? '#22C55E18' : colors.borderLight }]}>
                      <MaterialIcons name="storefront" size={15} color={shop.isActive ? '#22C55E' : colors.textTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.shopName}>{shop.name}</Text>
                      <Text style={ms.shopMeta} numberOfLines={1}>
                        {[shop.code && `#${shop.code}`, shop.city].filter(Boolean).join(' · ') || 'Sans détails'}
                      </Text>
                      {(shop.users?.length ?? 0) > 0 && (
                        <Text style={ms.shopUsers}>{shop.users!.length} utilisateur{shop.users!.length > 1 ? 's' : ''}</Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity style={ms.iconBtn} onPress={() => openEdit(shop)}>
                        <MaterialIcons name="edit" size={15} color={colors.navy3} />
                      </TouchableOpacity>
                      <TouchableOpacity style={ms.iconBtn} onPress={() => confirmDelete(shop)}>
                        <MaterialIcons name="delete-outline" size={15} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={{ height: 12 }} />
              </ScrollView>
              <TouchableOpacity style={[ms.btnCancel, { marginTop: 8 }]} onPress={onClose}>
                <Text style={ms.btnCancelTxt}>Fermer</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── UsersManagerModal ──────────────────────────────────────────────────────────

const ROLES = ['CAISSE', 'REFERENT', 'RESPONSABLE', 'ADMIN'] as const;
const ROLE_COLORS: Record<string, string> = {
  CAISSE: '#1A6B50', REFERENT: '#B45309', RESPONSABLE: '#1D3260', ADMIN: '#7C3AED',
};

interface UserForm {
  email: string; password: string;
  firstName: string; lastName: string;
  role: string; isActive: boolean;
}

function UsersManagerModal({
  visible, subscription, onClose,
}: {
  visible: boolean;
  subscription: SubscriptionItem | null;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserForm>({
    email: '', password: '', firstName: '', lastName: '', role: 'CAISSE', isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard/subscriptions/${subscription.id}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (json?.success) setUsers(json.data.users);
    } finally { setLoading(false); }
  }, [subscription, token]);

  useEffect(() => {
    if (visible && subscription) { load(); }
    if (!visible) { setUsers([]); setFormOpen(false); setEditingUser(null); }
  }, [visible, subscription]);

  function openCreate() {
    setEditingUser(null);
    setForm({ email: '', password: '', firstName: '', lastName: '', role: 'CAISSE', isActive: true });
    setFormOpen(true);
  }

  function openEdit(user: UserItem) {
    setEditingUser(user);
    setForm({ email: user.email, password: '', firstName: user.firstName, lastName: user.lastName, role: user.role, isActive: user.isActive });
    setFormOpen(true);
  }

  async function saveUser() {
    if (!editingUser && (!form.email.trim() || !form.password || !form.firstName.trim() || !form.lastName.trim())) {
      window.alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSaving(true);
    try {
      const url = editingUser
        ? `${API_BASE}/dashboard/users/${editingUser.id}`
        : `${API_BASE}/dashboard/subscriptions/${subscription!.id}/users`;
      const body = editingUser
        ? { role: form.role, isActive: form.isActive, ...(form.password ? { password: form.password } : {}) }
        : { email: form.email.trim(), password: form.password, firstName: form.firstName.trim(), lastName: form.lastName.trim(), role: form.role };
      const res = await fetch(url, {
        method: editingUser ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (json?.success) { setFormOpen(false); load(); }
      else window.alert(json?.error?.message || 'Opération impossible');
    } finally { setSaving(false); }
  }

  async function deleteUser(user: UserItem) {
    if (!window.confirm(`Supprimer le compte de ${user.firstName} ${user.lastName} ?`)) return;
    try {
      const res = await fetch(`${API_BASE}/dashboard/users/${user.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (json?.success) { load(); }
      else window.alert(json?.error?.message || 'Impossible de supprimer cet utilisateur');
    } catch {
      window.alert('Impossible de supprimer cet utilisateur');
    }
  }

  const sf = (k: keyof UserForm, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={ms.handle} />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={ms.sheetTitle} numberOfLines={1}>{subscription?.companyName}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Gestion des utilisateurs</Text>
            </View>
            {!formOpen && (
              <TouchableOpacity style={ms.addBtn} onPress={openCreate}>
                <MaterialIcons name="person-add" size={16} color={colors.navy} />
                <Text style={ms.addBtnTxt}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>

          {formOpen ? (
            <View>
              {!editingUser && (
                <>
                  <Text style={ms.label}>Email *</Text>
                  <TextInput
                    style={ms.input} value={form.email} onChangeText={v => sf('email', v)}
                    placeholder="prenom.nom@societe.fr" placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address" autoCapitalize="none"
                  />
                  <View style={ms.row3}>
                    <View style={[ms.col, { flex: 2 }]}>
                      <Text style={ms.label}>Prénom *</Text>
                      <TextInput style={ms.input} value={form.firstName} onChangeText={v => sf('firstName', v)} placeholder="Prénom" placeholderTextColor={colors.textTertiary} />
                    </View>
                    <View style={ms.col}>
                      <Text style={ms.label}>Nom *</Text>
                      <TextInput style={ms.input} value={form.lastName} onChangeText={v => sf('lastName', v)} placeholder="Nom" placeholderTextColor={colors.textTertiary} />
                    </View>
                  </View>
                </>
              )}

              <Text style={ms.label}>{editingUser ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'}</Text>
              <TextInput
                style={ms.input} value={form.password} onChangeText={v => sf('password', v)}
                placeholder="8 caractères minimum" placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />

              <Text style={ms.label}>Rôle</Text>
              <View style={ms.chipRow}>
                {ROLES.map(r => {
                  const c = ROLE_COLORS[r];
                  const on = form.role === r;
                  return (
                    <TouchableOpacity key={r} style={[ms.chip, on && { borderColor: c, backgroundColor: c + '18' }]} onPress={() => sf('role', r)}>
                      <Text style={[ms.chipTxt, on && { color: c, fontWeight: '700' }]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {editingUser && (
                <TouchableOpacity
                  style={[ms.chip, { marginTop: 8 }, form.isActive && { borderColor: '#22C55E', backgroundColor: '#22C55E18' }]}
                  onPress={() => sf('isActive', !form.isActive)}
                >
                  <Text style={[ms.chipTxt, form.isActive && { color: '#22C55E', fontWeight: '700' }]}>
                    {form.isActive ? '✓ Compte actif' : '○ Compte désactivé'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={[ms.footer, { marginTop: 16 }]}>
                <TouchableOpacity style={ms.btnCancel} onPress={() => setFormOpen(false)}>
                  <Text style={ms.btnCancelTxt}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.btnSave, saving && { opacity: 0.55 }]} onPress={saveUser} disabled={saving}>
                  <Text style={ms.btnSaveTxt}>{saving ? '…' : editingUser ? 'Enregistrer' : 'Créer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {loading && <Text style={{ color: colors.textTertiary, textAlign: 'center', padding: 20 }}>Chargement…</Text>}
                {!loading && users.length === 0 && (
                  <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                    <MaterialIcons name="group" size={34} color={colors.borderLight} />
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Aucun utilisateur pour cet abonnement</Text>
                  </View>
                )}
                {users.map(user => (
                  <View key={user.id} style={ms.shopRow}>
                    <View style={[ms.shopIcon, { backgroundColor: (ROLE_COLORS[user.role] || colors.navy) + '18' }]}>
                      <MaterialIcons name="person" size={15} color={ROLE_COLORS[user.role] || colors.navy} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.shopName}>{user.firstName} {user.lastName}</Text>
                      <Text style={ms.shopMeta} numberOfLines={1}>{user.email}</Text>
                      <Text style={[ms.shopUsers, { color: ROLE_COLORS[user.role] || colors.textTertiary }]}>
                        {user.role} · {user.isActive ? 'Actif' : 'Inactif'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity style={ms.iconBtn} onPress={() => openEdit(user)}>
                        <MaterialIcons name="edit" size={15} color={colors.navy3} />
                      </TouchableOpacity>
                      <TouchableOpacity style={ms.iconBtn} onPress={() => deleteUser(user)}>
                        <MaterialIcons name="delete-outline" size={15} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={{ height: 12 }} />
              </ScrollView>
              <TouchableOpacity style={[ms.btnCancel, { marginTop: 8 }]} onPress={onClose}>
                <Text style={ms.btnCancelTxt}>Fermer</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── AdminSubscriptionsSection ──────────────────────────────────────────────────

interface AdminSubscriptionsSectionProps {
  subscriptions: SubscriptionItem[];
  busySubId: string | null;
  onUpdateSubscription: (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') => void;
  onRefresh: () => void;
}

export function AdminSubscriptionsSection({
  subscriptions, busySubId, onUpdateSubscription, onRefresh,
}: AdminSubscriptionsSectionProps) {
  const { token } = useAuth();
  const [subFormVisible, setSubFormVisible] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionItem | null>(null);
  const [shopsVisible, setShopsVisible] = useState(false);
  const [shopsSub, setShopsSub] = useState<SubscriptionItem | null>(null);
  const [usersVisible, setUsersVisible] = useState(false);
  const [usersSub, setUsersSub] = useState<SubscriptionItem | null>(null);

  function openCreate() { setEditingSub(null); setSubFormVisible(true); }
  function openEdit(sub: SubscriptionItem) { setEditingSub(sub); setSubFormVisible(true); }
  function openShops(sub: SubscriptionItem) { setShopsSub(sub); setShopsVisible(true); }
  function openUsers(sub: SubscriptionItem) { setUsersSub(sub); setUsersVisible(true); }

  async function confirmDelete(sub: SubscriptionItem) {
    if (!window.confirm(`Supprimer l'abonnement de "${sub.companyName}" ? Cette action est irréversible.`)) return;
    try {
      await fetch(`${API_BASE}/dashboard/subscriptions/${sub.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      onRefresh();
    } catch {
      window.alert('Impossible de supprimer cet abonnement');
    }
  }

  return (
    <View style={st.section}>
      <SectionRow
        title="Abonnements"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={st.countPill}>
              <Text style={st.countPillText}>{subscriptions.length}</Text>
            </View>
            <TouchableOpacity style={ms.createBtn} onPress={openCreate}>
              <MaterialIcons name="add" size={13} color={colors.navy} />
              <Text style={ms.createBtnTxt}>Créer</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {subscriptions.length === 0 ? (
        <EmptyState text="Aucun abonnement enregistré." />
      ) : (
        subscriptions.map(sub => (
          <View key={sub.id} style={st.card}>
            <View style={st.cardHead}>
              <View style={[st.cardIconWrap, { backgroundColor: colors.navy + '12' }]}>
                <MaterialIcons name="workspace-premium" size={18} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle}>{sub.companyName}</Text>
                <Text style={st.cardSub}>{sub.plan} · {sub.billingCycle} · {sub.seats} sièges</Text>
              </View>
              <StatusBadge status={sub.status} />
            </View>

            <View style={st.infoTable}>
              <InfoRow k="Montant"      v={euros(sub.priceCents, sub.currency)} />
              <InfoRow k="Comptes max"  v={sub.maxAccounts === -1 ? '∞' : String(sub.maxAccounts ?? '—')} />
              <InfoRow k="Boutiques max" v={sub.maxShops === -1 ? '∞' : String(sub.maxShops ?? '—')} />
              <InfoRow k="Responsable"  v={personName(sub.owner)} />
              <InfoRow k="Échéance"     v={humanDate(sub.currentPeriodEnd)} last />
            </View>

            <View style={st.actionRow}>
              <ActionBtn label="Activer" icon="check-circle" color={colors.success}
                disabled={busySubId === sub.id || sub.status === 'ACTIVE'}
                onPress={() => onUpdateSubscription(sub.id, 'ACTIVE')} />
              <ActionBtn label="Suspendre" icon="pause-circle" color={colors.warning}
                disabled={busySubId === sub.id || sub.status === 'SUSPENDED'}
                onPress={() => onUpdateSubscription(sub.id, 'SUSPENDED')} />
              <ActionBtn label="Résilier" icon="cancel" color={colors.danger}
                disabled={busySubId === sub.id || sub.status === 'CANCELLED'}
                onPress={() => onUpdateSubscription(sub.id, 'CANCELLED')} />
            </View>
            <View style={[st.actionRow, { marginTop: 4 }]}>
              <ActionBtn label="Modifier" icon="edit" color={colors.navy3}
                onPress={() => openEdit(sub)} />
              <ActionBtn label="Boutiques" icon="storefront" color="#7C3AED"
                onPress={() => openShops(sub)} />
              <ActionBtn label="Utilisateurs" icon="group" color="#0891B2"
                onPress={() => openUsers(sub)} />
            </View>
            <View style={[st.actionRow, { marginTop: 4 }]}>
              <ActionBtn label="Supprimer" icon="delete-outline" color={colors.danger}
                onPress={() => confirmDelete(sub)} />
            </View>
          </View>
        ))
      )}

      <SubscriptionFormModal
        visible={subFormVisible}
        editing={editingSub}
        onClose={() => setSubFormVisible(false)}
        onSaved={onRefresh}
      />
      <ShopsManagerModal
        visible={shopsVisible}
        subscription={shopsSub}
        onClose={() => setShopsVisible(false)}
      />
      <UsersManagerModal
        visible={usersVisible}
        subscription={usersSub}
        onClose={() => setUsersVisible(false)}
      />
    </View>
  );
}

// ── AdminPaymentsSection ───────────────────────────────────────────────────────

interface AdminPaymentsSectionProps {
  payments: PaymentItem[];
  paymentsPendingReview: number;
  busyPaymentId: string | null;
  onUpdatePayment: (id: string, status: 'VERIFIED' | 'FAILED') => void;
}

export function AdminPaymentsSection({
  payments, paymentsPendingReview, busyPaymentId, onUpdatePayment,
}: AdminPaymentsSectionProps) {
  return (
    <View style={st.section}>
      <SectionRow
        title="Paiements récents"
        right={
          paymentsPendingReview > 0 ? (
            <View style={[st.countPill, { backgroundColor: colors.warning + '20' }]}>
              <Text style={[st.countPillText, { color: colors.warning }]}>
                {paymentsPendingReview} en attente
              </Text>
            </View>
          ) : undefined
        }
      />
      {payments.length === 0 ? (
        <EmptyState text="Aucun paiement enregistré." icon="receipt" />
      ) : (
        payments.map(p => (
          <View key={p.id} style={st.card}>
            <View style={st.cardHead}>
              <View style={[st.cardIconWrap, { backgroundColor: '#2563EB12' }]}>
                <MaterialIcons name="payments" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle}>{p.subscription?.companyName || p.reference}</Text>
                <Text style={st.cardSub}>{p.reference} · {p.method}</Text>
              </View>
              <StatusBadge status={p.status} />
            </View>
            <View style={st.infoTable}>
              <InfoRow k="Montant" v={euros(p.amountCents, p.currency)} />
              <InfoRow k="Client"  v={personName(p.user)} />
              <InfoRow k="Date"    v={humanDate(p.paidAt)} last />
            </View>
            {p.description ? <Text style={st.noteText}>{p.description}</Text> : null}
            <View style={st.actionRow}>
              <ActionBtn label="Vérifier" icon="verified" color={colors.success}
                disabled={busyPaymentId === p.id || p.status === 'VERIFIED'}
                onPress={() => onUpdatePayment(p.id, 'VERIFIED')} />
              <ActionBtn label="Signaler" icon="error" color={colors.danger}
                disabled={busyPaymentId === p.id || p.status === 'FAILED'}
                onPress={() => onUpdatePayment(p.id, 'FAILED')} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ── AdminActivationKeysSection ─────────────────────────────────────────────────

interface AdminActivationKeysSectionProps {
  activationKeys: ActivationKeyItem[];
}

export function AdminActivationKeysSection({ activationKeys }: AdminActivationKeysSectionProps) {
  const redeemed = activationKeys.filter(k => k.isRedeemed).length;
  const available = activationKeys.length - redeemed;

  return (
    <View style={st.section}>
      <SectionRow title="Clés d'activation" />
      {activationKeys.length === 0 ? (
        <EmptyState text="Aucune clé d'activation." icon="vpn-key" />
      ) : (
        <>
          <View style={[st.card, { alignItems: 'center', paddingVertical: spacing.md }]}>
            <DonutChart
              data={[
                { value: redeemed,  name: 'Utilisées',   color: colors.success },
                { value: available, name: 'Disponibles', color: colors.gold },
              ].filter(d => d.value > 0)}
              width={CHART_W - spacing.md * 2}
              height={130}
              centerLabel={`${redeemed}/${activationKeys.length}`}
            />
            <View style={st.keyStatsRow}>
              <View style={st.keyStat}>
                <View style={[st.legendDot, { backgroundColor: colors.success }]} />
                <Text style={st.keyStatText}>{redeemed} utilisée{redeemed > 1 ? 's' : ''}</Text>
              </View>
              <View style={st.keyStat}>
                <View style={[st.legendDot, { backgroundColor: colors.gold }]} />
                <Text style={st.keyStatText}>{available} disponible{available > 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>

          {activationKeys.map(k => (
            <View key={k.id} style={st.keyCard}>
              <View style={st.keyCardTop}>
                <View style={st.keyCardLeft}>
                  <View style={[st.keyPlanBadge, { backgroundColor: k.isRedeemed ? colors.successLight : colors.accentLight }]}>
                    <Text style={[st.keyPlanText, { color: k.isRedeemed ? colors.success : colors.gold }]}>{k.plan}</Text>
                  </View>
                  <Text style={st.keyCode}>{k.code}</Text>
                </View>
                <StatusBadge status={k.status} compact />
              </View>
              <Text style={st.keyMeta}>{k.label || `${k.billingCycle} · ${euros(k.priceCents, k.currency)}`}</Text>
              <Text style={st.keyOwner}>
                {k.isRedeemed
                  ? `✓ Utilisée par ${personName(k.redeemedByUser)}`
                  : '⬡ Disponible à l\'activation'}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ── Modal styles ───────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { borderColor: colors.navy, backgroundColor: colors.navy + '12' },
  chipTxt: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTxtOn: { color: colors.navy, fontWeight: '700' },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  toggleOpt: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceAlt },
  toggleOptOn: { backgroundColor: colors.navy },
  toggleTxt: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  toggleTxtOn: { color: '#fff' },
  row3: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderLight,
    alignItems: 'center',
  },
  btnCancelTxt: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  btnSave: {
    flex: 2, paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.navy, alignItems: 'center',
  },
  btnSaveTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.navy + '40',
    backgroundColor: colors.navy + '0A',
  },
  createBtnTxt: { fontSize: 11, fontWeight: '700', color: colors.navy },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.navy + '0E',
    borderWidth: 1, borderColor: colors.navy + '30',
  },
  addBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.navy },
  shopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  shopIcon: {
    width: 32, height: 32, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  shopName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  shopMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  shopUsers: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  iconBtn: {
    width: 30, height: 30, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.borderLight,
  },
});
