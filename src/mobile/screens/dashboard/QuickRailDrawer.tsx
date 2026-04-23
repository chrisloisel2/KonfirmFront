import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius } from '../../../shared/theme/theme';

const CONTENT_W = 156;
const TAB_W = 30;

interface Shortcut {
  key: string;
  label: string;
  icon: string;
  color: string;
}

export function QuickRailDrawer({
  shortcuts,
  onNavigate,
}: {
  shortcuts: Shortcut[];
  onNavigate: (screen: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(CONTENT_W)).current;

  function slide(toOpen: boolean) {
    Animated.spring(anim, {
      toValue: toOpen ? 0 : CONTENT_W,
      useNativeDriver: true,
      tension: 68,
      friction: 13,
    }).start();
    setOpen(toOpen);
  }

  return (
    <>
      {open && (
        <Pressable
          style={[StyleSheet.absoluteFillObject, styles.backdrop]}
          onPress={() => slide(false)}
        />
      )}

      <Animated.View
        pointerEvents="box-none"
        style={[styles.rail, { transform: [{ translateX: anim }] }]}
      >
        {/* Onglet — toujours visible au bord droit */}
        <View style={styles.tabCol} pointerEvents="box-none">
          <TouchableOpacity style={styles.tab} onPress={() => slide(!open)} activeOpacity={0.8}>
            <MaterialIcons
              name={open ? 'chevron-right' : 'chevron-left'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Panneau des raccourcis */}
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Accès rapide</Text>
          {shortcuts.map(s => (
            <TouchableOpacity
              key={s.key}
              style={styles.item}
              onPress={() => { slide(false); onNavigate(s.key); }}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIcon, { backgroundColor: s.color + '1A' }]}>
                <MaterialIcons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={styles.itemLabel} numberOfLines={2}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    zIndex: 49,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  rail: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TAB_W + CONTENT_W,
    flexDirection: 'row',
    zIndex: 50,
  },
  tabCol: {
    width: TAB_W,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tab: {
    width: TAB_W,
    height: 54,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  panel: {
    width: CONTENT_W,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 2,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  panelLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 15,
  },
});
