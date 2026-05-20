/**
 * Screen 1: Ingestion Dashboard
 * BioRoute Cold-Chain — Input unstructured alerts, view live shipments
 * Integrates with:
 *   GET /api/db         → loads live shipment data
 *   GET /api/scenarios  → loads test scenario list
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

const API_BASE = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

const DEMO_ALERT =
  'Severe heatwave alert issued for District 4. Temperatures expected to spike to 42°C in the next hour. Additionally, a multi-car accident has completely blocked Highway 9.';

interface Shipment {
  id: string;
  cargo: string;
  route: string;
  status: string;
  temp: string;
  target: string;
  eta: string;
  distance: string;
  risk: string;
  riskLevel: 'error' | 'stable';
}

const FALLBACK_SHIPMENTS: Shipment[] = [
  {
    id: 'SHP-882', cargo: 'Insulin (Temp Critical)',
    route: 'Zurich Hub → District 4 General Hospital',
    status: 'In Transit (On Time)', temp: '2.1°C', target: '2–8°C',
    eta: '14:20 (12m)', distance: '4.2 km left',
    risk: 'HIGH RISK: HEAT', riskLevel: 'error',
  },
  {
    id: 'SHP-901', cargo: 'Saline IVs',
    route: 'Lyon Central → District 1 Clinic',
    status: 'In Transit (On Time)', temp: '4.8°C', target: '1–10°C',
    eta: '16:45 (2h 4m)', distance: '182 km left',
    risk: 'STABLE', riskLevel: 'stable',
  },
];

interface Scenario {
  id: string;
  label: string;
  hazard_type: string;
  text: string;
}

interface Props {
  onAnalyze: (text: string) => void;
  isAnalyzing: boolean;
  onDriverReport?: () => void;
}

// ─── Temperature Gauge ────────────────────────────────────────────────────────
function TempGauge({ current, threshold }: { current: number; threshold: number }) {
  const pct = Math.min(100, Math.max(0, (current / threshold) * 100));
  const level = pct < 60 ? 'safe' : pct < 85 ? 'warn' : 'danger';
  const color = level === 'safe' ? '#10B981' : level === 'warn' ? '#F59E0B' : '#EF4444';
  const label = level === 'safe' ? 'SAFE' : level === 'warn' ? 'CAUTION' : 'DANGER';
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#9CA3AF' }}>
          TEMP {current}°C / limit {threshold}°C
        </Text>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color }}>{label}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%` as any, height: '100%', borderRadius: 99, backgroundColor: color }} />
      </View>
    </View>
  );
}

// ─── Escalation Timer ─────────────────────────────────────────────────────────
function EscalationTimer({ active, onAcknowledge }: { active: boolean; onAcknowledge: () => void }) {
  const [secs, setSecs] = useState(300); // 5-min countdown
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!active || acknowledged) return;
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [active, acknowledged]);

  if (!active) return null;

  const mins = Math.floor(secs / 60);
  const sec = secs % 60;
  const timeStr = `${mins}:${sec.toString().padStart(2, '0')}`;

  return (
    <View style={[
      timerStyles.wrap,
      acknowledged ? timerStyles.wrapOk : secs < 60 ? timerStyles.wrapUrgent : timerStyles.wrapActive,
    ]}>
      <Ionicons
        name={acknowledged ? 'checkmark-circle' : 'warning-outline'}
        size={18}
        color={acknowledged ? '#059669' : secs < 60 ? '#DC2626' : '#D97706'}
      />
      <View style={{ flex: 1 }}>
        <Text style={[
          timerStyles.label,
          { color: acknowledged ? '#059669' : secs < 60 ? '#DC2626' : '#D97706' },
        ]}>
          {acknowledged ? 'Driver acknowledged reroute ✓' : `Driver acknowledgement required`}
        </Text>
        {!acknowledged && (
          <Text style={timerStyles.sub}>Auto-escalate in {timeStr}</Text>
        )}
      </View>
      {!acknowledged && (
        <TouchableOpacity
          style={[timerStyles.ackBtn, secs < 60 && timerStyles.ackBtnUrgent]}
          onPress={() => { setAcknowledged(true); onAcknowledge(); }}
          activeOpacity={0.8}
        >
          <Text style={timerStyles.ackTxt}>ACK</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function IngestionDashboard({ onAnalyze, isAnalyzing, onDriverReport }: Props) {
  const [alertText, setAlertText] = useState(DEMO_ALERT);
  const [shipments, setShipments] = useState<Shipment[]>(FALLBACK_SHIPMENTS);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [showScenarios, setShowScenarios] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [rerouteActive, setRerouteActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── Load live data from backend ────────────────────────────────────────
  useEffect(() => {
    // Check backend health + load shipments
    (async () => {
      try {
        const healthRes = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (healthRes.ok) {
          setBackendOnline(true);

          // Load live shipment data
          const dbRes = await fetch(`${API_BASE}/api/db`);
          if (dbRes.ok) {
            const data = await dbRes.json();
            if (data.active_shipments?.length) {
              setShipments(data.active_shipments.map((s: any) => ({
                id: s.shipment_id,
                cargo: s.cargo_type,
                route: `${s.primary_route} → ${s.destination}`,
                status: s.current_status,
                temp: `${s.max_idling_temp_threshold_celsius ? (s.max_idling_temp_threshold_celsius - 36) + '°C' : '2.1°C'}`,
                target: `< ${s.max_idling_temp_threshold_celsius || 38}°C`,
                eta: 'Live',
                distance: '—',
                risk: s.current_status?.includes('Emergency') ? 'REROUTED' :
                      (s.max_idling_temp_threshold_celsius && s.max_idling_temp_threshold_celsius < 40) ? 'HIGH RISK: HEAT' : 'STABLE',
                riskLevel: (s.max_idling_temp_threshold_celsius && s.max_idling_temp_threshold_celsius < 40 ? 'error' : 'stable') as 'error' | 'stable',
              })));
            }
          }

          // Load scenarios
          try {
            const scenRes = await fetch(`${API_BASE}/api/scenarios`);
            if (scenRes.ok) {
              const scenData = await scenRes.json();
              setScenarios(scenData.scenarios || []);
            }
          } catch {}
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }
    })();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);

  const handleAnalyze = () => {
    if (!alertText.trim()) {
      Alert.alert('Empty Alert', 'Please paste an unstructured alert to analyze.');
      return;
    }
    setRerouteActive(false);
    onAnalyze(alertText);
  };

  const handleAnalyzeDone = useCallback(() => {
    setRerouteActive(true);
  }, []);

  const handleSelectScenario = (scenario: Scenario) => {
    setAlertText(scenario.text);
    setShowScenarios(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🔗</Text>
          </View>
          <Text style={styles.logoText}>BioRoute</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.aiOnlineBadge, backendOnline === false && { backgroundColor: `${Colors.error}18` }]}>
            <Animated.View style={[
              styles.aiDot,
              { transform: [{ scale: pulseAnim }] },
              backendOnline === false && { backgroundColor: Colors.error },
            ]} />
            <Text style={[styles.aiOnlineText, backendOnline === false && { color: Colors.error }]}>
              {backendOnline === null ? 'CONNECTING...' : backendOnline ? 'AI ONLINE' : 'OFFLINE MODE'}
            </Text>
          </View>
          <Text style={styles.bellIcon}>🔔</Text>
        </View>
      </View>

      {/* Hero Section */}
      <GlassCard style={styles.heroCard} borderLeftColor={Colors.primary}>
        <View style={styles.heroAbsIcon}>
          <Text style={{ fontSize: 80, opacity: 0.05 }}>💉</Text>
        </View>
        <Text style={styles.heroTitle}>{shipments.length} Active Medical Shipments Protected</Text>
        <Text style={styles.heroSubtitle}>
          Real-time autonomous oversight via AI Engine Alpha-4. All biotherapeutics currently within critical thermal parameters.
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AVG TEMP</Text>
            <Text style={[styles.statValue, { color: Colors.primary }]}>2.4°C</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>RISK ALERTS</Text>
            <Text style={[styles.statValue, { color: Colors.error }]}>{shipments.filter(s => s.riskLevel === 'error').length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>API STATUS</Text>
            <Text style={[styles.statValue, { color: backendOnline ? Colors.primary : Colors.error }]}>
              {backendOnline ? 'LIVE' : 'DEMO'}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Ingestion Panel */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitleRow}>
          <Text style={{ color: Colors.primary }}>🧠 </Text>
          <Text style={styles.sectionTitle}>Ingest Unstructured Alert</Text>
        </Text>
        <Text style={styles.sectionBadge}>Neural Processor v2.1</Text>
      </View>

      <GlassCard style={styles.ingestionCard}>
        {/* Scenario picker (if scenarios loaded from backend) */}
        {scenarios.length > 0 && (
          <TouchableOpacity
            style={styles.scenarioToggle}
            onPress={() => setShowScenarios(!showScenarios)}
            activeOpacity={0.7}
          >
            <Text style={styles.scenarioToggleText}>
              {showScenarios ? '▲ Hide Scenarios' : '▼ Load Test Scenario'}
            </Text>
          </TouchableOpacity>
        )}
        {showScenarios && scenarios.length > 0 && (
          <View style={styles.scenarioList}>
            {scenarios.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.scenarioItem}
                onPress={() => handleSelectScenario(s)}
                activeOpacity={0.7}
              >
                <Text style={styles.scenarioLabel}>{s.label}</Text>
                <Text style={styles.scenarioType}>{s.hazard_type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.textAreaWrapper}>
          <TextInput
            style={styles.textArea}
            value={alertText}
            onChangeText={setAlertText}
            multiline
            numberOfLines={5}
            placeholder="Paste supply chain intelligence or incident reports here..."
            placeholderTextColor={`${Colors.outline}80`}
            textAlignVertical="top"
          />
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, isAnalyzing && styles.primaryBtnDisabled]}
            onPress={handleAnalyze}
            disabled={isAnalyzing}
            activeOpacity={0.85}
          >
            {isAnalyzing ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>🧠  Analyze & Protect Supply Chain</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.contextRow}>
          <Text style={styles.contextText}>✨ Context aware: Temperature Sensitive</Text>
        </View>
      </GlassCard>

      {/* Live Shipments */}
      <Text style={styles.liveLabel}>LIVE SHIPMENTS</Text>

      {/* Escalation Timer (shown after a reroute analysis) */}
      <EscalationTimer
        active={rerouteActive}
        onAcknowledge={() => setRerouteActive(false)}
      />

      {shipments.map((s) => {
        // Extract numeric temp for gauge
        const tempNum = parseFloat(s.temp?.replace('°C', '') || '0') || 0;
        const limitNum = parseFloat(s.target?.replace(/[^0-9.]/g, '') || '38') || 38;
        return (
          <GlassCard key={s.id} style={styles.shipmentCard}>
            <View style={styles.shipmentBanner}>
              <View style={styles.shipmentBannerGradient} />
              <View style={styles.badgeRow}>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
                <View style={[styles.riskBadge, s.riskLevel === 'error' ? styles.riskBadgeError : styles.riskBadgeStable]}>
                  <Text style={[styles.riskBadgeText, s.riskLevel === 'error' ? styles.riskTextError : styles.riskTextStable]}>
                    {s.risk}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.shipmentBody}>
              <View style={styles.shipmentTopRow}>
                <View>
                  <Text style={styles.shipmentId}>{s.id}: {s.cargo}</Text>
                  <Text style={styles.shipmentRoute}>{s.route}</Text>
                </View>
                <View style={styles.tempBox}>
                  <Text style={styles.tempValue}>{s.temp}</Text>
                  <Text style={styles.tempTarget}>Limit: {s.target}</Text>
                </View>
              </View>

              {/* Temperature Gauge */}
              <TempGauge current={tempNum} threshold={limitNum} />

              <View style={styles.divider} />
              <View style={styles.shipmentMetaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>🕐</Text>
                  <View>
                    <Text style={styles.metaLabel}>ETA</Text>
                    <Text style={styles.metaValue}>{s.eta}</Text>
                  </View>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>📍</Text>
                  <View>
                    <Text style={styles.metaLabel}>Status</Text>
                    <Text style={styles.metaValue}>{s.status}</Text>
                  </View>
                </View>
              </View>
            </View>
          </GlassCard>
        );
      })}

      {/* Driver Report Button */}
      {onDriverReport && (
        <TouchableOpacity style={styles.driverReportBtn} onPress={onDriverReport} activeOpacity={0.85}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.driverReportTxt}>Report a Driver Issue</Text>
          <Ionicons name="chevron-forward" size={14} color="#DC2626" />
        </TouchableOpacity>
      )}

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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  logoIcon: { fontSize: 18 },
  logoText: { ...Typography.headlineSM, color: Colors.primary, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  aiOnlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primaryContainer}18`,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  aiOnlineText: { ...Typography.labelMD, color: Colors.primary },
  bellIcon: { fontSize: 22 },

  heroCard: { padding: Spacing.lg, marginBottom: Spacing.lg, overflow: 'hidden' },
  heroAbsIcon: { position: 'absolute', top: 0, right: 0, padding: Spacing.md, opacity: 0.05 },
  heroTitle: { ...Typography.headlineMD, color: Colors.onSurface, marginBottom: Spacing.xs },
  heroSubtitle: { ...Typography.bodyMD, color: Colors.onSurfaceVariant, marginBottom: Spacing.lg },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.surfaceBright,
    borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    shadowColor: '#d1d9e6', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
  },
  statLabel: { ...Typography.labelSM, color: Colors.outline, textTransform: 'uppercase' },
  statValue: { ...Typography.headlineSM, fontWeight: '700', marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { ...Typography.headlineSM, color: Colors.onSurface },
  sectionBadge: { ...Typography.labelMD, color: Colors.outline },

  ingestionCard: { padding: Spacing.lg, marginBottom: Spacing.lg },

  // Scenario picker
  scenarioToggle: { marginBottom: Spacing.sm, alignSelf: 'flex-start' },
  scenarioToggleText: { ...Typography.labelMD, color: Colors.primary },
  scenarioList: {
    marginBottom: Spacing.md, backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.sm, padding: Spacing.sm, gap: Spacing.xs,
  },
  scenarioItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: `${Colors.outlineVariant}22`,
  },
  scenarioLabel: { ...Typography.bodySM, color: Colors.onSurface, flex: 1 },
  scenarioType: { ...Typography.labelSM, color: Colors.primary, marginLeft: Spacing.sm },

  textAreaWrapper: {
    backgroundColor: Colors.surfaceBright, borderRadius: BorderRadius.sm,
    shadowColor: '#d1d9e6', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.8, shadowRadius: 8,
    elevation: 2, marginBottom: Spacing.md,
  },
  textArea: { ...Typography.bodyLG, color: Colors.onSurface, padding: Spacing.md, minHeight: 120 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
    minHeight: 50,
  },
  primaryBtnDisabled: { backgroundColor: Colors.outline, shadowOpacity: 0 },
  primaryBtnText: { ...Typography.labelMD, color: Colors.white, fontSize: 13 },
  secondaryBtn: {
    paddingVertical: 14, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.outlineVariant,
    backgroundColor: Colors.white,
  },
  secondaryBtnText: { ...Typography.labelMD, color: Colors.primary },
  contextRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs },
  contextText: { ...Typography.labelMD, color: Colors.primary },

  liveLabel: {
    ...Typography.labelMD, color: Colors.outline, textTransform: 'uppercase',
    letterSpacing: 2, marginBottom: Spacing.sm,
  },
  shipmentCard: { marginBottom: Spacing.md, padding: 0, overflow: 'hidden' },
  shipmentBanner: { height: 80, backgroundColor: Colors.surfaceContainerHigh, position: 'relative' },
  shipmentBannerGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
    backgroundColor: 'rgba(247,249,251,0.9)',
  },
  badgeRow: { position: 'absolute', top: Spacing.sm, left: Spacing.sm, flexDirection: 'row', gap: Spacing.xs },
  activeBadge: {
    backgroundColor: `${Colors.primary}e6`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  activeBadgeText: { ...Typography.labelSM, color: Colors.white },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  riskBadgeError: { backgroundColor: `${Colors.error}18`, borderWidth: 1, borderColor: `${Colors.error}30` },
  riskBadgeStable: { backgroundColor: Colors.surfaceContainerHigh },
  riskBadgeText: { ...Typography.labelSM },
  riskTextError: { color: Colors.error },
  riskTextStable: { color: Colors.onSurfaceVariant },

  shipmentBody: { padding: Spacing.lg, paddingTop: 0, marginTop: -Spacing.xl },
  shipmentTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: Spacing.md },
  shipmentId: { ...Typography.headlineSM, color: Colors.onSurface, fontWeight: '600' },
  shipmentRoute: { ...Typography.labelMD, color: Colors.outline, marginTop: 2 },
  tempBox: { alignItems: 'flex-end' },
  tempValue: { ...Typography.headlineMD, color: Colors.primary, fontWeight: '700' },
  tempTarget: { ...Typography.labelSM, color: Colors.outline },
  divider: { height: 1, backgroundColor: `${Colors.outlineVariant}33`, marginBottom: Spacing.sm },
  shipmentMetaRow: { flexDirection: 'row', gap: Spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaIcon: { fontSize: 16, color: Colors.outline },
  metaLabel: { ...Typography.labelSM, color: Colors.outline },
  metaValue: { ...Typography.labelMD, color: Colors.onSurface },
  driverReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.error}30`,
    backgroundColor: `${Colors.error}08`,
    marginBottom: 12,
  },
  driverReportTxt: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
});

// ─── Escalation Timer Styles ──────────────────────────────────────────────────
const timerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  wrapActive: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  wrapUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  wrapOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  ackBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#D97706',
  },
  ackBtnUrgent: { backgroundColor: '#DC2626' },
  ackTxt: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFF' },
});
