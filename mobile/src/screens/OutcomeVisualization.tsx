/**
 * Outcome — before/after from live agent run + summary.md. No mock defaults.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import GlassCard from '../components/GlassCard';
import ReasonMarkdownPanel from '../components/ReasonMarkdownPanel';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

export interface ShipmentState {
  shipmentId: string;
  cargo: string;
  route: string;
  destination: string;
  status: string;
  temp: string;
}

interface Props {
  beforeState?: ShipmentState;
  afterState?: ShipmentState;
  pipelineComplete?: boolean;
  summaryMarkdown?: string | null;
  summaryFile?: string;
  onRefreshSummary?: () => void;
}

export default function OutcomeVisualization({
  beforeState,
  afterState,
  pipelineComplete,
  summaryMarkdown,
  summaryFile,
  onRefreshSummary,
}: Props) {
  const [activeView, setActiveView] = useState<'before' | 'after'>('after');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pingAnim = useRef(new Animated.Value(1)).current;

  const hasData = Boolean(beforeState || afterState);
  const showAfter = Boolean(afterState);

  useEffect(() => {
    if (!showAfter) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim, { toValue: 2, duration: 800, useNativeDriver: true }),
        Animated.timing(pingAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [showAfter, pingAnim]);

  const toggleView = (view: 'before' | 'after') => {
    if (view === 'after' && !afterState) return;
    if (view === 'before' && !beforeState) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
      ]),
    ]).start();
    setActiveView(view);
  };

  if (!hasData && !summaryMarkdown) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Outcome</Text>
        <Text style={styles.subtitle}>Before / after fleet state from the agent run</Text>
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No outcome yet</Text>
          <Text style={styles.emptyBody}>
            Run the agent from the News tab. After a reroute completes, before and after shipment
            data appears here. Use Reset on News to clear and test again.
          </Text>
        </GlassCard>
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  }

  if (!hasData && summaryMarkdown) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Outcome</Text>
        <Text style={styles.subtitle}>Why the route changed</Text>
        <ReasonMarkdownPanel markdown={summaryMarkdown} fileName={summaryFile} />
        {onRefreshSummary ? (
          <TouchableOpacity onPress={onRefreshSummary} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>↻ Reload run summary (summary.md)</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  }

  const current =
    activeView === 'before' ? beforeState! : afterState || beforeState!;
  const isBefore = activeView === 'before' || !afterState;
  const shipmentLabel = current.shipmentId.replace('SHP-', '#');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Outcome</Text>
      <Text style={styles.subtitle}>
        {pipelineComplete ? 'Agent run complete' : 'Snapshot from last run'}
      </Text>

      {summaryMarkdown ? (
        <ReasonMarkdownPanel markdown={summaryMarkdown} fileName={summaryFile} defaultOpen />
      ) : null}

      <View style={styles.toggleCenter}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, isBefore && styles.toggleBtnActive, !beforeState && styles.toggleBtnDisabled]}
            onPress={() => toggleView('before')}
            disabled={!beforeState}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, isBefore && styles.toggleTextActive]}>Before</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              !isBefore && styles.toggleBtnActive,
              !afterState && styles.toggleBtnDisabled,
            ]}
            onPress={() => toggleView('after')}
            disabled={!afterState}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, !isBefore && styles.toggleTextActive]}>After</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.outcomeTitle}>Shipment {shipmentLabel}</Text>
        <Text style={styles.outcomeSubtitle}>{current.cargo}</Text>
      </View>

      <Animated.View
        style={[styles.canvasWrapper, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
      >
        <GlassCard
          style={[
            styles.canvas,
            isBefore ? { borderColor: `${Colors.outlineVariant}55` } : { borderColor: `${Colors.primary}30` },
          ]}
        >
          {isBefore ? (
            <View style={styles.banner}>
              <Text style={styles.bannerLabel}>Baseline (before agent)</Text>
            </View>
          ) : (
            <View style={[styles.banner, styles.bannerAfter]}>
              <Text style={styles.bannerLabelAfter}>After agent / route updated</Text>
              {showAfter ? (
                <Animated.View style={[styles.pingDot, { transform: [{ scale: pingAnim }] }]} />
              ) : null}
            </View>
          )}

          <View style={styles.stateGrid}>
            <StateRow label="Shipment" value={current.shipmentId} />
            <StateRow label="Cargo" value={current.cargo} />
            <StateRow label="Route" value={current.route} />
            <StateRow label="Destination" value={current.destination} />
            <StateRow
              label="Status"
              value={current.status}
              valueColor={/reroute/i.test(current.status) ? Colors.error : '#16a34a'}
            />
            {current.temp !== '—' ? <StateRow label="Temperature" value={current.temp} /> : null}
          </View>

          {!isBefore && /reroute/i.test(current.status) ? (
            <View style={styles.rerouteBanner}>
              <Text style={styles.rerouteIcon}>✓</Text>
              <View>
                <Text style={styles.rerouteTitle}>Emergency reroute applied</Text>
                <Text style={styles.rerouteDetail}>Route updated by orchestrator</Text>
              </View>
            </View>
          ) : null}
        </GlassCard>
      </Animated.View>

      {!afterState ? (
        <Text style={styles.waitingAfter}>
          “After” view appears when the agent updates the route or finishes analysis.
        </Text>
      ) : null}

      {!summaryMarkdown && onRefreshSummary ? (
        <TouchableOpacity onPress={onRefreshSummary} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Load run summary (summary.md)</Text>
        </TouchableOpacity>
      ) : null}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function StateRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.stateRow}>
      <Text style={styles.stateLabel}>{label}</Text>
      <Text style={[styles.stateValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },

  title: { ...Typography.headlineMD, color: Colors.onSurface },
  subtitle: { ...Typography.bodySM, color: Colors.onSurfaceVariant, marginBottom: Spacing.lg },

  emptyCard: { padding: Spacing.xl, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: { ...Typography.bodyMD, fontWeight: '700', color: Colors.onSurface, marginBottom: Spacing.sm },
  emptyBody: { ...Typography.bodySM, color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },

  toggleCenter: { alignItems: 'center', marginBottom: Spacing.lg },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  toggleBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: BorderRadius.sm },
  toggleBtnActive: { backgroundColor: Colors.primary },
  toggleBtnDisabled: { opacity: 0.4 },
  toggleText: { ...Typography.labelMD, color: Colors.onSurfaceVariant },
  toggleTextActive: { color: Colors.onPrimary },
  outcomeTitle: { ...Typography.headlineSM, color: Colors.onSurface, textAlign: 'center' },
  outcomeSubtitle: { ...Typography.bodySM, color: Colors.onSurfaceVariant, textAlign: 'center' },

  canvasWrapper: { marginBottom: Spacing.md },
  canvas: { padding: Spacing.lg, borderWidth: 1 },
  banner: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceContainerLow,
    marginBottom: Spacing.md,
  },
  bannerAfter: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.primary}15` },
  bannerLabel: { ...Typography.labelSM, color: Colors.outline },
  bannerLabelAfter: { ...Typography.labelSM, color: Colors.primary, fontWeight: '700' },
  pingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },

  stateGrid: { gap: Spacing.xs },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.outlineVariant}33`,
  },
  stateLabel: { ...Typography.labelMD, color: Colors.outline },
  stateValue: { ...Typography.bodySM, color: Colors.onSurface, fontWeight: '600', flex: 1, textAlign: 'right' },

  rerouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.primary}10`,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  rerouteIcon: { fontSize: 20, color: Colors.primary },
  rerouteTitle: { ...Typography.labelMD, color: Colors.primary },
  rerouteDetail: { ...Typography.bodySM, color: Colors.onSurfaceVariant },
  waitingAfter: {
    ...Typography.bodySM,
    color: Colors.outline,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: Spacing.lg,
  },
  refreshBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  refreshText: { ...Typography.labelMD, color: Colors.primary },
});
