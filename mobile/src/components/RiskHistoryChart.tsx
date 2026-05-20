/**
 * RiskHistoryChart.tsx
 * ====================
 * Custom SVG line chart showing per-shipment risk probability over time.
 * Built with react-native-svg — no third-party chart lib needed.
 *
 * - One line per shipment, color-coded by max risk level
 * - Animated draw on mount (SVG stroke-dashoffset)
 * - Interactive touch to highlight a data point
 * - Risk level legend and run labels on X axis
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../theme';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://localhost:8000',
    default: 'http://localhost:8000',
  });

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryEntry {
  run_id: number;
  timestamp: string;
  overall_fleet_risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  scorer_summary: string;
  shipments: {
    shipment_id: string;
    risk_level: string;
    risk_probability: number;
  }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH:     '#F97316',
  MEDIUM:   '#EAB308',
  LOW:      '#22C55E',
  SAFE:     '#3B82F6',
  UNKNOWN:  '#9CA3AF',
};

const SHIP_PALETTE = ['#7C3AED', '#0EA5E9', '#EC4899', '#10B981', '#F59E0B'];

const CHART_H = 200;
const CHART_PADDING = { top: 20, bottom: 36, left: 42, right: 16 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function riskToScore(level: string): number {
  const map: Record<string, number> = {
    CRITICAL: 1.0, HIGH: 0.78, MEDIUM: 0.52, LOW: 0.28, SAFE: 0.08,
  };
  return map[level] ?? 0.5;
}

/** Build an SVG path string from a list of [x, y] points (smooth cubic bezier) */
function buildPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
  /** Width of the chart container (pass from parent) */
  width?: number;
}

