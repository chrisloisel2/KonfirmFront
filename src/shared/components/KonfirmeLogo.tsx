import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, TextPath, Defs } from 'react-native-svg';

type LogoVariant = 'default' | 'compact' | 'seal';
type LogoTheme = 'dark' | 'light' | 'monochrome-dark' | 'monochrome-light';

interface KonfirmeLogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: number;
  withTagline?: boolean;
}

function getColors(theme: LogoTheme) {
  switch (theme) {
    case 'light':
      return { wordmark: '#FAF8F3', accent: '#BFA063', tagline: '#8FA5BA' };
    case 'monochrome-dark':
      return { wordmark: '#FFFFFF', accent: '#FFFFFF', tagline: '#E8E4DC' };
    case 'monochrome-light':
      return { wordmark: '#0A1628', accent: '#0A1628', tagline: '#2C3E55' };
    default:
      return { wordmark: '#0A1628', accent: '#BFA063', tagline: '#4A5E74' };
  }
}

export function KonfirmeLogo({
  variant = 'default',
  theme = 'dark',
  size = 40,
  withTagline = true,
}: KonfirmeLogoProps) {
  const c = getColors(theme);

  if (variant === 'compact') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M2 20L20 2L38 20L20 38L2 20Z" stroke={c.accent} strokeWidth={1.2} fill="none" />
        <SvgText
          x="20"
          y="26"
          textAnchor="middle"
          fontSize={24}
          fontWeight="400"
          fill={c.wordmark}
        >
          K
        </SvgText>
      </Svg>
    );
  }

  if (variant === 'seal') {
    const r = size / 2;
    return (
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx={60} cy={60} r={58} stroke={c.accent} strokeWidth={1.5} fill="none" />
        <SvgText x={60} y={72} textAnchor="middle" fontSize={48} fontWeight="400" fill={c.wordmark}>
          K
        </SvgText>
        <Path d="M60 10L62 14L60 18L58 14Z" fill={c.accent} />
        <Path d="M110 60L106 62L102 60L106 58Z" fill={c.accent} />
        <Path d="M60 110L58 106L60 102L62 106Z" fill={c.accent} />
        <Path d="M10 60L14 58L18 60L14 62Z" fill={c.accent} />
      </Svg>
    );
  }

  // default: wordmark
  return (
    <View style={styles.container}>
      <View style={styles.wordmark}>
        <Text style={[styles.letterK, { color: c.accent }]}>K</Text>
        <Text style={[styles.letterRest, { color: c.wordmark }]}>onfirme</Text>
      </View>
      {withTagline && (
        <>
          <View style={[styles.separator, { backgroundColor: c.accent }]} />
          <Text style={[styles.tagline, { color: c.tagline }]}>COMPLIANCE INTELLIGENCE</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  letterK: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: 5,
    fontFamily: 'LibreBaskerville-Regular',
  },
  letterRest: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: 5,
    fontFamily: 'LibreBaskerville-Regular',
  },
  separator: {
    width: '100%',
    height: 0.5,
    marginVertical: 4,
  },
  tagline: {
    fontSize: 8,
    fontWeight: '300',
    letterSpacing: 4,
    fontFamily: 'Outfit-Light',
  },
});
