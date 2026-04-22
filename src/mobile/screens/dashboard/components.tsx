import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { SvgChart, SVGRenderer } from '@wuba/react-native-echarts';
import * as echarts from 'echarts/core';
import { PieChart as EPieChart, GaugeChart as EGaugeChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { colors } from '../../../shared/theme/theme';
import { STATUS_META } from './helpers';
import { st } from './styles';

echarts.use([SVGRenderer, EPieChart, EGaugeChart, TooltipComponent, LegendComponent]);

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

// ── KpiCard ────────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  icon,
  accent,
  formatter,
}: {
  label: string;
  value: number;
  icon: string;
  accent: string;
  formatter?: (n: number) => string;
}) {
  return (
    <View style={[st.kpiCard, { borderLeftColor: accent }]}>
      <View style={[st.kpiIconWrap, { backgroundColor: accent + '18' }]}>
        <MaterialIcons name={icon as any} size={18} color={accent} />
      </View>
      <AnimatedCounter toValue={value} style={[st.kpiValue, { color: accent }]} formatter={formatter} />
      <Text style={st.kpiLabel}>{label}</Text>
    </View>
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

// ── DonutChart ─────────────────────────────────────────────────────────────────

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
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let chart: any;
    if (chartRef.current) {
      chart = echarts.init(chartRef.current, undefined, { renderer: 'svg', width, height });
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { show: false },
        graphic: centerLabel ? [{
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: centerLabel,
            textAlign: 'center',
            fill: colors.textPrimary,
            font: 'bold 13px sans-serif',
          },
        }] : undefined,
        series: [{
          type: 'pie',
          radius: ['52%', '78%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: colors.warm, borderWidth: 2 },
          label: { show: false },
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } },
          labelLine: { show: false },
          data: data.map(d => ({ value: d.value, name: d.name, itemStyle: { color: d.color } })),
          animationType: 'expansion',
          animationEasing: 'cubicOut',
          animationDuration: 900,
        }],
      });
    }
    return () => chart?.dispose();
  }, [JSON.stringify(data), width, height]);

  return <SvgChart ref={chartRef} />;
}

// ── GaugeMRR ───────────────────────────────────────────────────────────────────

export function GaugeMRR({ mrr, width, height }: { mrr: number; width: number; height: number }) {
  const chartRef = useRef<any>(null);
  const mrrEuros = mrr / 100;
  const maxEuros = Math.max(mrrEuros * 1.6, 500);

  useEffect(() => {
    let chart: any;
    if (chartRef.current) {
      chart = echarts.init(chartRef.current, undefined, { renderer: 'svg', width, height });
      chart.setOption({
        backgroundColor: 'transparent',
        series: [{
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: maxEuros,
          radius: '88%',
          center: ['50%', '58%'],
          axisLine: {
            lineStyle: {
              width: 14,
              color: [[0.33, '#1A6B50'], [0.66, colors.gold], [1, '#8B1C1C']],
            },
          },
          pointer: { length: '55%', width: 5, itemStyle: { color: colors.navy } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          detail: {
            show: true,
            valueAnimation: true,
            offsetCenter: [0, '20%'],
            fontSize: 15,
            fontWeight: 'bold',
            color: colors.textPrimary,
            formatter: (v: number) =>
              new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v),
          },
          data: [{ value: mrrEuros }],
          animationEasing: 'bounceOut',
          animationDuration: 1200,
        }],
      });
    }
    return () => chart?.dispose();
  }, [mrr, width, height]);

  return <SvgChart ref={chartRef} />;
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