export default function RiskHistoryChart({ width: propWidth }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const screenW = Dimensions.get('window').width;
  const chartWidth = (propWidth ?? screenW) - 32; // 16px padding each side

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/predictions/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HistoryEntry[] = await res.json();
      setHistory(data);
      // Animate in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } catch (e: any) {
      setError(e.message || 'Failed to load history');
    }
    setLoading(false);
  }, [fadeAnim]);

  useEffect(() => { void load(); }, [load]);

  // ── Build chart geometry ────────────────────────────────────────────────────

  const innerW = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = CHART_H - CHART_PADDING.top - CHART_PADDING.bottom;
  const totalH = CHART_H;

  const runs = history;
  const nRuns = runs.length;

  // Collect unique shipment IDs across all runs
  const shipIds = Array.from(
    new Set(runs.flatMap((r) => r.shipments.map((s) => s.shipment_id)))
  ).slice(0, 5); // max 5 lines

  // X position for run index i
  const xFor = (i: number) =>
    CHART_PADDING.left + (nRuns <= 1 ? innerW / 2 : (i / (nRuns - 1)) * innerW);

  // Y position for probability p in [0, 1]
  const yFor = (p: number) =>
    CHART_PADDING.top + (1 - p) * innerH;

  // Y grid lines at 25%, 50%, 75%, 100%
  const gridLines = [0, 0.25, 0.5, 0.75, 1.0];

  const selectedEntry = selectedRun !== null ? runs[selectedRun] : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="small" color="#7C3AED" />
        <Text style={styles.loaderTxt}>Loading risk history…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
        <Text style={styles.errorTxt}>{error}</Text>
        <TouchableOpacity onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryTxt}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (runs.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="bar-chart-outline" size={28} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>No history yet</Text>
        <Text style={styles.emptyBody}>
          Run the Predictive Risk Agent at least once to see the chart.
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.wrap, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics-outline" size={16} color="#7C3AED" />
          <Text style={styles.headerTitle}>Risk Probability Trend</Text>
        </View>
        <TouchableOpacity onPress={load} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="refresh-outline" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>
      <Text style={styles.headerSub}>{runs.length} run{runs.length !== 1 ? 's' : ''} recorded</Text>

      {/* SVG Chart */}
      <View style={styles.chartBox}>
        <Svg width={chartWidth} height={totalH}>
          <Defs>
            {shipIds.map((id, i) => {
              const col = SHIP_PALETTE[i % SHIP_PALETTE.length];
              return (
                <LinearGradient key={id} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={col} stopOpacity="0.18" />
                  <Stop offset="1" stopColor={col} stopOpacity="0" />
                </LinearGradient>
              );
            })}
          </Defs>

          {/* Y-axis grid lines & labels */}
          {gridLines.map((p) => {
            const y = yFor(p);
            const label = p === 0 ? '0%' : `${Math.round(p * 100)}%`;
            return (
              <React.Fragment key={p}>
                <Line
                  x1={CHART_PADDING.left}
                  y1={y}
                  x2={chartWidth - CHART_PADDING.right}
                  y2={y}
                  stroke={p === 0 ? '#D1D5DB' : '#F3F4F6'}
                  strokeWidth={p === 0 ? 1 : 1}
                  strokeDasharray={p === 0 ? '' : '4 4'}
                />
                <SvgText
                  x={CHART_PADDING.left - 6}
                  y={y + 4}
                  fontSize={9}
                  fill="#9CA3AF"
                  textAnchor="end"
                  fontFamily="System"
                >
                  {label}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* X-axis labels (run time) */}
          {runs.map((r, i) => (
            <SvgText
              key={r.run_id}
              x={xFor(i)}
              y={totalH - 4}
              fontSize={8}
              fill="#9CA3AF"
              textAnchor="middle"
              fontFamily="System"
            >
              {formatTime(r.timestamp)}
            </SvgText>
          ))}

          {/* Lines + area fills per shipment */}
          {shipIds.map((id, si) => {
            const col = SHIP_PALETTE[si % SHIP_PALETTE.length];
            const points: [number, number][] = runs.map((r, i) => {
              const s = r.shipments.find((s) => s.shipment_id === id);
              const prob = s
                ? (s.risk_probability > 0 ? s.risk_probability : riskToScore(s.risk_level))
                : 0;
              return [xFor(i), yFor(prob)];
            });
            if (points.length < 1) return null;
            const pathD = buildPath(points);
            // Area fill path: close down to baseline
            const areaD =
              pathD +
              ` L ${points[points.length - 1][0]} ${yFor(0)}` +
              ` L ${points[0][0]} ${yFor(0)} Z`;

            return (
              <React.Fragment key={id}>
                {/* Area fill */}
                <Path d={areaD} fill={`url(#grad-${si})`} />
                {/* Line */}
                <Path d={pathD} stroke={col} strokeWidth={2} fill="none" />
                {/* Dots */}
                {points.map(([px, py], i) => (
                  <Circle
                    key={i}
                    cx={px}
                    cy={py}
                    r={selectedRun === i ? 6 : 4}
                    fill={selectedRun === i ? col : '#FFF'}
                    stroke={col}
                    strokeWidth={2}
                    onPress={() => setSelectedRun(selectedRun === i ? null : i)}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {/* Selected run vertical line */}
          {selectedRun !== null && (
            <Line
              x1={xFor(selectedRun)}
              y1={CHART_PADDING.top}
              x2={xFor(selectedRun)}
              y2={yFor(0)}
              stroke="#7C3AED"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}
        </Svg>
      </View>

      {/* Shipment legend */}
      <View style={styles.legend}>
        {shipIds.map((id, i) => (
          <View key={id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: SHIP_PALETTE[i % SHIP_PALETTE.length] }]} />
            <Text style={styles.legendTxt}>{id}</Text>
          </View>
        ))}
      </View>

      {/* Selected run detail panel */}
      {selectedEntry && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={[
              styles.riskBadge,
              { backgroundColor: `${RISK_COLOR[selectedEntry.overall_fleet_risk] ?? '#9CA3AF'}20` },
            ]}>
              <Text style={[
                styles.riskBadgeTxt,
                { color: RISK_COLOR[selectedEntry.overall_fleet_risk] ?? '#6B7280' },
              ]}>
                {selectedEntry.overall_fleet_risk}
              </Text>
            </View>
            <Text style={styles.detailRunId}>Run #{selectedEntry.run_id}</Text>
            <Text style={styles.detailTime}>{formatTime(selectedEntry.timestamp)}</Text>
          </View>
          <Text style={styles.detailSummary} numberOfLines={3}>
            {selectedEntry.scorer_summary}
          </Text>
          <View style={styles.detailShips}>
            {selectedEntry.shipments.map((s) => (
              <View key={s.shipment_id} style={styles.detailShip}>
                <View style={[
                  styles.detailDot,
                  { backgroundColor: RISK_COLOR[s.risk_level] ?? '#9CA3AF' },
                ]} />
                <Text style={styles.detailShipId}>{s.shipment_id}</Text>
                <Text style={styles.detailShipRisk}>{s.risk_level}</Text>
                <Text style={styles.detailShipProb}>
                  {Math.round(
                    (s.risk_probability > 0 ? s.risk_probability : riskToScore(s.risk_level)) * 100
                  )}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },

  loader: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  loaderTxt: { fontFamily: FontFamily.regular, fontSize: 13, color: '#9CA3AF' },

  errorBox: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  errorTxt: { fontFamily: FontFamily.regular, fontSize: 13, color: '#EF4444', textAlign: 'center' },
  retryBtn: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  retryTxt: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#DC2626' },

  emptyBox: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#374151' },
  emptyBody: { fontFamily: FontFamily.regular, fontSize: 13, color: '#9CA3AF', textAlign: 'center', maxWidth: 260 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#111827' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: 12, color: '#9CA3AF', marginBottom: 10 },

  chartBox: { backgroundColor: '#FAFAFA', borderRadius: 12, overflow: 'hidden', marginBottom: 10 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontFamily: FontFamily.regular, fontSize: 11, color: '#6B7280' },

  detailCard: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, padding: 12, gap: 8,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  riskBadgeTxt: { fontFamily: FontFamily.semiBold, fontSize: 11 },
  detailRunId: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#374151', flex: 1 },
  detailTime: { fontFamily: FontFamily.regular, fontSize: 12, color: '#9CA3AF' },
  detailSummary: { fontFamily: FontFamily.regular, fontSize: 13, color: '#4B5563', lineHeight: 18 },
  detailShips: { gap: 6 },
  detailShip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailDot: { width: 8, height: 8, borderRadius: 4 },
  detailShipId: { fontFamily: FontFamily.semiBold, fontSize: 12, color: '#374151', flex: 1 },
  detailShipRisk: { fontFamily: FontFamily.medium, fontSize: 12, color: '#6B7280' },
  detailShipProb: { fontFamily: FontFamily.semiBold, fontSize: 12, color: '#7C3AED', minWidth: 36, textAlign: 'right' },
});
