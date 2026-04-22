import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Reanimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SvgChart, SVGRenderer } from '@wuba/react-native-echarts';
import * as echarts from 'echarts/core';
import { PieChart as EPieChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { useAuth } from '../../shared/services/AuthContext';
import { colors, fonts, radius, shadows, spacing } from '../../shared/theme/theme';
import type { AccountUser, Company, CompanyUsage, Shop, Subscription } from '../../shared/types';
import { API_BASE } from '../../shared/config/api';

echarts.use([SVGRenderer, EPieChart, TooltipComponent, LegendComponent]);

type Tab = 'team' | 'boutiques' | 'plan';

const ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  CONSEILLER:  { label: 'Conseiller',  color: '#2563EB', icon: 'person' },
  CAISSE:      { label: 'Caisse',      color: '#1A6B50', icon: 'point-of-sale' },
  REFERENT:    { label: 'Référent',    color: '#B45309', icon: 'supervisor-account' },
  RESPONSABLE: { label: 'Responsable', color: '#1D3260', icon: 'manage-accounts' },
  ADMIN:       { label: 'Admin',       color: '#7C3AED', icon: 'admin-panel-settings' },
};

const ROLE_FEATURES: Record<string, string[]> = {
  CONSEILLER:  ['Dossiers (propres)', 'Documents', 'Recherches basiques'],
  CAISSE:      ['Dossiers (agence)', 'Documents', 'Validation transactions'],
  REFERENT:    ['Tous les dossiers', 'Scoring', 'Exceptions', 'Watchlists'],
  RESPONSABLE: ['Gestion équipe', 'Statistiques', 'Rapports', 'Investigation'],
  ADMIN:       ['Paramètres société', 'Gestion boutiques', 'Tracfin', 'API complète'],
};

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  TRIAL:     { color: '#B45309', bg: '#FEF5DC', label: 'Essai' },
  ACTIVE:    { color: '#1A6B50', bg: '#E6F4EF', label: 'Actif' },
  EXPIRED:   { color: '#8B1C1C', bg: '#FDEDED', label: 'Expiré' },
  SUSPENDED: { color: '#4A5E74', bg: '#F0EDE5', label: 'Suspendu' },
};

// ─── ECharts role donut ────────────────────────────────────────────────────────

function RoleDonut({ accounts, size = 110 }: { accounts: AccountUser[]; size?: number }) {
  const ref = useRef<any>(null);
  const roleCount = accounts.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});
  const data = Object.entries(roleCount)
    .filter(([, v]) => v > 0)
    .map(([r, v]) => ({ name: r, value: v, itemStyle: { color: ROLE_META[r]?.color ?? '#ccc' } }));

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    let chart: any;
    const t = setTimeout(() => {
      chart = echarts.init(ref.current, 'light', { renderer: 'svg', width: size, height: size });
      chart.setOption({
        series: [{
          type: 'pie',
          radius: ['58%', '82%'],
          data,
          label: { show: false },
          emphasis: { scale: false },
          startAngle: 90,
        }],
      });
    }, 80);
    return () => { clearTimeout(t); chart?.dispose(); };
  }, [accounts.length, size]);

  if (data.length === 0) return <View style={{ width: size, height: size }} />;
  return <SvgChart ref={ref} style={{ width: size, height: size }} />;
}

// ─── SVG arc usage card ────────────────────────────────────────────────────────

function UsageArcCard({ label, used, max, color }: { label: string; used: number; max: number; color: string }) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.min(used / max, 1);
  const arcColor = pct > 0.85 ? colors.danger : pct > 0.6 ? colors.warning : color;
  const size = 80;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <View style={st.usageArcCard}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={arcColor + '22'} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={arcColor} strokeWidth={stroke} fill="none"
            strokeDasharray={circ}
            strokeDashoffset={unlimited ? circ : offset}
            strokeLinecap="round"
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill as any} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[st.arcCenterNum, { color: arcColor }]}>
              {unlimited ? '∞' : `${Math.round(pct * 100)}%`}
            </Text>
          </View>
        </View>
      </View>
      <Text style={st.arcLabel}>{label}</Text>
      <Text style={st.arcCount}>{unlimited ? `${used}` : `${used}/${max}`}</Text>
    </View>
  );
}

