import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../../../shared/theme/theme';
import { STATUS_META } from './helpers';
import { st } from './styles';

// ── SVG geometry helpers ───────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcStroke(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const span = endDeg - startDeg;
  if (Math.abs(span) < 0.1) return '';
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = span > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)},${s.y.toFixed(2)} A${r},${r},0,${large},1,${e.x.toFixed(2)},${e.y.toFixed(2)}`;
}

function arcSegment(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number): string {
  const span = endDeg - startDeg;
  if (span <= 0.1) return '';
  const gap = span > 8 ? 2 : 0;
  const s = startDeg + gap;
  const e = endDeg - gap;
  const o1 = polar(cx, cy, outerR, s);
  const o2 = polar(cx, cy, outerR, e);
  const i1 = polar(cx, cy, innerR, e);
  const i2 = polar(cx, cy, innerR, s);
  const large = (e - s) > 180 ? 1 : 0;
  return `M${o1.x.toFixed(2)},${o1.y.toFixed(2)} A${outerR},${outerR},0,${large},1,${o2.x.toFixed(2)},${o2.y.toFixed(2)} L${i1.x.toFixed(2)},${i1.y.toFixed(2)} A${innerR},${innerR},0,${large},0,${i2.x.toFixed(2)},${i2.y.toFixed(2)} Z`;
}

// ── AnimatedCounter ────────────────────────────────────────────────────────────

export function AnimatedCounter({
  toValue,
  style,
  formatter,
}: {
  toValue: number;
  style?: any;
  formatter?: (n: number) => string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    return () => anim.removeListener(id);
  }, [toValue]);

  return <Text style={style}>{formatter ? formatter(display) : String(display)}</Text>;
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

export function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const m = STATUS_META[status] ?? { label: status, color: colors.textSecondary, bg: colors.borderLight };
  return (
    <View style={[st.badge, { backgroundColor: m.bg }, compact && { paddingHorizontal: 8, paddingVertical: 3 }]}>
      <View style={[st.badgeDot, { backgroundColor: m.color }]} />
      <Text style={[st.badgeText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

// ── KpiCard ── (rôles non-manager) ────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  icon,
  accent,
  formatter,
  note,
  alertThreshold,
}: {
  label: string;
  value: number;
  icon: string;
  accent: string;
  formatter?: (n: number) => string;
  note?: string;
  alertThreshold?: number;
}) {
  const isAlert = alertThreshold !== undefined && value >= alertThreshold;
  const effectiveColor = isAlert ? '#DC2626' : accent;

  return (
    <View style={[st.kpiCard, { borderTopColor: effectiveColor }]}>
      <View style={st.kpiCardTop}>
        <Text style={st.kpiLabel} numberOfLines={2}>{label}</Text>
        <View style={[st.kpiIconWrap, { backgroundColor: effectiveColor + '18' }]}>
          <MaterialIcons name={icon as any} size={15} color={effectiveColor} />
          {isAlert && <View style={st.kpiAlertPip} />}
        </View>
      </View>
      <AnimatedCounter toValue={value} style={[st.kpiValue, { color: effectiveColor }]} formatter={formatter} />
      <View style={st.kpiFooterRow}>
        <View style={[st.kpiStatusDot, { backgroundColor: isAlert ? '#DC2626' : '#16A34A' }]} />
        <Text style={[st.kpiNote, { color: isAlert ? '#DC2626' : '#6B7280' }]}>
          {note ?? (isAlert ? 'Requiert attention' : 'Normal')}
        </Text>
      </View>
    </View>
  );
}

// ── KpiGaugeArc ── (taux de validation — arc pleine largeur) ──────────────────

const GAUGE_START = 215;
const GAUGE_SPAN = 250;

export function KpiGaugeArc({ value }: { value: number }) {
  const [w, setW] = useState(0);
  const H = 170;
  const accent = value >= 80 ? '#22C55E' : value >= 60 ? '#F59E0B' : '#EF4444';
  const cx = w / 2;
  const cy = H * 0.62;
  const r = w > 0 ? Math.min(w * 0.34, H * 0.44) : 0;
  const sw = 18;
  const filled = (value / 100) * GAUGE_SPAN;

  return (
    <View style={st.kpiChartCard} onLayout={e => setW(Math.floor(e.nativeEvent.layout.width))}>
      <Text style={st.kpiChartTitle}>Taux de validation</Text>
      {w > 0 && (
        <Svg width={w} height={H}>
          <Path
            d={arcStroke(cx, cy, r, GAUGE_START, GAUGE_START + GAUGE_SPAN)}
            stroke="#E5E7EB" strokeWidth={sw} fill="none" strokeLinecap="round"
          />
          {value > 0 && (
            <Path
              d={arcStroke(cx, cy, r, GAUGE_START, GAUGE_START + filled)}
              stroke={accent} strokeWidth={sw} fill="none" strokeLinecap="round"
            />
          )}
          <SvgText x={cx} y={cy - 2} textAnchor="middle" fontSize={32} fontWeight="bold" fill={accent}>
            {value}%
          </SvgText>
          <SvgText x={cx} y={cy + 20} textAnchor="middle" fontSize={11} fill="#9CA3AF">
            Taux de validation
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

// ── KpiDonutDossiers ── (répartition des dossiers du jour) ────────────────────

export function KpiDonutDossiers({
  total,
  pending,
  exceptions,
}: {
  total: number;
  pending: number;
  exceptions: number;
}) {
  const [w, setW] = useState(0);
  const H = 150;
  const validated = Math.max(0, total - pending - exceptions);

  const segments = total > 0
    ? [
        { value: validated, name: 'Validés',    color: '#22C55E' },
        { value: pending,   name: 'En attente', color: '#3B82F6' },
        { value: exceptions, name: 'Exceptions', color: '#EF4444' },
      ].filter(d => d.value > 0)
    : [{ value: 1, name: 'Aucun dossier', color: '#E5E7EB' }];

  const totalVal = segments.reduce((s, d) => s + d.value, 0);
  const svgW = w * 0.52;
  const svgH = H - 32;
  const cx = svgW / 2;
  const cy = svgH / 2;
  const outerR = Math.min(svgW, svgH) * 0.42;
  const innerR = outerR * 0.6;

  let angle = 0;
  const arcs = segments.map(d => {
    const start = angle;
    const span = (d.value / totalVal) * 360;
    angle += span;
    return { ...d, start, end: angle };
  });

  return (
    <View
      style={[st.kpiChartCard, { flex: 1 }]}
      onLayout={e => setW(Math.floor(e.nativeEvent.layout.width))}
    >
      <Text style={st.kpiChartTitle}>Dossiers du jour</Text>
      {w > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Svg width={svgW} height={svgH}>
            {total === 0 ? (
              <Circle
                cx={cx} cy={cy}
                r={(outerR + innerR) / 2}
                stroke="#E5E7EB" strokeWidth={outerR - innerR} fill="none"
              />
            ) : (
              arcs.map((s, i) => (
                <Path key={i} d={arcSegment(cx, cy, innerR, outerR, s.start, s.end)} fill={s.color} />
              ))
            )}
            <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={17} fontWeight="bold" fill={colors.textPrimary}>
              {total}
            </SvgText>
            <SvgText x={cx} y={cy + 19} textAnchor="middle" fontSize={9} fill="#9CA3AF">
              dossiers
            </SvgText>
          </Svg>
          <View style={{ flex: 1, gap: 10, paddingLeft: 8 }}>
            {total > 0 && segments.filter(s => s.name !== 'Aucun dossier').map(s => (
              <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.color }} />
                <Text style={{ fontSize: 9.5, color: colors.textSecondary, flex: 1 }}>{s.name}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: s.color }}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ── KpiAlertGauges ── (exceptions + scoring — deux mini-jauges) ───────────────

export function KpiAlertGauges({
  exceptions,
  scoring,
}: {
  exceptions: number;
  scoring: number;
}) {
  const [w, setW] = useState(0);
  const svgH = 118;
  const excColor = exceptions >= 1 ? '#EF4444' : '#22C55E';
  const scoreColor = scoring >= 5 ? '#EF4444' : '#7C3AED';
  const excMax = Math.max(exceptions * 2, 6);
  const scoreMax = Math.max(scoring * 2, 10);
  const excPct = Math.min(exceptions / excMax, 1);
  const scorePct = Math.min(scoring / scoreMax, 1);
  const halfW = w / 2;
  const r = w > 0 ? Math.min(halfW * 0.38, svgH * 0.38) : 0;
  const cy = svgH * 0.55;
  const sw = 9;

  return (
    <View
      style={[st.kpiChartCard, { flex: 1 }]}
      onLayout={e => setW(Math.floor(e.nativeEvent.layout.width))}
    >
      <Text style={st.kpiChartTitle}>Alertes</Text>
      {w > 0 && (
        <Svg width={w} height={svgH}>
          {/* Exceptions */}
          <Path
            d={arcStroke(halfW * 0.5, cy, r, GAUGE_START, GAUGE_START + GAUGE_SPAN)}
            stroke="#E5E7EB" strokeWidth={sw} fill="none" strokeLinecap="round"
          />
          {excPct > 0 && (
            <Path
              d={arcStroke(halfW * 0.5, cy, r, GAUGE_START, GAUGE_START + excPct * GAUGE_SPAN)}
              stroke={excColor} strokeWidth={sw} fill="none" strokeLinecap="round"
            />
          )}
          <SvgText x={halfW * 0.5} y={cy - 1} textAnchor="middle" fontSize={21} fontWeight="bold" fill={excColor}>
            {exceptions}
          </SvgText>
          <SvgText x={halfW * 0.5} y={cy + 16} textAnchor="middle" fontSize={8.5} fill="#9CA3AF">
            Exceptions
          </SvgText>

          {/* Scoring critique */}
          <Path
            d={arcStroke(halfW * 1.5, cy, r, GAUGE_START, GAUGE_START + GAUGE_SPAN)}
            stroke="#E5E7EB" strokeWidth={sw} fill="none" strokeLinecap="round"
          />
          {scorePct > 0 && (
            <Path
              d={arcStroke(halfW * 1.5, cy, r, GAUGE_START, GAUGE_START + scorePct * GAUGE_SPAN)}
              stroke={scoreColor} strokeWidth={sw} fill="none" strokeLinecap="round"
            />
          )}
          <SvgText x={halfW * 1.5} y={cy - 1} textAnchor="middle" fontSize={21} fontWeight="bold" fill={scoreColor}>
            {scoring}
          </SvgText>
          <SvgText x={halfW * 1.5} y={cy + 16} textAnchor="middle" fontSize={8.5} fill="#9CA3AF">
            Scoring crit.
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

// ── DonutChart ── (admin — abonnements / clés) ────────────────────────────────

export function DonutChart({
  data,
  width,
  height,
  centerLabel,
}: {
  data: Array<{ value: number; name: string; color: string }>;
  width: number;
  height: number;
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(width, height) * 0.38;
  const innerR = outerR * 0.62;

  let angle = 0;
  const arcs = data.map(d => {
    const start = angle;
    const span = total > 0 ? (d.value / total) * 360 : 0;
    angle += span;
    return { ...d, start, end: angle };
  });

  const lines = centerLabel ? centerLabel.split('\n') : [];

  return (
    <Svg width={width} height={height}>
      {total === 0 ? (
        <Circle cx={cx} cy={cy} r={(outerR + innerR) / 2} stroke="#E5E7EB" strokeWidth={outerR - innerR} fill="none" />
      ) : (
        arcs.map((s, i) => (
          <Path key={i} d={arcSegment(cx, cy, innerR, outerR, s.start, s.end)} fill={s.color} />
        ))
      )}
      {lines.map((line, i) => (
        <SvgText
          key={i}
          x={cx}
          y={cy + (i - (lines.length - 1) / 2) * 16 + 4}
          textAnchor="middle"
          fontSize={i === 0 ? 13 : 10}
          fontWeight={i === 0 ? 'bold' : 'normal'}
          fill={i === 0 ? colors.textPrimary : '#9CA3AF'}
        >
          {line}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── GaugeMRR ── (admin — revenus récurrents) ──────────────────────────────────

export function GaugeMRR({ mrr, width, height }: { mrr: number; width: number; height: number }) {
  const mrrEuros = mrr / 100;
  const maxEuros = Math.max(mrrEuros * 1.6, 500);
  const pct = Math.min(mrrEuros / maxEuros, 1);
  const cx = width / 2;
  const cy = height * 0.6;
  const r = Math.min(width * 0.36, height * 0.44);
  const sw = 13;
  const fillColor = pct < 0.33 ? '#1A6B50' : pct < 0.66 ? colors.gold : '#8B1C1C';
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(mrrEuros);

  return (
    <Svg width={width} height={height}>
      <Path
        d={arcStroke(cx, cy, r, GAUGE_START, GAUGE_START + GAUGE_SPAN)}
        stroke="#E5E7EB" strokeWidth={sw} fill="none" strokeLinecap="round"
      />
      {pct > 0 && (
        <Path
          d={arcStroke(cx, cy, r, GAUGE_START, GAUGE_START + pct * GAUGE_SPAN)}
          stroke={fillColor} strokeWidth={sw} fill="none" strokeLinecap="round"
        />
      )}
      <SvgText x={cx} y={cy + 6} textAnchor="middle" fontSize={15} fontWeight="bold" fill={colors.textPrimary}>
        {formatted}
      </SvgText>
    </Svg>
  );
}

// ── ShortcutTile ───────────────────────────────────────────────────────────────

export function ShortcutTile({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }], width: '31%' }}>
      <TouchableOpacity style={st.shortcutTile} onPress={press} activeOpacity={1}>
        <View style={[st.shortcutIcon, { backgroundColor: color + '15' }]}>
          <MaterialIcons name={icon as any} size={22} color={color} />
        </View>
        <Text style={st.shortcutLabel} numberOfLines={2}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── HeroStat ───────────────────────────────────────────────────────────────────

export function HeroStat({
  label,
  value,
  icon,
  index,
}: {
  label: string;
  value: string;
  icon: string;
  index: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: index * 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay: index * 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[st.heroStat, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <MaterialIcons name={icon as any} size={16} color={colors.gold3} />
      <Text style={st.heroStatValue}>{value}</Text>
      <Text style={st.heroStatLabel}>{label}</Text>
    </Animated.View>
  );
}

// ── SectionRow ─────────────────────────────────────────────────────────────────

export function SectionRow({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={st.sectionRow}>
      <View style={st.sectionTitleLine} />
      <Text style={st.sectionTitle}>{title}</Text>
      {right && <View style={{ marginLeft: 'auto' }}>{right}</View>}
    </View>
  );
}

// ── ActionBtn ──────────────────────────────────────────────────────────────────

export function ActionBtn({
  label,
  icon,
  color,
  disabled,
  onPress,
}: {
  label: string;
  icon: any;
  color: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[st.actionBtn, { borderColor: color + '40', backgroundColor: color + '0D' }, disabled && { opacity: 0.4 }]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <MaterialIcons name={icon} size={14} color={color} />
      <Text style={[st.actionBtnLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

export function EmptyState({ text, icon = 'inventory-2' }: { text: string; icon?: string }) {
  return (
    <View style={st.emptyState}>
      <MaterialIcons name={icon as any} size={28} color={colors.borderLight} />
      <Text style={st.emptyText}>{text}</Text>
    </View>
  );
}

// ── InfoRow ────────────────────────────────────────────────────────────────────

export function InfoRow({ k, v, last = false }: { k: string; v: string; last?: boolean }) {
  return (
    <View style={[st.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={st.infoKey}>{k}</Text>
      <Text style={st.infoVal}>{v}</Text>
    </View>
  );
}
