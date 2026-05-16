/**
 * Screen 2: AI Decision Engine
 * BioRoute Cold-Chain — Agentic workflow stepper & terminal logs
 * Matches Stitch design: AI Decision Engine
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import GlassCard from '../components/GlassCard';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

export interface AgentStep {
  id: number;
  title: string;
  status: 'done' | 'active' | 'pending' | 'error';
  detail: string;
  icon: string;
  timestamp?: string;
  badge?: string;
  badgeColor?: string;
}

export interface TerminalLog {
  time: string;
  message: string;
  level: 'info' | 'error' | 'success';
}

interface Props {
  steps?: AgentStep[];
  logs?: TerminalLog[];
  isRunning?: boolean;
  confidencePercent?: number;
}

const DEFAULT_STEPS: AgentStep[] = [
  {
    id: 1,
    title: 'Hazard Detection',
    status: 'error',
    icon: '⚠️',
    badge: 'CRITICAL',
    badgeColor: Colors.error,
    detail: 'Traffic + 42°C heatwave detected in District 4.\nLocation: Highway 9 (KM 142) | Environment: Heatwave 42°C',
    timestamp: '10:32:11',
  },
  {
    id: 2,
    title: 'Impact Analysis',
    status: 'active',
    icon: '📊',
    detail: 'Shipment #882 cooling unit failure predicted.\nTime to critical: 45:00 min | Financial risk: $50,000',
    timestamp: '10:32:13',
  },
  {
    id: 3,
    title: 'AI Rescue Plan Generated',
    status: 'pending',
    icon: '🤖',
    detail: 'Reroute via District 3 (Bio-Corridor)\nPriority transit: +12% speed elevation',
    timestamp: '10:32:15',
  },
  {
    id: 4,
    title: 'Execution Phase',
    status: 'pending',
    icon: '⚙️',
    detail: 'Fleet Commands Sent ✓\nReroute Protocol Acknowledged ✓\nDeploying Active Cooling Patch...',
    timestamp: '10:32:18',
  },
];

const DEFAULT_LOGS: TerminalLog[] = [
  { time: '10:32:11', message: 'Hazard detected Highway 9, KM 142. Thermal variance: +14°C.', level: 'info' },
  { time: '10:32:12', message: 'Initiating Shipment #882 health scan...', level: 'info' },
  { time: '10:32:13', message: 'Critical alert: Prediction model estimates thermal breach in T-45m.', level: 'error' },
  { time: '10:32:14', message: 'AI Engine generating 4,200 reroute simulations...', level: 'info' },
  { time: '10:32:15', message: 'Optimal path found: District 3 Corridor selected.', level: 'success' },
  { time: '10:32:16', message: 'Syncing fleet navigation via mesh-network.', level: 'info' },
  { time: '10:32:18', message: 'Vehicle 882-Alpha confirmed reroute command.', level: 'info' },
];

function StepIcon({ status, icon }: { status: AgentStep['status']; icon: string }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'error') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 10, duration: 1000, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [status]);

  const bgColor = {
    done: Colors.primary,
    active: Colors.surfaceContainerHighest,
    pending: Colors.surfaceContainerHigh,
    error: Colors.errorContainer,
  }[status];

  const borderColor = {
    done: Colors.primary,
    active: Colors.primary,
    pending: Colors.outlineVariant,
    error: Colors.error,
  }[status];

  return (
    <View style={[styles.stepIconWrap, { backgroundColor: bgColor, borderColor }]}>
      <Text style={styles.stepIconEmoji}>{icon}</Text>
    </View>
  );
}

export default function AIDecisionEngine({
  steps = DEFAULT_STEPS,
  logs = DEFAULT_LOGS,
  isRunning = false,
  confidencePercent = 97.2,
}: Props) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [syncPct] = useState(84);

  useEffect(() => {
    // Rotating sync icon
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Progress bar
    Animated.timing(progressAnim, {
      toValue: confidencePercent / 100,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [confidencePercent]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const logColor = (level: TerminalLog['level']) => {
    if (level === 'error') return Colors.error;
    if (level === 'success') return '#4ade80';
    return '#adc6ff';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>BioRoute</Text>
        <Text style={styles.bellIcon}>🔔</Text>
      </View>

      {/* Hero Confidence Card */}
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.coreLabel}>CORE INTELLIGENCE</Text>
            <Text style={styles.heroTitle}>AI Decision Engine</Text>
          </View>
          <View style={styles.heroRight}>
            <View style={styles.autonomousBadge}>
              <View style={styles.autonomousDot} />
              <Text style={styles.autonomousText}>Autonomous Response Active</Text>
            </View>
            <View style={styles.confidenceBox}>
              <Text style={styles.confidenceLabel}>CONFIDENCE</Text>
              <Text style={styles.confidenceValue}>{confidencePercent}%</Text>
            </View>
          </View>
        </View>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth as any }]} />
        </View>
      </GlassCard>

      {/* Vertical workflow steps */}
      <View style={styles.stepsContainer}>
        {/* Connecting line */}
        <View style={styles.connectingLine} />

        {steps.map((step, index) => (
          <View key={step.id} style={styles.stepRow}>
            <StepIcon status={step.status} icon={step.icon} />
            <View style={styles.stepContent}>
              <GlassCard
                style={styles.stepCard}
                borderLeftColor={
                  step.status === 'error' ? Colors.error :
                  step.status === 'done' ? Colors.primary : undefined
                }
              >
                <View style={styles.stepHeader}>
                  <Text style={[
                    styles.stepTitle,
                    step.status === 'pending' && { color: Colors.onSurfaceVariant }
                  ]}>
                    {step.title}
                  </Text>
                  {step.badge && (
                    <View style={[styles.stepBadge, { backgroundColor: `${step.badgeColor}18` }]}>
                      <Text style={[styles.stepBadgeText, { color: step.badgeColor }]}>
                        {step.badge}
                      </Text>
                    </View>
                  )}
                  {step.status === 'active' && (
                    <Text style={styles.predictedBadge}>PREDICTED</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepDetail,
                  step.status === 'pending' && { opacity: 0.5 }
                ]}>
                  {step.detail}
                </Text>
                {step.id === 4 && step.status !== 'pending' && (
                  <View style={styles.executionItems}>
                    <View style={styles.execItem}>
                      <Text style={styles.checkIcon}>✅</Text>
                      <Text style={styles.execText}>Fleet Commands Sent</Text>
                      <Text style={styles.execTime}>10:32:15</Text>
                    </View>
                    <View style={styles.execItem}>
                      <Text style={styles.checkIcon}>✅</Text>
                      <Text style={styles.execText}>Reroute Protocol Acknowledged</Text>
                      <Text style={styles.execTime}>10:32:18</Text>
                    </View>
                    <View style={styles.execItem}>
                      <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Text>🔄</Text>
                      </Animated.View>
                      <Text style={[styles.execText, { color: Colors.primary, fontWeight: '700' }]}>
                        Deploying Active Cooling Patch...
                      </Text>
                    </View>
                  </View>
                )}
              </GlassCard>
            </View>
          </View>
        ))}
      </View>

      {/* Terminal Logs */}
      <View style={styles.terminal}>
        <View style={styles.terminalHeader}>
          <View style={styles.terminalDot} /><View style={[styles.terminalDot, { backgroundColor: 'rgba(234,179,8,0.6)' }]} /><View style={[styles.terminalDot, { backgroundColor: 'rgba(74,222,128,0.6)' }]} />
          <Text style={styles.terminalTitle}>AGENT_CORE_LOGS</Text>
        </View>
        <ScrollView style={styles.terminalBody} showsVerticalScrollIndicator={false}>
          {logs.map((log, i) => (
            <Text key={i} style={styles.terminalLine}>
              <Text style={{ color: logColor(log.level) }}>[{log.time}] </Text>
              <Text style={styles.terminalMsg}>{log.message}</Text>
            </Text>
          ))}
        </ScrollView>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Spacing.xl, paddingBottom: Spacing.md,
  },
  logoText: { ...Typography.headlineSM, color: Colors.primary, fontWeight: '700' },
  bellIcon: { fontSize: 22 },

  // Hero
  heroCard: { padding: Spacing.lg, marginBottom: Spacing.xl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  coreLabel: { ...Typography.labelMD, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle: { ...Typography.headlineMD, color: Colors.onSurface },
  heroRight: { alignItems: 'flex-end', gap: Spacing.xs },
  autonomousBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primary}18`,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: `${Colors.primary}33`,
  },
  autonomousDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  autonomousText: { ...Typography.labelMD, color: Colors.primary },
  confidenceBox: { alignItems: 'flex-end', marginTop: Spacing.xs },
  confidenceLabel: { ...Typography.labelSM, color: Colors.outline },
  confidenceValue: { ...Typography.headlineSM, color: Colors.primary, fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },

  // Steps
  stepsContainer: { position: 'relative', marginBottom: Spacing.xl },
  connectingLine: {
    position: 'absolute', left: 24, top: 28, bottom: 28,
    width: 2, backgroundColor: Colors.outlineVariant, opacity: 0.3,
    zIndex: 0,
  },
  stepRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.lg, zIndex: 1 },
  stepIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepIconEmoji: { fontSize: 20 },
  stepContent: { flex: 1 },
  stepCard: { padding: Spacing.md },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  stepTitle: { ...Typography.headlineSM, color: Colors.onSurface, flex: 1 },
  stepBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  stepBadgeText: { ...Typography.labelSM },
  predictedBadge: { ...Typography.dataMono, color: Colors.error },
  stepDetail: { ...Typography.bodySM, color: Colors.onSurfaceVariant, lineHeight: 20 },

  // Execution items
  executionItems: { marginTop: Spacing.sm, gap: Spacing.xs },
  execItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  checkIcon: { fontSize: 18 },
  execText: { ...Typography.bodySM, color: Colors.onSurface, flex: 1 },
  execTime: { ...Typography.labelSM, color: Colors.outline },

  // Terminal
  terminal: {
    backgroundColor: Colors.inverseSurface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: Colors.inverseSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  terminalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: Spacing.sm, marginBottom: Spacing.sm,
  },
  terminalDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(186,26,26,0.6)', marginRight: 2 },
  terminalTitle: { ...Typography.labelSM, color: 'rgba(255,255,255,0.4)', marginLeft: Spacing.sm },
  terminalBody: { maxHeight: 160 },
  terminalLine: { marginBottom: 4, lineHeight: 20 },
  terminalMsg: { ...Typography.dataMono, color: 'rgba(255,255,255,0.7)' },
});
