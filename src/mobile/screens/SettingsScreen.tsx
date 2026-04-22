import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../shared/services/AuthContext';
import { colors, radius, spacing, typography } from '../../shared/theme/theme';
import type { AccountUser, Company, CompanyUsage, Shop, Subscription } from '../../shared/types';

import { API_BASE } from '../../shared/config/api';

type Tab = 'accounts' | 'shops' | 'subscription';

const ROLE_LABELS: Record<string, string> = {
  CONSEILLER: 'Conseiller',
  CAISSE: 'Caisse',
  REFERENT: 'Référent',
  RESPONSABLE: 'Responsable',
  ADMIN: 'Admin',
};

const ROLE_COLORS: Record<string, string> = {
  CONSEILLER: colors.info,
  CAISSE: colors.success,
  REFERENT: colors.warning,
  RESPONSABLE: colors.primaryLight,
  ADMIN: colors.scoreCritical,
};

const ROLE_FEATURES: Record<string, string[]> = {
  CONSEILLER: ['Dossiers (propres)', 'Documents', 'Recherches basiques'],
  CAISSE: ['Dossiers (agence)', 'Documents', 'Recherches'],
  REFERENT: ['Tous les dossiers', 'Scoring', 'Exceptions', 'Recherches avancées'],
  RESPONSABLE: ['Validation', 'Statistiques', 'Rapports', 'Watchlists'],
  ADMIN: ['Paramètres société', 'Gestion comptes & shops', 'Tracfin', 'API'],
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
};

const STATUS_COLORS: Record<string, string> = {
  TRIAL: colors.warning,
  ACTIVE: colors.success,
  EXPIRED: colors.error,
  SUSPENDED: colors.textSecondary,
};

// ─── Small reusable components ────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{ROLE_LABELS[role] ?? role}</Text>
    </View>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.min(used / max, 1);
  const barColor = pct > 0.85 ? colors.error : pct > 0.6 ? colors.warning : colors.success;
  return (
    <View style={styles.usageRow}>
      <View style={styles.usageLabelRow}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={[styles.usageCount, { color: barColor }]}>
          {unlimited ? `${used} / ∞` : `${used} / ${max}`}
        </Text>
      </View>
      {!unlimited && (
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
        </View>
      )}
    </View>
  );
}