// ─── Primitives ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] ?? { label: role, color: colors.textTertiary, icon: 'person' };
  return (
    <View style={[st.roleBadge, { backgroundColor: m.color + '18', borderColor: m.color + '40' }]}>
      <View style={[st.roleDot, { backgroundColor: m.color }]} />
      <Text style={[st.roleBadgeText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

function FieldInput({ label, value, onChangeText, keyboardType, secureTextEntry, placeholder }: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'email-address'; secureTextEntry?: boolean; placeholder?: string;
}) {
  const border = useRef(new Animated.Value(0)).current;
  const onFocus = () => Animated.timing(border, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  const onBlur  = () => Animated.timing(border, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  return (
    <View style={st.fieldGroup}>
      <Text style={st.fieldLabel}>{label}</Text>
      <Animated.View style={[st.inputWrap, { borderColor: border.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.gold] }) }]}>
        <TextInput
          style={st.textInput} value={value} onChangeText={onChangeText}
          keyboardType={keyboardType ?? 'default'} secureTextEntry={secureTextEntry}
          placeholder={placeholder} autoCapitalize="none"
          onFocus={onFocus} onBlur={onBlur} placeholderTextColor={colors.textTertiary}
        />
      </Animated.View>
    </View>
  );
}

// ─── Account Modal ─────────────────────────────────────────────────────────────

function AccountModal({ visible, editing, shops, headers, onClose, onSaved }: {
  visible: boolean; editing: AccountUser | null; shops: Shop[];
  headers: Record<string, string>; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [email, setEmail]         = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [password, setPassword]   = useState('');
  const [role, setRole]           = useState('CONSEILLER');
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail(editing?.email ?? '');
      setFirstName(editing?.firstName ?? '');
      setLastName(editing?.lastName ?? '');
      setPassword('');
      setRole(editing?.role ?? 'CONSEILLER');
      setSelectedShopIds(editing?.shopIds ?? []);
    }
  }, [visible, editing]);

  function toggleShop(id: string) {
    setSelectedShopIds(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { role, shopIds: selectedShopIds };
      if (!isEdit) {
        if (!email || !firstName || !lastName || !password) {
          Alert.alert('Champs requis', 'Veuillez remplir tous les champs.'); return;
        }
        Object.assign(body, { email, firstName, lastName, password });
      } else if (password) { body.password = password; }
      const url = isEdit ? `${API_BASE}/settings/accounts/${editing!.id}` : `${API_BASE}/settings/accounts`;
      const res  = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { onClose(); onSaved(); }
      else Alert.alert('Erreur', json.error?.message ?? 'Erreur inconnue');
    } finally { setSaving(false); }
  }

  const rm = ROLE_META[role];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={st.overlay}>
        <View style={st.sheet}>
          <View style={st.sheetHandle} />
          <View style={[st.sheetHeader, { borderBottomColor: (rm?.color ?? colors.border) + '30' }]}>
            <View style={[st.sheetIcon, { backgroundColor: (rm?.color ?? colors.gold) + '18' }]}>
              <MaterialIcons name={(rm?.icon ?? 'person') as any} size={20} color={rm?.color ?? colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.sheetTitle}>{isEdit ? 'Modifier le compte' : 'Nouveau collaborateur'}</Text>
              <Text style={st.sheetSub}>{isEdit ? editing?.email : 'Créer un accès utilisateur'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn}>
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={st.sheetBody} showsVerticalScrollIndicator={false}>
            {!isEdit && (
              <>
                <FieldInput label="Email professionnel" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="prenom.nom@societe.fr" />
                <View style={st.nameRow}>
                  <View style={{ flex: 1 }}><FieldInput label="Prénom" value={firstName} onChangeText={setFirstName} /></View>
                  <View style={{ flex: 1 }}><FieldInput label="Nom"    value={lastName}  onChangeText={setLastName}  /></View>
                </View>
              </>
            )}
            <FieldInput
              label={isEdit ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe temporaire'}
              value={password} onChangeText={setPassword} secureTextEntry placeholder="8 caractères minimum"
            />

            <Text style={st.fieldLabel}>Rôle</Text>
            <View style={st.rolePicker}>
              {Object.entries(ROLE_META).map(([r, m]) => {
                const active = role === r;
                return (
                  <TouchableOpacity
                    key={r} activeOpacity={0.75}
                    style={[st.rolePickerItem, active && { borderColor: m.color, backgroundColor: m.color + '0C' }]}
                    onPress={() => setRole(r)}
                  >
                    <View style={[st.rolePickerIcon, { backgroundColor: active ? m.color + '20' : colors.borderLight }]}>
                      <MaterialIcons name={m.icon as any} size={16} color={active ? m.color : colors.textTertiary} />
                    </View>
                    <Text style={[st.rolePickerLabel, active && { color: m.color, fontWeight: '700' }]}>{m.label}</Text>
                    {active && <View style={[st.rolePickerDot, { backgroundColor: m.color }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {shops.length > 0 && (
              <>
                <Text style={[st.fieldLabel, { marginTop: spacing.md }]}>Boutiques accessibles</Text>
                <View style={st.shopPickerGrid}>
                  {shops.map(s => {
                    const on = selectedShopIds.includes(s.id);
                    return (
                      <TouchableOpacity
                        key={s.id} activeOpacity={0.75}
                        style={[st.shopPickerChip, on && { borderColor: colors.navy, backgroundColor: colors.navy + '0A' }]}
                        onPress={() => toggleShop(s.id)}
                      >
                        <MaterialIcons name="storefront" size={13} color={on ? colors.navy : colors.textTertiary} />
                        <Text style={[st.shopPickerText, on && { color: colors.navy, fontWeight: '600' }]}>{s.name}</Text>
                        {on && <MaterialIcons name="check-circle" size={13} color={colors.navy} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <View style={{ height: spacing.xl }} />
          </ScrollView>

          <View style={st.sheetFooter}>
            <TouchableOpacity style={st.btnOutline} onPress={onClose}>
              <Text style={st.btnOutlineText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.btnSolid, saving && { opacity: 0.55 }]} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={st.btnSolidText}>{isEdit ? 'Enregistrer' : 'Créer le compte'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Shop Modal (admin only) ───────────────────────────────────────────────────

function ShopModal({ visible, editing, headers, onClose, onSaved }: {
  visible: boolean; editing: Shop | null;
  headers: Record<string, string>; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [name, setName]       = useState('');
  const [code, setCode]       = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity]       = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '');
      setCode(editing?.code ?? '');
      setAddress(editing?.address ?? '');
      setCity(editing?.city ?? '');
      setIsActive(editing?.isActive ?? true);
    }
  }, [visible, editing]);

  async function save() {
    if (!name.trim()) { Alert.alert('Requis', 'Le nom de la boutique est requis.'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        code: code.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
      };
      if (isEdit) body.isActive = isActive;
      const url  = isEdit ? `${API_BASE}/settings/shops/${editing!.id}` : `${API_BASE}/settings/shops`;
      const res  = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { onClose(); onSaved(); }
      else Alert.alert('Erreur', json.error?.message ?? 'Erreur inconnue');
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={st.overlay}>
        <View style={st.sheet}>
          <View style={st.sheetHandle} />
          <View style={st.sheetHeader}>
            <View style={[st.sheetIcon, { backgroundColor: colors.successLight }]}>
              <MaterialIcons name="storefront" size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.sheetTitle}>{isEdit ? 'Modifier la boutique' : 'Nouvelle boutique'}</Text>
              <Text style={st.sheetSub}>{isEdit ? editing?.name : 'Ajouter un point de vente'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn}>
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={st.sheetBody} showsVerticalScrollIndicator={false}>
            <FieldInput label="Nom de la boutique" value={name} onChangeText={setName} />
            <FieldInput label="Code interne (optionnel)" value={code} onChangeText={setCode} />
            <View style={st.nameRow}>
              <View style={{ flex: 1 }}><FieldInput label="Adresse" value={address} onChangeText={setAddress} /></View>
              <View style={{ flex: 1 }}><FieldInput label="Ville"   value={city}    onChangeText={setCity}    /></View>
            </View>
            {isEdit && (
              <TouchableOpacity
                style={[st.toggleRow, isActive && st.toggleRowOn]}
                onPress={() => setIsActive(!isActive)}
              >
                <View style={[st.toggleBox, isActive && { backgroundColor: colors.success, borderColor: colors.success }]}>
                  {isActive && <MaterialIcons name="check" size={12} color="#fff" />}
                </View>
                <MaterialIcons name="storefront" size={16} color={isActive ? colors.success : colors.textTertiary} />
                <Text style={[st.toggleLabel, isActive && { color: colors.success, fontWeight: '600' }]}>Boutique active</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: spacing.xl }} />
          </ScrollView>
          <View style={st.sheetFooter}>
            <TouchableOpacity style={st.btnOutline} onPress={onClose}>
              <Text style={st.btnOutlineText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.btnSolid, saving && { opacity: 0.55 }]} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={st.btnSolidText}>{isEdit ? 'Enregistrer' : 'Créer la boutique'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Role detail modal ─────────────────────────────────────────────────────────

function RoleDetailModal({ visible, role, onClose }: { visible: boolean; role: string | null; onClose: () => void }) {
  if (!role) return null;
  const m     = ROLE_META[role];
  const feats = ROLE_FEATURES[role] ?? [];
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={st.overlay}>
        <View style={[st.sheet, { maxHeight: 480 }]}>
          <View style={st.sheetHandle} />
          <View style={[st.sheetHeader, { borderBottomColor: (m?.color ?? colors.border) + '30' }]}>
            <View style={[st.sheetIcon, { backgroundColor: (m?.color ?? colors.gold) + '18' }]}>
              <MaterialIcons name={(m?.icon ?? 'person') as any} size={20} color={m?.color ?? colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.sheetTitle}>{m?.label ?? role}</Text>
              <Text style={st.sheetSub}>{feats.length} accès inclus</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn}>
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={st.sheetBody}>
            {feats.map((f, i) => (
              <View key={f} style={[st.featureRow, i === feats.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[st.featureCheck, { backgroundColor: (m?.color ?? colors.success) + '18' }]}>
                  <MaterialIcons name="check" size={13} color={m?.color ?? colors.success} />
                </View>
                <Text style={st.featureText}>{f}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, user } = useAuth();

  const [tab, setTab]               = useState<Tab>('team');
  const [loading, setLoading]       = useState(true);
  const [company, setCompany]       = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage]           = useState<CompanyUsage>({ accounts: 0, shops: 0 });
  const [accounts, setAccounts]     = useState<AccountUser[]>([]);
  const [shops, setShops]           = useState<Shop[]>([]);

  const [accountModal, setAccountModal] = useState<{ visible: boolean; editing: AccountUser | null }>({ visible: false, editing: null });
  const [shopModal, setShopModal]       = useState<{ visible: boolean; editing: Shop | null }>({ visible: false, editing: null });
  const [roleModal, setRoleModal]       = useState<{ visible: boolean; role: string | null }>({ visible: false, role: null });

  const isAdmin = ['admin', 'ADMIN'].includes(user?.role ?? '');
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [cRes, aRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/settings/company`,  { headers: authHeaders }),
        fetch(`${API_BASE}/settings/accounts`, { headers: authHeaders }),
        fetch(`${API_BASE}/settings/shops`,    { headers: authHeaders }),
      ]);
      const [cJson, aJson, sJson] = await Promise.all([cRes.json(), aRes.json(), sRes.json()]);
      if (cJson.success) {
        setCompany(cJson.data.company);
        setSubscription(cJson.data.company?.subscription ?? null);
        setUsage(cJson.data.usage);
      }
      if (aJson.success) setAccounts(aJson.data);
      if (sJson.success) setShops(sJson.data);
    } catch { Alert.alert('Erreur', 'Impossible de charger les paramètres'); }
    finally   { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function deleteAccount(id: string, name: string) {
    Alert.alert('Confirmation', `Supprimer le compte de ${name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        const res  = await fetch(`${API_BASE}/settings/accounts/${id}`, { method: 'DELETE', headers: authHeaders });
        const json = await res.json();
        if (json.success) fetchAll();
        else Alert.alert('Erreur', json.error?.message ?? 'Erreur');
      }},
    ]);
  }

  async function deleteShop(id: string, name: string) {
    Alert.alert('Confirmation', `Supprimer "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        const res  = await fetch(`${API_BASE}/settings/shops/${id}`, { method: 'DELETE', headers: authHeaders });
        const json = await res.json();
        if (json.success) fetchAll();
        else Alert.alert('Erreur', json.error?.message ?? 'Erreur');
      }},
    ]);
  }

  // ── Tab: Team ────────────────────────────────────────────────────────────────

  function renderTeam() {
    const maxAccounts = subscription?.maxAccounts ?? 3;
    const canAdd      = maxAccounts === -1 || accounts.length < maxAccounts;
    const roleCount   = accounts.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1; return acc;
    }, {});

    return (
      <ScrollView contentContainerStyle={st.tabContent} showsVerticalScrollIndicator={false}>

        {/* Donut overview */}
        <Reanimated.View entering={FadeInDown.duration(400)}>
          <View style={st.overviewCard}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={st.overviewEyebrow}>Distribution des rôles</Text>
              <Text style={st.overviewBig}>
                {accounts.length}
                <Text style={st.overviewBigSub}> collaborateurs</Text>
              </Text>
              <View style={st.distList}>
                {Object.entries(roleCount).map(([r, n]) => (
                  <View key={r} style={st.distRow}>
                    <View style={[st.distDot, { backgroundColor: ROLE_META[r]?.color ?? '#ccc' }]} />
                    <Text style={st.distLabel}>{ROLE_META[r]?.label ?? r}</Text>
                    <Text style={st.distNum}>{n}</Text>
                  </View>
                ))}
              </View>
            </View>
            <RoleDonut accounts={accounts} size={110} />
          </View>
        </Reanimated.View>

        {/* Section header */}
        <Reanimated.View entering={FadeInDown.duration(400).delay(60)}>
          <View style={st.sectionRow}>
            <View style={st.sectionLeft}>
              <View style={st.sectionBar} />
              <Text style={st.sectionTitle}>Comptes</Text>
              <View style={st.countPill}>
                <Text style={st.countPillText}>
                  {accounts.length}{maxAccounts !== -1 ? `/${maxAccounts}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[st.addBtn, !canAdd && { opacity: 0.35 }]}
              onPress={() => canAdd && setAccountModal({ visible: true, editing: null })}
              disabled={!canAdd}
            >
              <MaterialIcons name="person-add" size={13} color="#fff" />
              <Text style={st.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </Reanimated.View>

        {/* Account cards */}
        {accounts.map((acc, i) => {
          const m = ROLE_META[acc.role] ?? { color: colors.textTertiary, icon: 'person', label: acc.role };
          return (
            <Reanimated.View key={acc.id} entering={FadeInDown.duration(350).delay(120 + i * 55)}>
              <View style={[st.accountCard, { borderLeftColor: m.color }]}>
                <View style={[st.accountAvatar, { backgroundColor: m.color + '1A' }]}>
                  <Text style={[st.accountAvatarText, { color: m.color }]}>
                    {(acc.firstName?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={st.accountMeta}>
                  <Text style={st.accountName}>{acc.firstName} {acc.lastName}</Text>
                  <Text style={st.accountEmail}>{acc.email}</Text>
                  {(acc.shops?.length ?? 0) > 0 && (
                    <View style={st.shopTagRow}>
                      {acc.shops!.map(s => (
                        <View key={s.id} style={st.shopTag}>
                          <MaterialIcons name="storefront" size={10} color={colors.textTertiary} />
                          <Text style={st.shopTagText}>{s.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={st.accountActions}>
                  <RoleBadge role={acc.role} />
                  <View style={st.btnRow}>
                    <TouchableOpacity style={st.editBtn} onPress={() => setAccountModal({ visible: true, editing: acc })}>
                      <MaterialIcons name="edit" size={14} color={colors.navy} />
                    </TouchableOpacity>
                    <TouchableOpacity style={st.deleteBtn} onPress={() => deleteAccount(acc.id, `${acc.firstName} ${acc.lastName}`)}>
                      <MaterialIcons name="delete-outline" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              {!acc.isActive && (
                <View style={st.inactiveBanner}>
                  <MaterialIcons name="block" size={11} color={colors.danger} />
                  <Text style={st.inactiveBannerText}>Compte désactivé</Text>
                </View>
              )}
            </Reanimated.View>
          );
        })}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    );
  }

  // ── Tab: Boutiques ──────────────────────────────────────────────────────────

  function renderBoutiques() {
    const maxShops   = subscription?.maxShops ?? 1;
    const activeShops = shops.filter(s => s.isActive).length;

    return (
      <ScrollView contentContainerStyle={st.tabContent} showsVerticalScrollIndicator={false}>

        {/* Stat bar */}
        <Reanimated.View entering={FadeInDown.duration(400)}>
          <View style={st.shopStatsRow}>
            {[
              { num: activeShops, label: 'Actives', color: colors.success },
              { num: shops.length - activeShops, label: 'Inactives', color: colors.danger },
              { num: shops.length, label: maxShops === -1 ? 'Total' : `sur ${maxShops}`, color: colors.gold },
            ].map(({ num, label, color }) => (
              <View key={label} style={st.shopStatCard}>
                <Text style={[st.shopStatNum, { color }]}>{num}</Text>
                <Text style={st.shopStatLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </Reanimated.View>

        {/* Section header */}
        <Reanimated.View entering={FadeInDown.duration(400).delay(60)}>
          <View style={st.sectionRow}>
            <View style={st.sectionLeft}>
              <View style={st.sectionBar} />
              <Text style={st.sectionTitle}>Points de vente</Text>
            </View>
            {isAdmin && (
              <TouchableOpacity style={st.addBtn} onPress={() => setShopModal({ visible: true, editing: null })}>
                <MaterialIcons name="add-business" size={13} color="#fff" />
                <Text style={st.addBtnText}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>
        </Reanimated.View>

        {/* Boutique cards */}
        {shops.map((shop, i) => {
          const assigned = (shop as any).users ?? [];
          return (
            <Reanimated.View key={shop.id} entering={FadeInDown.duration(350).delay(120 + i * 55)}>
              <View style={st.boutiqueCard}>
                <View style={st.boutiqueTop}>
                  <View style={[st.boutiqueIcon, shop.isActive ? { backgroundColor: colors.successLight } : { backgroundColor: colors.borderLight }]}>
                    <MaterialIcons name="storefront" size={20} color={shop.isActive ? colors.success : colors.textTertiary} />
                  </View>
                  <View style={st.boutiqueInfo}>
                    <Text style={st.boutiqueName}>{shop.name}</Text>
                    {(shop.address || shop.city) && (
                      <Text style={st.boutiqueAddr}>{[shop.address, shop.city].filter(Boolean).join(' · ')}</Text>
                    )}
                    {shop.code && <Text style={st.boutiqueCode}>#{shop.code}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[st.statusPill,
                      shop.isActive
                        ? { backgroundColor: colors.successLight, borderColor: colors.success + '40' }
                        : { backgroundColor: colors.borderLight, borderColor: colors.border }
                    ]}>
                      <View style={[st.statusDot, { backgroundColor: shop.isActive ? colors.success : colors.textTertiary }]} />
                      <Text style={[st.statusPillText, { color: shop.isActive ? colors.success : colors.textSecondary }]}>
                        {shop.isActive ? 'Actif' : 'Inactif'}
                      </Text>
                    </View>
                    {isAdmin && (
                      <View style={st.btnRow}>
                        <TouchableOpacity style={st.editBtn} onPress={() => setShopModal({ visible: true, editing: shop })}>
                          <MaterialIcons name="edit" size={14} color={colors.navy} />
                        </TouchableOpacity>
                        <TouchableOpacity style={st.deleteBtn} onPress={() => deleteShop(shop.id, shop.name)}>
                          <MaterialIcons name="delete-outline" size={14} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                {/* Assigned team */}
                <View style={st.boutiqueTeam}>
                  {assigned.slice(0, 5).map((u: any) => {
                    const rm = ROLE_META[u.role] ?? { color: colors.textTertiary };
                    return (
                      <View key={u.id} style={[st.miniAvatar, { backgroundColor: rm.color + '20', borderColor: rm.color + '50' }]}>
                        <Text style={[st.miniAvatarText, { color: rm.color }]}>
                          {(u.firstName?.[0] ?? u.lastName?.[0] ?? '?').toUpperCase()}
                        </Text>
                      </View>
                    );
                  })}
                  {assigned.length > 5 && (
                    <View style={[st.miniAvatar, { backgroundColor: colors.borderLight, borderColor: colors.border }]}>
                      <Text style={[st.miniAvatarText, { color: colors.textSecondary }]}>+{assigned.length - 5}</Text>
                    </View>
                  )}
                  <Text style={st.teamCountText}>
                    {assigned.length === 0
                      ? 'Aucun collaborateur assigné'
                      : `${assigned.length} collaborateur${assigned.length > 1 ? 's' : ''}`}
                  </Text>
                </View>
              </View>
            </Reanimated.View>
          );
        })}

        {shops.length === 0 && (
          <Reanimated.View entering={FadeIn.duration(500).delay(200)}>
            <View style={st.emptyState}>
              <View style={st.emptyIcon}>
                <MaterialIcons name="store-mall-directory" size={32} color={colors.textTertiary} />
              </View>
              <Text style={st.emptyTitle}>Aucune boutique</Text>
              <Text style={st.emptyText}>
                {isAdmin ? 'Créez votre premier point de vente.' : 'Les boutiques sont créées par l\'administrateur.'}
              </Text>
            </View>
          </Reanimated.View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    );
  }

  // ── Tab: Plan ────────────────────────────────────────────────────────────────

  function renderPlan() {
    const plan     = subscription?.plan   ?? 'STARTER';
    const status   = subscription?.status ?? 'TRIAL';
    const features = subscription?.features ?? [];
    const sm       = STATUS_META[status] ?? { color: colors.textSecondary, bg: colors.borderLight, label: status };
    const maxAcc   = subscription?.maxAccounts ?? 3;
    const maxShp   = subscription?.maxShops    ?? 1;

    return (
      <ScrollView contentContainerStyle={st.tabContent} showsVerticalScrollIndicator={false}>

        {/* Luxury plan card */}
        <Reanimated.View entering={FadeInDown.duration(450)}>
          <View style={st.planCard}>
            <View style={[st.planCircle, { width: 220, height: 220, top: -90, right: -70 }]} />
            <View style={[st.planCircle, { width: 110, height: 110, top: -10, right: 70, opacity: 0.04 }]} />
            <View style={st.planTopRow}>
              <View style={[st.planStatusBadge, { backgroundColor: sm.bg }]}>
                <View style={[st.statusDot, { backgroundColor: sm.color }]} />
                <Text style={[st.planStatusText, { color: sm.color }]}>{sm.label}</Text>
              </View>
              <Text style={st.planWordmark}>KONFIRM</Text>
            </View>
            <Text style={st.planName}>{plan}</Text>
            {company?.name && <Text style={st.planCompany}>{company.name}</Text>}
            {subscription?.expiresAt && (
              <Text style={st.planExpiry}>
                Expire le {new Date(subscription.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
            )}
          </View>
        </Reanimated.View>

        {/* Usage arcs */}
        <Reanimated.View entering={FadeInDown.duration(400).delay(80)}>
          <View style={st.sectionRow}>
            <View style={st.sectionLeft}>
              <View style={st.sectionBar} />
              <Text style={st.sectionTitle}>Utilisation</Text>
            </View>
          </View>
          <View style={st.usageRow}>
            <UsageArcCard label="Comptes"   used={usage.accounts} max={maxAcc} color={colors.navy} />
            <UsageArcCard label="Boutiques" used={usage.shops}    max={maxShp} color={colors.gold} />
          </View>
        </Reanimated.View>

        {/* Features */}
        {features.length > 0 && (
          <Reanimated.View entering={FadeInDown.duration(400).delay(160)}>
            <View style={st.sectionRow}>
              <View style={st.sectionLeft}>
                <View style={st.sectionBar} />
                <Text style={st.sectionTitle}>Fonctionnalités</Text>
              </View>
            </View>
            <View style={st.featureCard}>
              {features.map((f, i) => (
                <View key={f} style={[st.featureRow, i === features.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={st.featureCheck}>
                    <MaterialIcons name="check" size={12} color={colors.success} />
                  </View>
                  <Text style={st.featureText}>{f.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          </Reanimated.View>
        )}

        {/* Role matrix */}
        <Reanimated.View entering={FadeInDown.duration(400).delay(220)}>
          <View style={st.sectionRow}>
            <View style={st.sectionLeft}>
              <View style={st.sectionBar} />
              <Text style={st.sectionTitle}>Accès par rôle</Text>
            </View>
          </View>
          {Object.entries(ROLE_META).map(([r, m]) => (
            <TouchableOpacity key={r} style={st.roleRow} onPress={() => setRoleModal({ visible: true, role: r })} activeOpacity={0.72}>
              <View style={[st.roleRowIcon, { backgroundColor: m.color + '15' }]}>
                <MaterialIcons name={m.icon as any} size={16} color={m.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.roleRowTitle}>{m.label}</Text>
                <Text style={st.roleRowSub} numberOfLines={1}>{ROLE_FEATURES[r]?.slice(0, 2).join(' · ')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </Reanimated.View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[st.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md, fontFamily: fonts.interface, fontSize: 13 }}>Chargement…</Text>
      </View>
    );
  }

  const TAB_CONFIG: { id: Tab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'team',      label: 'Équipe',    icon: 'people' },
    { id: 'boutiques', label: 'Boutiques', icon: 'storefront' },
    { id: 'plan',      label: 'Plan',      icon: 'workspace-premium' },
  ];

  const initials = company?.name
    ? company.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';
  const activeCount = accounts.filter(a => a.isActive).length;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <View style={st.hero}>
        <View style={st.heroCircleA} />
        <View style={st.heroCircleB} />

        <View style={st.heroTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <MaterialIcons name="arrow-back-ios" size={15} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {subscription?.plan && (
            <View style={st.heroPlanBadge}>
              <MaterialIcons name="workspace-premium" size={11} color={colors.gold} />
              <Text style={st.heroPlanText}>{subscription.plan}</Text>
            </View>
          )}
        </View>

        <View style={st.heroCompanyRow}>
          <View style={st.heroAvatar}>
            <Text style={st.heroAvatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.heroTitle}>{company?.name ?? 'Gestion'}</Text>
            <Text style={st.heroSub}>
              {accounts.length} collaborateur{accounts.length > 1 ? 's' : ''} · {shops.length} boutique{shops.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={st.heroStats}>
          {[
            { num: activeCount,                   label: 'Actifs' },
            { num: shops.filter(s => s.isActive).length, label: 'Boutiques' },
            { num: accounts.length > 0 ? Math.round(activeCount / accounts.length * 100) : 0, label: 'Activité', suffix: '%' },
          ].map(({ num, label, suffix }, i, arr) => (
            <React.Fragment key={label}>
              <View style={st.heroStatCell}>
                <Text style={st.heroStatNum}>{num}{suffix ?? ''}</Text>
                <Text style={st.heroStatLabel}>{label}</Text>
              </View>
              {i < arr.length - 1 && <View style={st.heroStatSep} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <View style={st.tabBar}>
        {TAB_CONFIG.map(({ id, label, icon }) => {
          const active = tab === id;
          return (
            <TouchableOpacity
              key={id}
              style={[st.tabItem, active && st.tabItemActive]}
              onPress={() => setTab(id)}
              activeOpacity={0.8}
            >
              <MaterialIcons name={icon} size={15} color={active ? '#fff' : colors.textTertiary} />
              <Text style={[st.tabLabel, active && st.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        {tab === 'team'      && renderTeam()}
        {tab === 'boutiques' && renderBoutiques()}
        {tab === 'plan'      && renderPlan()}
      </View>

      <AccountModal
        visible={accountModal.visible} editing={accountModal.editing}
        shops={shops} headers={authHeaders}
        onClose={() => setAccountModal({ visible: false, editing: null })}
        onSaved={fetchAll}
      />
      <ShopModal
        visible={shopModal.visible} editing={shopModal.editing}
        headers={authHeaders}
        onClose={() => setShopModal({ visible: false, editing: null })}
        onSaved={fetchAll}
      />
      <RoleDetailModal
        visible={roleModal.visible} role={roleModal.role}
        onClose={() => setRoleModal({ visible: false, role: null })}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // ── Hero
  hero: { backgroundColor: colors.primaryDark, paddingHorizontal: spacing.md, paddingBottom: spacing.lg, overflow: 'hidden' },
  heroCircleA: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: colors.navy3, opacity: 0.28, top: -110, right: -80 },
  heroCircleB: { position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: colors.gold,  opacity: 0.045, bottom: -30, left: 20 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.xs, marginBottom: spacing.sm },
  backBtn: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  heroPlanBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.gold + '35' },
  heroPlanText: { color: colors.gold, fontSize: 11, fontFamily: fonts.interfaceMedium, letterSpacing: 0.6 },
  heroCompanyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  heroAvatar: { width: 50, height: 50, borderRadius: radius.full, backgroundColor: colors.gold + '22', borderWidth: 1.5, borderColor: colors.gold + '50', alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { color: colors.gold, fontSize: 18, fontFamily: fonts.displayItalic },
  heroTitle: { color: '#fff', fontSize: 20, fontFamily: fonts.display, letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: fonts.interface, marginTop: 2 },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', overflow: 'hidden' },
  heroStatCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  heroStatNum: { color: '#fff', fontSize: 19, fontFamily: fonts.interfaceBold, fontWeight: '800' },
  heroStatLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: fonts.interface, marginTop: 2, letterSpacing: 0.3 },
  heroStatSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 6 },

  // ── Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, padding: spacing.xs, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.lg },
  tabItemActive: { backgroundColor: colors.navy, ...shadows.sm },
  tabLabel: { fontSize: 12, color: colors.textTertiary, fontFamily: fonts.interfaceMedium },
  tabLabelActive: { color: '#fff', fontFamily: fonts.interfaceBold },

  tabContent: { padding: spacing.md, gap: spacing.sm },

  // ── Overview card
  overviewCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, ...shadows.sm },
  overviewEyebrow: { fontSize: 10, color: colors.textTertiary, fontFamily: fonts.interfaceMedium, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  overviewBig: { fontSize: 26, color: colors.textPrimary, fontFamily: fonts.interfaceBold, fontWeight: '800' },
  overviewBigSub: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.interface, fontWeight: '400' },
  distList: { gap: 6, marginTop: 10 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  distDot: { width: 7, height: 7, borderRadius: 4 },
  distLabel: { flex: 1, fontSize: 12, color: colors.textSecondary, fontFamily: fonts.interface },
  distNum: { fontSize: 12, fontFamily: fonts.interfaceBold, fontWeight: '700', color: colors.textPrimary },

  // ── Section row
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBar: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.gold },
  sectionTitle: { fontSize: 13, fontFamily: fonts.interfaceBold, fontWeight: '700', color: colors.textPrimary },
  countPill: { backgroundColor: colors.borderLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.interfaceMedium },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.navy, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, ...shadows.sm },
  addBtnText: { color: '#fff', fontSize: 12, fontFamily: fonts.interfaceBold, fontWeight: '700' },

  // ── Account card
  accountCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.borderLight, borderLeftWidth: 3, ...shadows.xs },
  accountAvatar: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { fontSize: 16, fontFamily: fonts.interfaceBold, fontWeight: '800' },
  accountMeta: { flex: 1 },
  accountName: { fontSize: 14, fontFamily: fonts.interfaceBold, fontWeight: '700', color: colors.textPrimary },
  accountEmail: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.interface, marginTop: 1 },
  shopTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  shopTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.borderLight, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  shopTagText: { fontSize: 10, color: colors.textSecondary, fontFamily: fonts.interface },
  accountActions: { alignItems: 'flex-end', gap: 6 },
  btnRow: { flexDirection: 'row', gap: 4 },
  editBtn: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6EBF4' },
  deleteBtn: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerLight },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  roleDot: { width: 5, height: 5, borderRadius: 3 },
  roleBadgeText: { fontSize: 10, fontFamily: fonts.interfaceMedium, fontWeight: '700', letterSpacing: 0.3 },
  inactiveBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.dangerLight, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4, marginTop: 3 },
  inactiveBannerText: { fontSize: 10, color: colors.danger, fontFamily: fonts.interfaceMedium, fontWeight: '600' },

  // ── Shop stats
  shopStatsRow: { flexDirection: 'row', gap: spacing.sm },
  shopStatCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, ...shadows.xs },
  shopStatNum: { fontSize: 24, fontFamily: fonts.interfaceBold, fontWeight: '800', color: colors.textPrimary },
  shopStatLabel: { fontSize: 11, color: colors.textTertiary, fontFamily: fonts.interface, marginTop: 2 },

  // ── Boutique card
  boutiqueCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight, ...shadows.xs },
  boutiqueTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  boutiqueIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  boutiqueInfo: { flex: 1 },
  boutiqueName: { fontSize: 14, fontFamily: fonts.interfaceBold, fontWeight: '700', color: colors.textPrimary },
  boutiqueAddr: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.interface, marginTop: 2 },
  boutiqueCode: { fontSize: 10, color: colors.textTertiary, fontFamily: fonts.mono, marginTop: 2 },
  boutiqueTeam: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  miniAvatar: { width: 26, height: 26, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  miniAvatarText: { fontSize: 10, fontFamily: fonts.interfaceBold, fontWeight: '700' },
  teamCountText: { fontSize: 11, color: colors.textTertiary, fontFamily: fonts.interface, marginLeft: 'auto' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontFamily: fonts.interfaceMedium, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon: { width: 68, height: 68, borderRadius: radius.full, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontFamily: fonts.interfaceBold, fontWeight: '700', color: colors.textSecondary },
  emptyText: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', fontFamily: fonts.interface, paddingHorizontal: spacing.lg, lineHeight: 20 },

  // ── Plan card
  planCard: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden', ...shadows.lg },
  planCircle: { position: 'absolute', borderRadius: 9999, backgroundColor: colors.gold, opacity: 0.05 },
  planTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  planStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  planStatusText: { fontSize: 11, fontFamily: fonts.interfaceMedium, fontWeight: '700' },
  planWordmark: { color: colors.gold + '55', fontSize: 10, fontFamily: fonts.interfaceMedium, letterSpacing: 2.5 },
  planName: { color: '#fff', fontSize: 32, fontFamily: fonts.display, fontWeight: '300', letterSpacing: -0.5, marginBottom: 4 },
  planCompany: { color: 'rgba(255,255,255,0.38)', fontSize: 12, fontFamily: fonts.interface, marginBottom: spacing.sm },
  planExpiry: { color: 'rgba(255,255,255,0.28)', fontSize: 11, fontFamily: fonts.interface, marginTop: 4 },

  // ── Usage arcs
  usageRow: { flexDirection: 'row', gap: spacing.sm },
  usageArcCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, ...shadows.xs },
  arcCenterNum: { fontSize: 13, fontFamily: fonts.interfaceBold, fontWeight: '800' },
  arcLabel: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.interface, marginTop: 8 },
  arcCount: { fontSize: 13, fontFamily: fonts.interfaceBold, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },

  // ── Feature card
  featureCard: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderLight, ...shadows.xs },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  featureCheck: { width: 24, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successLight },
  featureText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontFamily: fonts.interface },

  // ── Role matrix
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.borderLight },
  roleRowIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  roleRowTitle: { fontSize: 13, fontFamily: fonts.interfaceBold, fontWeight: '700', color: colors.textPrimary },
  roleRowSub: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.interface, marginTop: 2 },

  // ── Modal / Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(10,22,40,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '92%', ...shadows.xl },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, alignSelf: 'center', marginTop: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sheetIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 17, fontFamily: fonts.interfaceBold, fontWeight: '800', color: colors.textPrimary },
  sheetSub: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.interface, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderLight, marginLeft: 'auto' },
  sheetBody: { padding: spacing.lg },
  sheetFooter: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight },

  // ── Form
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  fieldGroup: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 10, fontFamily: fonts.interfaceMedium, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 6 },
  inputWrap: { borderWidth: 1.5, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  textInput: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.textPrimary, fontFamily: fonts.interface },
  rolePicker: { gap: spacing.xs, marginBottom: spacing.md },
  rolePickerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.surfaceAlt },
  rolePickerIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rolePickerLabel: { flex: 1, fontSize: 13, color: colors.textSecondary, fontFamily: fonts.interface },
  rolePickerDot: { width: 8, height: 8, borderRadius: 4 },
  shopPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  shopPickerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.surfaceAlt },
  shopPickerText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.interface },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.borderLight, marginBottom: spacing.xs, backgroundColor: colors.surfaceAlt },
  toggleRowOn: { borderColor: colors.success, backgroundColor: colors.successLight + '40' },
  toggleBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { flex: 1, fontSize: 13, color: colors.textPrimary, fontFamily: fonts.interface },
  btnSolid: { flex: 1, backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  btnSolidText: { color: '#fff', fontSize: 14, fontFamily: fonts.interfaceBold, fontWeight: '700' },
  btnOutline: { paddingHorizontal: spacing.lg, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.interfaceMedium, fontWeight: '600' },
});
