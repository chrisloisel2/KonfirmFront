import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, StatusBar } from 'react-native';
import { colors } from '../../shared/theme/theme';

export default function SplashScreen() {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Logo mark */}
        <View style={styles.logoMark}>
          <View style={styles.logoInner}>
            <View style={styles.logoBar} />
            <View style={[styles.logoBar, styles.logoBarShort]} />
            <View style={styles.logoBar} />
          </View>
        </View>

        <Animated.Text style={[styles.brand, { opacity: fadeAnim }]}>KONFIRM</Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: fadeAnim }]}>
          Conformité LCB-FT
        </Animated.Text>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dotRow}>
          {[0, 1, 2].map(i => <DotLoader key={i} delay={i * 200} />)}
        </View>
        <Animated.Text style={[styles.loadingText, { opacity: fadeAnim }]}>
          Initialisation sécurisée…
        </Animated.Text>
      </View>

      <Animated.Text style={[styles.version, { opacity: fadeAnim }]}>v1.0.0</Animated.Text>
    </View>
  );
}

function DotLoader({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[styles.dot, { opacity: anim }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    alignItems: 'center',
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoInner: {
    gap: 5,
    alignItems: 'flex-start',
  },
  logoBar: {
    width: 32,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  logoBarShort: {
    width: 20,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
    gap: 12,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  version: {
    position: 'absolute',
    bottom: 32,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
});
