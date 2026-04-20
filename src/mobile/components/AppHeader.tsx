import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../../shared/theme/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
  bg?: string;
  light?: boolean; // white background variant
}

export default function AppHeader({
  title,
  subtitle,
  onBack,
  right,
  children,
  bg,
  light = false,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  const backgroundColor = bg ?? (light ? colors.surface : colors.primary);
  const textColor = light ? colors.textPrimary : '#fff';
  const subColor = light ? colors.textSecondary : 'rgba(255,255,255,0.65)';
  const iconColor = light ? colors.textPrimary : '#fff';

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {/* Left: back button or spacer */}
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back" size={22} color={iconColor} />
          </TouchableOpacity>
        ) : (
          <View style={styles.leftSpacer} />
        )}

        {/* Center: title + subtitle */}
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right: optional action */}
        <View style={styles.rightSlot}>
          {right ?? null}
        </View>
      </View>

      {children ? <View style={styles.bottom}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  leftSpacer: {
    width: 0,
  },
  titleBlock: {
    flex: 1,
    gap: 1,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  rightSlot: {
    marginLeft: spacing.sm,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  bottom: {
    marginTop: spacing.sm,
  },
});
