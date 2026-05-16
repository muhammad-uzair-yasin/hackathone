/**
 * Screen 3: Outcome Visualization
 * BioRoute Cold-Chain — Before / After toggle, protocol timeline, email preview
 * Matches Stitch design: Outcome Visualization
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
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface Props {
  beforeState?: ShipmentState;
  afterState?: ShipmentState;
}

interface ShipmentState {
  shipmentId: string;
  cargo: string;
  route: string;
  destination: string;
  status: string;
  temp: string;
}

const BEFORE: ShipmentState = {
  shipmentId: 'SHP-882',
  cargo: 'Insulin (Temp Critical)',
  route: 'Highway 9',
  destination: 'District 4 General Hospital',
  status: 'In Transit (On Time)',
  temp: '2.1°C → rising',
};

const AFTER: ShipmentState = {
  shipmentId: 'SHP-882',
  cargo: 'Insulin (Temp Critical)',
  route: 'District 3 Bio-Corridor',
  destination: 'District 3 Cold-Vault',
  status: 'Emergency Reroute',
  temp: '2.4°C → STABILIZED',
};

const TIMELINE = [
  {
    time: '14:02:41',
    title: 'AI Engine Detection',
    detail: 'Latent thermal drift detected via sensor fusion. Predicted failure: 8.2 mins.',
  },
  {
    time: '14:02:41',
    title: 'Node Notification',
    detail: "St. Jude's Hospital notified of micro-reroute delay (+4 mins).",
  },
  {
    time: '14:02:42',
    title: 'Logistics Protocol Completed',
    detail: 'Cold-chain custody successfully transferred to District 3 Hub.',
  },
];

export default function OutcomeVisualization({
  beforeState = BEFORE,
  afterState = AFTER,
}: Props) {
  const [activeView, setActiveView] = useState<'before' | 'after'>('after');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pingAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Success glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    // Ping dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim, { toValue: 2, duration: 800, useNativeDriver: true }),
        Animated.timing(pingAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const toggleView = (view: 'before' | 'after') => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.back(1.5)) }),
      ]),
    ]).start();
    setActiveView(view);
  };

  const current = activeView === 'before' ? beforeState : afterState;
  const isBefore = activeView === 'before';

  const glowShadow = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.35],
  });

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

      {/* Toggle Buttons */}
      <View style={styles.toggleCenter}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, isBefore && styles.toggleBtnActive]}
            onPress={() => toggleView('before')}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, isBefore && styles.toggleTextActive]}>
              Before Alert
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !isBefore && styles.toggleBtnActive]}
            onPress={() => toggleView('after')}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, !isBefore && styles.toggleTextActive]}>
              After AI Execution
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.outcomeTitle}>Shipment #882 Outcome</Text>
        <Text style={styles.outcomeSubtitle}>Autonomous Intervention Analysis • Insulin Cold-Chain</Text>
      </View>

      {/* Comparison Canvas */}
      <Animated.View
        style={[
          styles.canvasWrapper,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {isBefore ? (
          /* BEFORE VIEW */
          <GlassCard style={[styles.canvas, { borderColor: `${Colors.error}30` }]}>
            <View style={styles.canvasOverlay}>
              <View style={[styles.statusChip, { backgroundColor: `${Colors.error}18` }]}>
                <Text style={[styles.statusChipIcon, { color: Colors.error }]}>⚠️</Text>
                <Text style={[styles.statusChipLabel, { color: Colors.error }]}>Critical Risk</Text>
              </View>
              <Text style={styles.canvasHeading}>Temperature trend UP</Text>
              <Text style={styles.canvasDetail}>
                Sensors detecting latent compressor failure in Van-12.
              </Text>
            </View>

            <View style={styles.stateGrid}>
              <StateRow label="Shipment" value={current.shipmentId} />
              <StateRow label="Cargo" value={current.cargo} />
              <StateRow label="Route" value={current.route} icon="🛣️" />
              <StateRow label="Destination" value={current.destination} />
              <StateRow label="Status" value={current.status} valueColor="#16a34a" icon="🟢" />
              <StateRow label="Temperature" value={current.temp} />
            </View>
          </GlassCard>
        ) : (
          /* AFTER VIEW */
          <GlassCard style={[styles.canvas, styles.canvasAfter]}>
            {/* Protected badge */}
            <View style={styles.protectedHeader}>
              <View style={styles.protectedBadge}>
                <Text style={styles.protectedIcon}>🛡️</Text>
                <Text style={styles.protectedLabel}>EMERGENCY PROTECTED</Text>
              </View>
              <View style={styles.coolingBox}>
                <Text style={styles.coolingLabel}>COOLING SYSTEM</Text>
                <Text style={styles.coolingValue}>
                  2.4°C <Text style={styles.coolingStabilized}>STABILIZED</Text>
                </Text>
              </View>
            </View>

            <View style={styles.afterTitleRow}>
              <Text style={styles.afterTitle}>Insulin #882</Text>
              <View style={styles.protectedDotRow}>
                <Animated.View style={[styles.pingDot, { transform: [{ scale: pingAnim }] }]} />
                <Text style={styles.protectedText}>PROTECTED</Text>
              </View>
              <Text style={styles.afterSubtitle}>District 3 Backup Active</Text>
            </View>

            <View style={styles.stateGrid}>
              <StateRow label="Shipment" value={current.shipmentId} />
              <StateRow label="Cargo" value={current.cargo} />
              <StateRow label="New Route" value={current.route} icon="🔄" />
              <StateRow label="New Destination" value={current.destination} icon="🏥" />
              <StateRow label="Status" value={current.status} valueColor={Colors.error} icon="🔴" />
              <StateRow label="Temperature" value={current.temp} valueColor={Colors.primary} />
            </View>

            {/* Reroute banner */}
            <View style={styles.rerouteBanner}>
              <Text style={styles.rerouteIcon}>✨</Text>
              <View>
                <Text style={styles.rerouteTitle}>Emergency Reroute Activated</Text>
                <Text style={styles.rerouteDetail}>Intercepted by Bio-Drone Unit D-12 in 0.4s</Text>
              </View>
            </View>
          </GlassCard>
        )}
      </Animated.View>

      {/* Protocol Timeline */}
      <GlassCard variant="neumorphic" style={styles.timelineCard}>
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineLabel}>PROTOCOL TIMELINE</Text>
          <Text style={styles.compliantBadge}>100% COMPLIANT</Text>
        </View>
        {TIMELINE.map((item, i) => (
          <View key={i} style={styles.timelineItem}>
            <View style={styles.timelineDotCol}>
              <View style={styles.timelineDot} />
              {i < TIMELINE.length - 1 && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTime}>{item.time} • {item.title}</Text>
              <Text style={styles.timelineDetail}>{item.detail}</Text>
            </View>
          </View>
        ))}
      </GlassCard>

      {/* AI Automated Email */}
      <GlassCard variant="inset" style={styles.emailCard}>
        <View style={styles.emailHeader}>
          <View style={styles.emailIconRow}>
            <Text style={{ fontSize: 18 }}>✉️</Text>
            <Text style={styles.emailTitle}>AI Automated Report</Text>
          </View>
          <Text style={styles.emailSent}>SENT 14:03</Text>
        </View>
        <Text style={styles.emailTo}>To: Dr. Sarah Chen (Chief Pharmacist)</Text>
        <View style={styles.emailDivider} />
        <Text style={styles.emailBody}>
          "Notice: Autonomous intervention for Shipment #882 was successful.
          Thermal integrity maintained at 2.4°C. Routing was adjusted through
          District 3 due to upstream hardware anomaly. Estimated arrival: 14:45."
        </Text>
        <TouchableOpacity style={styles.viewLogsBtn}>
          <Text style={styles.viewLogsText}>View Full Logs →</Text>
        </TouchableOpacity>
      </GlassCard>

      {/* Acknowledge CTA */}
      <View style={styles.ctaSection}>
        <TouchableOpacity style={styles.ackBtn} activeOpacity={0.85}>
          <Text style={styles.ackBtnText}>✅  Acknowledge AI Action</Text>
        </TouchableOpacity>
        <Text style={styles.protocolRef}>Logged under Protocol: BIO-AUT-X4</Text>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function StateRow({
  label,
  value,
  valueColor,
  icon,
}: {
  label: string;
  value: string;
  valueColor?: string;
  icon?: string;
}) {
  return (
    <View style={styles.stateRow}>
      <Text style={styles.stateLabel}>{label}</Text>
      <View style={styles.stateValueRow}>
        {icon && <Text style={{ fontSize: 14, marginRight: 4 }}>{icon}</Text>}
        <Text style={[styles.stateValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      </View>
    </View>
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

  // Toggle
  toggleCenter: { alignItems: 'center', marginBottom: Spacing.lg },
  toggleContainer: {
    flexDirection: 'row', padding: 6,
    backgroundColor: Colors.glassBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.glassBorder,
    shadowColor: '#d1d9e6', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.8, shadowRadius: 10,
    elevation: 4,
    marginBottom: Spacing.md,
  },
  toggleBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  toggleText: { ...Typography.labelMD, color: Colors.onSurfaceVariant },
  toggleTextActive: { color: Colors.onPrimary },
  outcomeTitle: { ...Typography.headlineMD, color: Colors.onBackground, textAlign: 'center' },
  outcomeSubtitle: { ...Typography.bodySM, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 2 },

  // Canvas
  canvasWrapper: { marginBottom: Spacing.lg },
  canvas: {
    padding: Spacing.lg, minHeight: 300,
    borderWidth: 1, borderColor: 'transparent',
  },
  canvasAfter: {
    borderColor: `${Colors.primary}20`,
  },
  canvasOverlay: { marginBottom: Spacing.lg },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: Spacing.xs },
  statusChipIcon: { fontSize: 14 },
  statusChipLabel: { ...Typography.labelSM, textTransform: 'uppercase', letterSpacing: 1 },
  canvasHeading: { ...Typography.bodyMD, fontWeight: '700', color: Colors.onSurface, marginBottom: 4 },
  canvasDetail: { ...Typography.bodySM, color: Colors.onSurfaceVariant },

  // After header
  protectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  protectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.glassBackground,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4,
  },
  protectedIcon: { fontSize: 16 },
  protectedLabel: { ...Typography.labelSM, color: Colors.primary, letterSpacing: 1 },
  coolingBox: { alignItems: 'flex-end' },
  coolingLabel: { ...Typography.labelSM, color: Colors.onSurfaceVariant },
  coolingValue: { ...Typography.headlineSM, color: Colors.primary },
  coolingStabilized: { ...Typography.bodySM, color: Colors.onSurfaceVariant, fontWeight: '400' },
  afterTitleRow: { marginBottom: Spacing.md },
  afterTitle: { ...Typography.headlineSM, color: Colors.onSurface },
  protectedDotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primary}18`,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  pingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  protectedText: { ...Typography.labelSM, color: Colors.primary, fontWeight: '700' },
  afterSubtitle: { ...Typography.bodySM, color: Colors.onSurfaceVariant, marginTop: Spacing.xs },

  // State grid
  stateGrid: { gap: Spacing.xs, marginBottom: Spacing.md },
  stateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: `${Colors.outlineVariant}22` },
  stateLabel: { ...Typography.labelMD, color: Colors.outline },
  stateValueRow: { flexDirection: 'row', alignItems: 'center' },
  stateValue: { ...Typography.bodySM, color: Colors.onSurface, fontWeight: '600' },

  // Reroute banner
  rerouteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: `${Colors.primary}10`,
    padding: Spacing.md, borderRadius: BorderRadius.sm,
  },
  rerouteIcon: { fontSize: 24 },
  rerouteTitle: { ...Typography.labelMD, color: Colors.primary },
  rerouteDetail: { ...Typography.bodySM, color: Colors.onSurfaceVariant },

  // Timeline
  timelineCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  timelineLabel: { ...Typography.labelMD, color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1.5 },
  compliantBadge: { ...Typography.labelSM, color: Colors.primary, fontWeight: '700' },
  timelineItem: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  timelineDotCol: { alignItems: 'center' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: `${Colors.outlineVariant}40`, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: Spacing.sm },
  timelineTime: { ...Typography.labelMD, color: Colors.onSurface, fontWeight: '700', marginBottom: 2 },
  timelineDetail: { ...Typography.bodySM, color: Colors.onSurfaceVariant },

  // Email
  emailCard: {
    padding: Spacing.lg, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: `${Colors.white}66`,
  },
  emailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  emailIconRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emailTitle: { ...Typography.labelMD, fontWeight: '700', color: Colors.onSurface },
  emailSent: { ...Typography.labelSM, color: Colors.onSurfaceVariant },
  emailTo: { ...Typography.bodySM, fontWeight: '700', color: Colors.onSurface, marginBottom: Spacing.sm },
  emailDivider: { height: 1, backgroundColor: `${Colors.outlineVariant}33`, marginBottom: Spacing.sm },
  emailBody: { ...Typography.bodySM, color: Colors.onSurfaceVariant, fontStyle: 'italic', lineHeight: 22, marginBottom: Spacing.lg },
  viewLogsBtn: { alignSelf: 'flex-end' },
  viewLogsText: { ...Typography.labelMD, color: Colors.primary, fontWeight: '700' },

  // CTA
  ctaSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  ackBtn: {
    width: '100%', height: 56, borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  ackBtnText: { ...Typography.bodyMD, color: Colors.onPrimary, fontWeight: '700' },
  protocolRef: { ...Typography.labelSM, color: Colors.onSurfaceVariant, opacity: 0.7, marginTop: Spacing.sm },
});