function ModalInput({
  label, value, onChangeText, keyboardType, secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.textInput, focused && styles.textInputFocused]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// ─── Account Modal ────────────────────────────────────────────────────────────

interface AccountModalProps {
  visible: boolean;
  editing: AccountUser | null;
  shops: Shop[];
  headers: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

function AccountModal({ visible, editing, shops, headers, onClose, onSaved }: AccountModalProps) {
  const isEdit = !!editing;
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CONSEILLER');
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
    setSelectedShopIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { role, shopIds: selectedShopIds };
      if (!isEdit) {
        if (!email || !firstName || !lastName || !password) {
          Alert.alert('Erreur', 'Tous les champs sont requis');
          return;
        }
        body.email = email;
        body.firstName = firstName;
        body.lastName = lastName;
        body.password = password;
      } else if (password) {
        body.password = password;
      }

      const url = isEdit
        ? `${API_BASE}/settings/accounts/${editing!.id}`
        : `${API_BASE}/settings/accounts`;

      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { onClose(); onSaved(); }
      else Alert.alert('Erreur', json.error?.message ?? 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Modifier le compte' : 'Nouveau compte'}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {!isEdit && (
              <>
                <ModalInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
                <ModalInput label="Prénom" value={firstName} onChangeText={setFirstName} />
                <ModalInput label="Nom" value={lastName} onChangeText={setLastName} />
              </>
            )}
            <ModalInput
              label={isEdit ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Text style={styles.fieldLabel}>Rôle</Text>
            <View style={styles.roleGrid}>
              {Object.entries(ROLE_LABELS).map(([r, label]) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && { backgroundColor: ROLE_COLORS[r] + '20', borderColor: ROLE_COLORS[r] }]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleChipText, role === r && { color: ROLE_COLORS[r] }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {shops.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Shops accessibles</Text>
                {shops.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.checkRow, selectedShopIds.includes(s.id) && styles.checkRowActive]}
                    onPress={() => toggleShop(s.id)}
                  >
                    <MaterialIcons
                      name={selectedShopIds.includes(s.id) ? 'check-box' : 'check-box-outline-blank'}
                      size={20}
                      color={selectedShopIds.includes(s.id) ? colors.primary : colors.textTertiary}
                    />
                    <Text style={styles.checkLabel}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            <View style={{ height: spacing.lg }} />
          </ScrollView>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.surface} />
              : <Text style={styles.saveBtnText}>{isEdit ? 'Enregistrer' : 'Créer le compte'}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Shop Modal ───────────────────────────────────────────────────────────────

interface ShopModalProps {
  visible: boolean;
  editing: Shop | null;
  headers: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

function ShopModal({ visible, editing, headers, onClose, onSaved }: ShopModalProps) {
  const isEdit = !!editing;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

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
    if (!name.trim()) { Alert.alert('Erreur', 'Le nom est requis'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        code: code.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
      };
      if (isEdit) body.isActive = isActive;

      const url = isEdit ? `${API_BASE}/settings/shops/${editing!.id}` : `${API_BASE}/settings/shops`;
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { onClose(); onSaved(); }
      else Alert.alert('Erreur', json.error?.message ?? 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Modifier le shop' : 'Nouveau shop'}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <ModalInput label="Nom du shop" value={name} onChangeText={setName} />
            <ModalInput label="Code (optionnel)" value={code} onChangeText={setCode} />
            <ModalInput label="Adresse (optionnel)" value={address} onChangeText={setAddress} />
            <ModalInput label="Ville (optionnel)" value={city} onChangeText={setCity} />
            {isEdit && (
              <TouchableOpacity
                style={[styles.checkRow, isActive && styles.checkRowActive]}
                onPress={() => setIsActive(!isActive)}
              >
                <MaterialIcons
                  name={isActive ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color={isActive ? colors.primary : colors.textTertiary}
                />
                <Text style={styles.checkLabel}>Shop actif</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: spacing.lg }} />
          </ScrollView>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.surface} />
              : <Text style={styles.saveBtnText}>{isEdit ? 'Enregistrer' : 'Créer le shop'}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Role detail modal ────────────────────────────────────────────────────────

function RoleDetailModal({ visible, role, onClose }: { visible: boolean; role: string | null; onClose: () => void }) {
  if (!role) return null;
  const feats = ROLE_FEATURES[role] ?? [];
  const color = ROLE_COLORS[role] ?? colors.textSecondary;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: 420 }]}>
          <View style={styles.modalHeader}>
            <View style={styles.cardRow}>
              <RoleBadge role={role} />
              <Text style={styles.modalTitle}>{ROLE_LABELS[role]}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={[styles.fieldLabel, { marginBottom: spacing.sm }]}>Fonctionnalités accessibles</Text>
            {feats.map((f) => (
              <View key={f} style={styles.featureRow}>
                <MaterialIcons name="check-circle" size={16} color={color} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, user } = useAuth();

  const [tab, setTab] = useState<Tab>('accounts');
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<CompanyUsage>({ accounts: 0, shops: 0 });
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  const [accountModal, setAccountModal] = useState<{ visible: boolean; editing: AccountUser | null }>({ visible: false, editing: null });
  const [shopModal, setShopModal] = useState<{ visible: boolean; editing: Shop | null }>({ visible: false, editing: null });
  const [roleModal, setRoleModal] = useState<{ visible: boolean; role: string | null }>({ visible: false, role: null });

  const canManage = ['admin', 'ADMIN', 'responsable', 'RESPONSABLE'].includes(user?.role ?? '');

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [compRes, accRes, shopRes] = await Promise.all([
        fetch(`${API_BASE}/settings/company`, { headers: authHeaders }),
        fetch(`${API_BASE}/settings/accounts`, { headers: authHeaders }),
        fetch(`${API_BASE}/settings/shops`, { headers: authHeaders }),
      ]);
      const [compJson, accJson, shopJson] = await Promise.all([
        compRes.json(), accRes.json(), shopRes.json(),
      ]);
      if (compJson.success) {
        setCompany(compJson.data.company);
        setSubscription(compJson.data.company?.subscription ?? null);
        setUsage(compJson.data.usage);
      }
      if (accJson.success) setAccounts(accJson.data);
      if (shopJson.success) setShops(shopJson.data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les paramètres');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function deleteAccount(id: string, name: string) {
    Alert.alert('Supprimer le compte', `Supprimer ${name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          const res = await fetch(`${API_BASE}/settings/accounts/${id}`, { method: 'DELETE', headers: authHeaders });
          const json = await res.json();
          if (json.success) fetchAll();
          else Alert.alert('Erreur', json.error?.message ?? 'Erreur');
        },
      },
    ]);
  }

  async function deleteShop(id: string, name: string) {
    Alert.alert('Supprimer le shop', `Supprimer "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          const res = await fetch(`${API_BASE}/settings/shops/${id}`, { method: 'DELETE', headers: authHeaders });
          const json = await res.json();
          if (json.success) fetchAll();
          else Alert.alert('Erreur', json.error?.message ?? 'Erreur');
        },
      },
    ]);
  }

  // ─── Accounts tab ─────────────────────────────────────────────────────────

  function renderAccounts() {
    const maxAccounts = subscription?.maxAccounts ?? 3;
    const canAdd = canManage && (maxAccounts === -1 || accounts.length < maxAccounts);
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <UsageBar used={accounts.length} max={maxAccounts} label="Comptes utilisés" />
        <SectionHeader
          title="Comptes"
          action={canAdd ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setAccountModal({ visible: true, editing: null })}>
              <MaterialIcons name="person-add" size={16} color={colors.surface} />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          ) : undefined}
        />
        {accounts.map((acc) => (
          <View key={acc.id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(acc.firstName?.[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{acc.firstName} {acc.lastName}</Text>
                <Text style={styles.cardSub}>{acc.email}</Text>
                {acc.shops && acc.shops.length > 0 && (
                  <Text style={styles.cardMeta}>{acc.shops.map(s => s.name).join(', ')}</Text>
                )}
              </View>
              <View style={styles.cardActions}>
                <RoleBadge role={acc.role} />
                {canManage && (
                  <View style={styles.iconRow}>
                    <TouchableOpacity onPress={() => setAccountModal({ visible: true, editing: acc })} style={styles.iconBtn}>
                      <MaterialIcons name="edit" size={18} color={colors.info} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteAccount(acc.id, `${acc.firstName} ${acc.lastName}`)} style={styles.iconBtn}>
                      <MaterialIcons name="delete" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
            {!acc.isActive && (
              <View style={styles.inactiveBanner}>
                <Text style={styles.inactiveBannerText}>Compte désactivé</Text>
              </View>
            )}
          </View>
        ))}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    );
  }

  // ─── Shops tab ────────────────────────────────────────────────────────────

  function renderShops() {
    const maxShops = subscription?.maxShops ?? 1;
    const canAdd = canManage && (maxShops === -1 || shops.length < maxShops);
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <UsageBar used={shops.length} max={maxShops} label="Shops utilisés" />
        <SectionHeader
          title="Shops"
          action={canAdd ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShopModal({ visible: true, editing: null })}>
              <MaterialIcons name="add-business" size={16} color={colors.surface} />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          ) : undefined}
        />
        {shops.map((shop) => (
          <View key={shop.id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primaryLight + '20' }]}>
                <MaterialIcons name="store" size={22} color={colors.primaryLight} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{shop.name}</Text>
                {shop.code && <Text style={styles.cardSub}>Code: {shop.code}</Text>}
                {(shop.address || shop.city) && (
                  <Text style={styles.cardMeta}>{[shop.address, shop.city].filter(Boolean).join(', ')}</Text>
                )}
                <Text style={styles.cardMeta}>
                  {shop.users?.length ?? 0} utilisateur{(shop.users?.length ?? 0) !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <View style={[styles.badge, {
                  backgroundColor: shop.isActive ? colors.successLight : colors.errorLight,
                  borderColor: shop.isActive ? colors.success : colors.error,
                }]}>
                  <Text style={[styles.badgeText, { color: shop.isActive ? colors.success : colors.error }]}>
                    {shop.isActive ? 'Actif' : 'Inactif'}
                  </Text>
                </View>
                {canManage && (
                  <View style={styles.iconRow}>
                    <TouchableOpacity onPress={() => setShopModal({ visible: true, editing: shop })} style={styles.iconBtn}>
                      <MaterialIcons name="edit" size={18} color={colors.info} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteShop(shop.id, shop.name)} style={styles.iconBtn}>
                      <MaterialIcons name="delete" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    );
  }

  // ─── Subscription tab ─────────────────────────────────────────────────────

  function renderSubscription() {
    const plan = subscription?.plan ?? 'STARTER';
    const status = subscription?.status ?? 'TRIAL';
    const features = subscription?.features ?? [];
    const statusColor = STATUS_COLORS[status] ?? colors.textSecondary;
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planName}>{PLAN_LABELS[plan] ?? plan}</Text>
              <Text style={styles.planCompany}>{company?.name}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{status}</Text>
            </View>
          </View>
          {subscription?.expiresAt && (
            <Text style={styles.expiryText}>
              Expire le {new Date(subscription.expiresAt).toLocaleDateString('fr-FR')}
            </Text>
          )}
        </View>

        <SectionHeader title="Utilisation" />
        <View style={styles.card}>
          <UsageBar used={usage.accounts} max={subscription?.maxAccounts ?? 3} label="Comptes" />
          <View style={{ height: spacing.md }} />
          <UsageBar used={usage.shops} max={subscription?.maxShops ?? 1} label="Shops" />
        </View>

        <SectionHeader title="Fonctionnalités incluses" />
        <View style={styles.card}>
          {features.length === 0
            ? <Text style={styles.cardSub}>Fonctionnalités de base uniquement</Text>
            : features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.featureText}>{f.replace(/_/g, ' ')}</Text>
              </View>
            ))
          }
        </View>

        <SectionHeader title="Accès par rôle" />
        {Object.entries(ROLE_FEATURES).map(([role, feats]) => (
          <TouchableOpacity
            key={role}
            style={styles.card}
            onPress={() => setRoleModal({ visible: true, role })}
          >
            <View style={styles.cardRow}>
              <RoleBadge role={role} />
              <Text style={styles.roleFeatureSummary}>{feats.slice(0, 2).join(', ')}…</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const TAB_CONFIG: { id: Tab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'accounts', label: 'Comptes', icon: 'people' },
    { id: 'shops', label: 'Shops', icon: 'store' },
    { id: 'subscription', label: 'Abonnement', icon: 'card-membership' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.textInverse} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Paramètres</Text>
          {company && <Text style={styles.headerSub}>{company.name}</Text>}
        </View>
      </View>

      <View style={styles.tabBar}>
        {TAB_CONFIG.map(({ id, label, icon }) => (
          <TouchableOpacity
            key={id}
            style={[styles.tabItem, tab === id && styles.tabItemActive]}
            onPress={() => setTab(id)}
          >
            <MaterialIcons name={icon} size={18} color={tab === id ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.flex}>
        {tab === 'accounts' && renderAccounts()}
        {tab === 'shops' && renderShops()}
        {tab === 'subscription' && renderSubscription()}
      </View>

      <AccountModal
        visible={accountModal.visible}
        editing={accountModal.editing}
        shops={shops}
        headers={authHeaders}
        onClose={() => setAccountModal({ visible: false, editing: null })}
        onSaved={fetchAll}
      />
      <ShopModal
        visible={shopModal.visible}
        editing={shopModal.editing}
        headers={authHeaders}
        onClose={() => setShopModal({ visible: false, editing: null })}
        onSaved={fetchAll}
      />
      <RoleDetailModal
        visible={roleModal.visible}
        role={roleModal.role}
        onClose={() => setRoleModal({ visible: false, role: null })}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { ...typography.h3, color: colors.textInverse },
  headerSub: { ...typography.caption, color: colors.textInverse + 'BB', marginTop: 2 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 3,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.primary },
  tabLabel: { ...typography.caption, color: colors.textTertiary },
  tabLabelActive: { color: colors.primary, fontWeight: '600' },

  tabContent: { padding: spacing.md, gap: spacing.sm },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionTitle: { ...typography.h4, color: colors.textSecondary },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  addBtnText: { ...typography.caption, color: colors.surface, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { ...typography.body1, fontWeight: '600', color: colors.textPrimary },
  cardSub: { ...typography.body2, color: colors.textSecondary },
  cardMeta: { ...typography.caption, color: colors.textTertiary },
  cardActions: { alignItems: 'flex-end', gap: 4 },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h4, color: colors.primary },

  iconRow: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 4 },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeText: { ...typography.caption, fontWeight: '700' },

  inactiveBanner: {
    backgroundColor: colors.errorLight,
    borderRadius: radius.sm,
    padding: spacing.xs,
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  inactiveBannerText: { ...typography.caption, color: colors.error },

  usageRow: { marginBottom: spacing.xs },
  usageLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  usageLabel: { ...typography.body2, color: colors.textSecondary },
  usageCount: { ...typography.body2, fontWeight: '600' },
  barTrack: { height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full },

  planCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: { ...typography.h2, color: colors.textInverse },
  planCompany: { ...typography.body2, color: colors.textInverse + 'BB', marginTop: 2 },
  expiryText: { ...typography.caption, color: colors.textInverse + 'BB', marginTop: spacing.sm },

  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  featureText: { ...typography.body2, color: colors.textPrimary },
  roleFeatureSummary: { flex: 1, ...typography.body2, color: colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  modalBody: { padding: spacing.lg },

  fieldGroup: { marginBottom: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body1,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
  },
  textInputFocused: { borderColor: colors.primary },

  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  roleChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  roleChipText: { ...typography.caption, color: colors.textSecondary },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  checkRowActive: { borderColor: colors.primary, backgroundColor: colors.accentLight },
  checkLabel: { ...typography.body2, color: colors.textPrimary },

  saveBtn: {
    backgroundColor: colors.primary,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveBtnText: { ...typography.button, color: colors.textInverse },
});
