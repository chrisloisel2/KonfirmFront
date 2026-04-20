import { MD3LightTheme } from 'react-native-paper';

// ===== KONFIRME COLOR PALETTE =====

export const colors = {
  // Primary palette
  navy:          '#0A1628',
  navy2:         '#132240',
  navy3:         '#1D3260',
  gold:          '#BFA063',
  gold2:         '#D4B47A',
  gold3:         '#EDD89A',
  warm:          '#F7F4EE',
  cream:         '#FAF8F3',
  white:         '#FFFFFF',

  // Text (slate scale)
  slate:         '#2C3E55',
  slate2:        '#4A5E74',
  slate3:        '#8FA5BA',

  // Semantic
  success:       '#1A6B50',
  successLight:  '#E6F4EF',
  warning:       '#8A6800',
  warningLight:  '#FEF5DC',
  danger:        '#8B1C1C',
  dangerLight:   '#FDEDED',
  info:          '#1D3260',
  infoLight:     '#E6EBF4',

  // Score / risk
  scoreLow:      '#1A6B50',
  scoreMedium:   '#BFA063',
  scoreHigh:     '#8B1C1C',
  scoreCritical: '#5B1C8B',

  // Borders & surfaces
  border:        '#E8E4DC',
  borderLight:   '#F0EDE5',

  // Aliases for backward compatibility
  primary:       '#0A1628',
  primaryLight:  '#132240',
  primaryDark:   '#06101A',
  accent:        '#BFA063',
  accentLight:   '#F5EDD3',

  background:    '#F7F4EE',
  surface:       '#FAF8F3',
  surfaceAlt:    '#FFFFFF',

  textPrimary:   '#0A1628',
  textSecondary: '#4A5E74',
  textTertiary:  '#8FA5BA',
  textInverse:   '#FFFFFF',

  error:         '#8B1C1C',
  errorLight:    '#FDEDED',

  overlay:       'rgba(10, 22, 40, 0.5)',
  overlayLight:  'rgba(10, 22, 40, 0.04)',
};

// ===== TYPOGRAPHY =====
// Display: Cormorant Garamond — Interface: DM Sans — Mono: Space Mono

export const fonts = {
  display:   'CormorantGaramond-Light',
  displayItalic: 'CormorantGaramond-LightItalic',
  interface: 'DMSans-Regular',
  interfaceMedium: 'DMSans-Medium',
  interfaceBold: 'DMSans-Bold',
  mono:      'SpaceMono-Regular',
};

export const typography = {
  h1:      { fontFamily: fonts.display,          fontSize: 40, fontWeight: '300' as const, letterSpacing: -0.5, lineHeight: 44 },
  h2:      { fontFamily: fonts.display,          fontSize: 28, fontWeight: '300' as const, letterSpacing: -0.3, lineHeight: 32 },
  h3:      { fontFamily: fonts.display,          fontSize: 22, fontWeight: '400' as const, letterSpacing: -0.2, lineHeight: 26 },
  h4:      { fontFamily: fonts.interfaceMedium,  fontSize: 16, fontWeight: '500' as const, letterSpacing:  0,   lineHeight: 22 },
  body1:   { fontFamily: fonts.interface,        fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  body2:   { fontFamily: fonts.interface,        fontSize: 13, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontFamily: fonts.interface,        fontSize: 11, fontWeight: '400' as const, lineHeight: 16 },
  label:   { fontFamily: fonts.interfaceMedium,  fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.6, lineHeight: 16 },
  micro:   { fontFamily: fonts.interfaceMedium,  fontSize: 10, fontWeight: '500' as const, letterSpacing: 1.0, lineHeight: 14 },
  button:  { fontFamily: fonts.interfaceMedium,  fontSize: 14, fontWeight: '500' as const, letterSpacing: 0.2, lineHeight: 20 },
  mono:    { fontFamily: fonts.mono,             fontSize: 11, fontWeight: '400' as const, color: colors.gold },
};

// ===== SPACING (base unit: 4px) =====

export const spacing = {
  1:   4,
  2:   8,
  3:   12,
  4:   16,
  6:   24,
  8:   32,
  12:  48,
  16:  64,
  24:  96,
  // Aliases
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ===== BORDER RADIUS =====

export const radius = {
  small:  6,
  medium: 10,
  large:  14,
  pill:   999,
  // Aliases
  sm:  6,
  md:  10,
  lg:  14,
  xl:  24,
  full: 999,
};

// ===== SHADOWS =====

export const shadows = {
  xs: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  xl: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 12,
  },
};

// ===== BADGE / PILL STYLES =====

export const badges = {
  compliant: { backgroundColor: colors.successLight, color: colors.success },
  warning:   { backgroundColor: colors.warningLight, color: colors.warning },
  blocked:   { backgroundColor: colors.dangerLight,  color: colors.danger },
  info:      { backgroundColor: colors.infoLight,    color: colors.info },
  gold:      { backgroundColor: '#F5EDD3',           color: '#7A5F1A' },
  neutral:   { backgroundColor: '#EDE9E0',           color: colors.slate2 },
};

// ===== REACT NATIVE PAPER THEME =====

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:              colors.navy,
    onPrimary:            colors.white,
    primaryContainer:     colors.navy2,
    onPrimaryContainer:   colors.gold3,
    secondary:            colors.gold,
    onSecondary:          colors.navy,
    secondaryContainer:   colors.gold3,
    onSecondaryContainer: colors.navy,
    tertiary:             colors.slate,
    onTertiary:           colors.white,
    background:           colors.warm,
    onBackground:         colors.navy,
    surface:              colors.cream,
    onSurface:            colors.navy,
    surfaceVariant:       '#EDE9E0',
    onSurfaceVariant:     colors.slate2,
    outline:              colors.border,
    outlineVariant:       colors.borderLight,
    error:                colors.danger,
    onError:              colors.white,
    errorContainer:       colors.dangerLight,
    onErrorContainer:     colors.danger,
    inverseSurface:       colors.navy,
    inverseOnSurface:     colors.warm,
    inversePrimary:       colors.gold,
    elevation: {
      level0: 'transparent',
      level1: colors.cream,
      level2: '#F5F2EC',
      level3: '#F0EDE5',
      level4: '#EDE9E0',
      level5: '#E8E4DC',
    },
  },
  fonts: MD3LightTheme.fonts,
};
