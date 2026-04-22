import React from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { EdgeInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../../../shared/theme/theme';
import { RoleMeta } from '../../../../shared/config/rolePermissions';
import { MonitoringSummary } from '../types';
import { euros } from '../helpers';
import { HeroStat } from '../components';
import { st } from '../styles';

interface DashboardHeroProps {
  user: { firstName?: string; lastName?: string; email?: string; companyName?: string } | null;
  roleMeta: RoleMeta;
  isAdmin: boolean;
  selectedBranch: string | null | undefined;
  monitoring: MonitoringSummary;
  insets: EdgeInsets;
  headerAnim: Animated.Value;
  logout: () => void;
}

export function DashboardHero({
  user,
  roleMeta,
  isAdmin,
  selectedBranch,
  monitoring,
  insets,
  headerAnim,
  logout,
}: DashboardHeroProps) {
  const initials =
    `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() ||
    user?.email?.slice(0, 2).toUpperCase() ||
    'KF';

  return (
    <Animated.View style={[st.hero, { paddingTop: insets.top + spacing.lg, opacity: headerAnim }]}>
      <View style={st.heroDeco1} />
      <View style={st.heroDeco2} />

      <View style={st.heroTopRow}>
        <View style={st.avatarWrap}>
          <View style={st.avatarRing} />
          <View style={st.avatar}>
            <Text style={st.avatarText}>{initials}</Text>
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={st.rolePill}>
            <Text style={st.rolePillText}>{roleMeta.label.toUpperCase()}</Text>
          </View>
          <Text style={st.heroName}>
            {user?.firstName
              ? `${user.firstName} ${user?.lastName || ''}`.trim()
              : user?.companyName || 'Konfirm'}
          </Text>
          <Text style={st.heroEmail}>
            {user?.email}{selectedBranch ? ` · ${selectedBranch}` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={logout} style={st.logoutBtn}>
          <MaterialIcons name="logout" size={18} color={colors.gold3} />
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <View style={st.heroStatsRow}>
          <HeroStat label="MRR"       value={euros(monitoring.monthlyRecurringRevenueCents)} icon="monitor-heart"     index={0} />
          <HeroStat label="30 jours"  value={euros(monitoring.revenueLast30DaysCents)}       icon="payments"          index={1} />
          <HeroStat label="Abonnés"   value={String(monitoring.activeSubscriptions)}          icon="workspace-premium" index={2} />
          <HeroStat label="À valider" value={String(monitoring.paymentsPendingReview)}        icon="fact-check"        index={3} />
        </View>
      )}
    </Animated.View>
  );
}
