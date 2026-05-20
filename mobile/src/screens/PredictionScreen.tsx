/**
 * PredictionScreen — Predictive Risk Agent
 * Completely separate from main agent.
 * - Configure schedule (Off / 1 / 5 / 15 / 30 / 60 min)
 * - Manual "Run Now" trigger
 * - Risk score cards per shipment (animated)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  TextInput,
  Switch,
  Alert,
} from 'react-native';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import ScreenHeader from '../components/ScreenHeader';
import RiskHistoryChart from '../components/RiskHistoryChart';
import { FontFamily, pageStyles, Page } from '../theme';

const API_BASE = process.env.EXPO_PUBLIC_API_URL
  ?? Platform.select({ android: 'http://10.0.2.2:8000', ios: 'http://localhost:8000', default: 'http://localhost:8000' });

const INTERVAL_OPTIONS = [
  { label: 'Off', value: 0, icon: 'close-circle-outline' },
  { label: '1 min', value: 1, icon: 'flash-outline' },
  { label: '5 min', value: 5, icon: 'time-outline' },
  { label: '15 min', value: 15, icon: 'time-outline' },
  { label: '30 min', value: 30, icon: 'timer-outline' },
  { label: '1 hour', value: 60, icon: 'alarm-outline' },
] as const;

const RISK_COLORS = {
  CRITICAL: '#DC2626',
  HIGH:     '#EA580C',
  MEDIUM:   '#D97706',
  LOW:      '#2563EB',
  SAFE:     '#059669',
};
const RISK_BG = {
  CRITICAL: '#FEF2F2',
  HIGH:     '#FFF7ED',
  MEDIUM:   '#FFFBEB',
  LOW:      '#EFF6FF',
  SAFE:     '#ECFDF5',
};
const RISK_BORDER = {
  CRITICAL: '#FECACA',
  HIGH:     '#FED7AA',
  MEDIUM:   '#FDE68A',
  LOW:      '#BFDBFE',
  SAFE:     '#A7F3D0',
};
const URGENCY_LABEL = {
  IMMEDIATE:      '🚨 Act Immediately',
  WITHIN_15_MIN:  '⚠️ Act within 15 min',
  MONITOR:        '👁 Monitor closely',
  NO_ACTION:      '✅ No action needed',
};

interface Prediction {
  shipment_id: string;
  cargo_type: string;
  final_risk_score: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  prediction_summary: string;
  breach_probability_percent: number;
  estimated_breach_in_minutes: number | null;
  top_triggers: string[];
  recommended_action: string;
  action_urgency: keyof typeof URGENCY_LABEL;
  confidence: number;
}

interface SchedulerState {
  interval_minutes: number;
  scheduled: boolean;
  next_run_at: string | null;
  is_running: boolean;
}

interface PipelineStep {
  agent: string;
  status: 'waiting' | 'running' | 'done' | 'failed';
  message?: string;
}

const PRED_STEP_HINTS: Record<string, string> = {
  'sensor-analyst':  'Reading live sensors & telemetry…',
  'pattern-matcher': 'Cross-referencing breach history…',
  'risk-scorer':     'Calculating final risk scores…',
};

// ─── Animated ring component ──────────────────────────────────────────────────
function RiskRing({ score, color }: { score: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: score, duration: 900, useNativeDriver: false }).start();
  }, [score]);

  return (
    <View style={ringStyles.wrap}>
      <View style={[ringStyles.outer, { borderColor: `${color}30` }]}>
        <View style={[ringStyles.inner, { borderColor: color, borderTopColor: 'transparent' }]} />
        <View style={ringStyles.center}>
          <Text style={[ringStyles.score, { color }]}>{score}</Text>
          <Text style={[ringStyles.max, { color }]}>/100</Text>
        </View>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  outer: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  inner: {
    position: 'absolute', width: 72, height: 72,
    borderRadius: 36, borderWidth: 3,
  },
  center: { alignItems: 'center' },
  score: { fontFamily: 'Inter_700Bold', fontSize: 17, lineHeight: 20 },
  max: { fontFamily: 'Inter_400Regular', fontSize: 8 },
});

// ─── Countdown to next run ────────────────────────────────────────────────────
function NextRunCountdown({ nextRunAt }: { nextRunAt: string | null }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!nextRunAt) { setRemaining(''); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(nextRunAt).getTime() - Date.now()) / 1000));
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextRunAt]);
  if (!remaining) return null;
  return (
    <Text style={countStyles.txt}>Next run in <Text style={countStyles.bold}>{remaining}</Text></Text>
  );
}
const countStyles = StyleSheet.create({
  txt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280' },
  bold: { fontFamily: 'Inter_700Bold', color: Page.primary },
});


interface RiskEditorProps {
  context: any;
  onSave: (updated: any) => void;
  saving: boolean;
}

function RiskContextEditor({ context, onSave, saving }: RiskEditorProps) {
  if (!context) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <ActivityIndicator color={Page.primary} size="large" />
        <Text style={{ marginTop: 8, color: '#6B7280', fontFamily: 'Inter_400Regular' }}>Loading risk variables...</Text>
      </View>
    );
  }

  // Local state to hold changes before clicking Save
  const [ambientTemp, setAmbientTemp] = useState(String(context.environment?.ambient_temp_celsius ?? ''));
  const [humidity, setHumidity] = useState(String(context.environment?.humidity_percent ?? ''));
  const [weatherCondition, setWeatherCondition] = useState(context.environment?.weather_condition ?? '');
  const [weatherForecast, setWeatherForecast] = useState(context.environment?.weather_forecast_2h ?? '');
  
  const [trafficLevel, setTrafficLevel] = useState(context.road_conditions?.traffic_level ?? 'HIGH');
  const [avgDelay, setAvgDelay] = useState(String(context.road_conditions?.avg_delay_minutes ?? ''));
  const [checkpointWait, setCheckpointWait] = useState(String(context.road_conditions?.checkpoint_wait_thatta ?? ''));
  const [roadQuality, setRoadQuality] = useState(context.road_conditions?.road_quality ?? 'POOR');

  const [gridStability, setGridStability] = useState(context.infrastructure?.power_grid_stability ?? 'UNSTABLE');
  const [fuelAvailability, setFuelAvailability] = useState(context.infrastructure?.fuel_availability_route ?? 'LIMITED');

  // Telemetry for shipments
  const [telemetry, setTelemetry] = useState(context.vehicle_telemetry ?? {});

  const updateTelemetry = (shipmentId: string, field: string, value: any) => {
    setTelemetry((prev: any) => ({
      ...prev,
      [shipmentId]: {
        ...prev[shipmentId],
        [field]: value,
      }
    }));
  };

  const handleSave = () => {
    const updated = {
      ...context,
      environment: {
        ...context.environment,
        ambient_temp_celsius: parseFloat(ambientTemp) || 0,
        humidity_percent: parseFloat(humidity) || 0,
        weather_condition: weatherCondition,
        weather_forecast_2h: weatherForecast,
      },
      road_conditions: {
        ...context.road_conditions,
        traffic_level: trafficLevel,
        avg_delay_minutes: parseInt(avgDelay) || 0,
        checkpoint_wait_thatta: parseInt(checkpointWait) || 0,
        road_quality: roadQuality,
      },
      vehicle_telemetry: telemetry,
      infrastructure: {
        ...context.infrastructure,
        power_grid_stability: gridStability,
        fuel_availability_route: fuelAvailability,
      }
    };
    onSave(updated);
  };

  return (
    <View style={editorStyles.container}>
      <Text style={styles.sectionLabel}>ENVIRONMENT VARIABLES</Text>
      <GlassCard style={editorStyles.card}>
        <View style={editorStyles.row}>
          <View style={editorStyles.col}>
            <Text style={editorStyles.label}>Ambient Temp (°C)</Text>
            <TextInput
              style={editorStyles.input}
              value={ambientTemp}
              onChangeText={setAmbientTemp}
              keyboardType="numeric"
              placeholder="e.g. 38.5"
            />
          </View>
          <View style={editorStyles.col}>
            <Text style={editorStyles.label}>Humidity (%)</Text>
            <TextInput
              style={editorStyles.input}
              value={humidity}
              onChangeText={setHumidity}
              keyboardType="numeric"
              placeholder="e.g. 70"
            />
          </View>
        </View>

        <Text style={editorStyles.label}>Weather Condition</Text>
        <TextInput
          style={editorStyles.input}
          value={weatherCondition}
          onChangeText={setWeatherCondition}
          placeholder="e.g. heatwave, monsoon"
        />

        <Text style={editorStyles.label}>2-Hour Weather Forecast</Text>
        <TextInput
          style={editorStyles.input}
          value={weatherForecast}
          onChangeText={setWeatherForecast}
          placeholder="e.g. temperatures rising to 41C"
        />
      </GlassCard>

      <Text style={styles.sectionLabel}>ROAD & TRAFFIC STATUS</Text>
      <GlassCard style={editorStyles.card}>
        <View style={editorStyles.row}>
          <View style={editorStyles.col}>
            <Text style={editorStyles.label}>Traffic Level</Text>
            <View style={editorStyles.selectorRow}>
              {['LOW', 'MEDIUM', 'HIGH'].map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[editorStyles.selectorChip, trafficLevel === lvl && editorStyles.selectorChipActive]}
                  onPress={() => setTrafficLevel(lvl)}
                >
                  <Text style={[editorStyles.selectorChipTxt, trafficLevel === lvl && editorStyles.selectorChipTxtActive]}>
                    {lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={editorStyles.row}>
          <View style={editorStyles.col}>
            <Text style={editorStyles.label}>Avg Delay (min)</Text>
            <TextInput
              style={editorStyles.input}
              value={avgDelay}
              onChangeText={setAvgDelay}
              keyboardType="numeric"
              placeholder="e.g. 15"
            />
          </View>
          <View style={editorStyles.col}>
            <Text style={editorStyles.label}>Thatta Wait (min)</Text>
            <TextInput
              style={editorStyles.input}
              value={checkpointWait}
              onChangeText={setCheckpointWait}
              keyboardType="numeric"
              placeholder="e.g. 10"
            />
          </View>
        </View>

        <Text style={editorStyles.label}>Road Quality</Text>
        <View style={editorStyles.selectorRow}>
          {['GOOD', 'FAIR', 'POOR'].map((q) => (
            <TouchableOpacity
              key={q}
              style={[editorStyles.selectorChip, roadQuality === q && editorStyles.selectorChipActive]}
              onPress={() => setRoadQuality(q)}
            >
              <Text style={[editorStyles.selectorChipTxt, roadQuality === q && editorStyles.selectorChipTxtActive]}>
                {q}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>

      <Text style={styles.sectionLabel}>INFRASTRUCTURE STABILITY</Text>
      <GlassCard style={editorStyles.card}>
        <Text style={editorStyles.label}>Power Grid Stability</Text>
        <View style={editorStyles.selectorRow}>
          {['STABLE', 'UNSTABLE'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[editorStyles.selectorChip, gridStability === s && editorStyles.selectorChipActive]}
              onPress={() => setGridStability(s)}
            >
              <Text style={[editorStyles.selectorChipTxt, gridStability === s && editorStyles.selectorChipTxtActive]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={editorStyles.label}>Fuel Availability</Text>
        <View style={editorStyles.selectorRow}>
          {['AVAILABLE', 'LIMITED', 'CRITICAL'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[editorStyles.selectorChip, fuelAvailability === f && editorStyles.selectorChipActive]}
              onPress={() => setFuelAvailability(f)}
            >
              <Text style={[editorStyles.selectorChipTxt, fuelAvailability === f && editorStyles.selectorChipTxtActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>

      <Text style={styles.sectionLabel}>VEHICLE TELEMETRY</Text>
      {Object.keys(telemetry).map((shipmentId) => {
        const tel = telemetry[shipmentId];
        return (
          <GlassCard key={shipmentId} style={editorStyles.card}>
            <View style={editorStyles.vehicleHeader}>
              <MaterialCommunityIcons name="truck-outline" size={16} color="#7C3AED" />
              <Text style={editorStyles.vehicleTitle}>{shipmentId}</Text>
            </View>

            <View style={editorStyles.row}>
              <View style={editorStyles.col}>
                <Text style={editorStyles.label}>Idle Minutes</Text>
                <TextInput
                  style={editorStyles.input}
                  value={String(tel.idle_minutes ?? '0')}
                  onChangeText={(val) => updateTelemetry(shipmentId, 'idle_minutes', parseInt(val) || 0)}
                  keyboardType="numeric"
                />
              </View>
              <View style={editorStyles.col}>
                <Text style={editorStyles.label}>Engine Temp (°C)</Text>
                <TextInput
                  style={editorStyles.input}
                  value={String(tel.engine_temp_celsius ?? '0')}
                  onChangeText={(val) => updateTelemetry(shipmentId, 'engine_temp_celsius', parseFloat(val) || 0)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={editorStyles.row}>
              <View style={editorStyles.col}>
                <Text style={editorStyles.label}>Refrigeration Unit</Text>
                <View style={editorStyles.selectorRow}>
                  {['ACTIVE', 'WARNING', 'FAILED'].map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[editorStyles.selectorChip, tel.refrigeration_unit_status === st && editorStyles.selectorChipActive]}
                      onPress={() => updateTelemetry(shipmentId, 'refrigeration_unit_status', st)}
                    >
                      <Text style={[editorStyles.selectorChipTxt, tel.refrigeration_unit_status === st && editorStyles.selectorChipTxtActive]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </GlassCard>
        );
      })}

      <TouchableOpacity
        style={[editorStyles.saveBtn, saving && editorStyles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={editorStyles.saveBtnTxt}>Apply Risk Context Changes</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const editorStyles = StyleSheet.create({
  container: { gap: 12 },
  card: { padding: 16, marginBottom: 12, gap: 10 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#111827',
  },
  selectorRow: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  selectorChip: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectorChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  selectorChipTxt: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#4B5563' },
  selectorChipTxtActive: { color: '#FFF', fontFamily: 'Inter_700Bold' },
  vehicleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  vehicleTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#111827' },
  saveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnTxt: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFF' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PredictionScreen() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerState>({
    interval_minutes: 0, scheduled: false, next_run_at: null, is_running: false,
  });
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { agent: 'sensor-analyst',  status: 'waiting' },
    { agent: 'pattern-matcher', status: 'waiting' },
    { agent: 'risk-scorer',     status: 'waiting' },
  ]);
  const [coordMsg, setCoordMsg] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const eventSourceRef = useRef<any>(null);

  // Pulse animation for "running" state
  useEffect(() => {
    if (!running) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [running]);

  const [subTab, setSubTab] = useState<'dashboard' | 'editor'>('dashboard');
  const [riskContext, setRiskContext] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [savingContext, setSavingContext] = useState(false);

  const loadPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/predictions`);
      const data = await res.json();
      setPredictions(data.predictions ?? []);
      setLastRun(data.last_run ?? null);
      setRunCount(data.run_count ?? 0);
      if (data.scheduler) setScheduler(data.scheduler);
    } catch {}
    setLoading(false);
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/predict/schedule`);
      const data = await res.json();
      setScheduler(data);
    } catch {}
  }, []);

  const loadRiskContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const res = await fetch(`${API_BASE}/api/risk-context`);
      const data = await res.json();
      if (!data.error) {
        setRiskContext(data);
      }
    } catch {}
    setLoadingContext(false);
  }, []);

  const handleSaveRiskContext = async (updatedContext: any) => {
    setSavingContext(true);
    try {
      const res = await fetch(`${API_BASE}/api/risk-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedContext),
      });
      const data = await res.json();
      if (data.success) {
        setRiskContext(updatedContext);
        Alert.alert('Success', 'Risk context updated successfully!');
      } else {
        Alert.alert('Error', data.error || 'Failed to update risk context');
      }
    } catch {
      Alert.alert('Error', 'Network error. Failed to save context.');
    }
    setSavingContext(false);
  };

  useEffect(() => {
    loadPredictions();
    loadSchedule();
    loadRiskContext();
    // Auto-seed demo history so chart is never empty (idempotent)
    fetch(`${API_BASE}/api/predictions/history/seed`, { method: 'POST' }).catch(() => {});
    const id = setInterval(loadSchedule, 10_000);
    return () => {
      clearInterval(id);
      // Close any open SSE connection on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);


  const handleSetInterval = async (minutes: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/predict/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_minutes: minutes }),
      });
      const data = await res.json();
      setScheduler({
        interval_minutes: minutes,
        scheduled: minutes > 0,
        next_run_at: data.next_run_at ?? null,
        is_running: false,
      });
    } catch {}
  };

  const resetPipelineSteps = () => setPipelineSteps([
    { agent: 'sensor-analyst',  status: 'waiting' },
    { agent: 'pattern-matcher', status: 'waiting' },
    { agent: 'risk-scorer',     status: 'waiting' },
  ]);

  const handleRunNow = useCallback(() => {
    if (running) return;

    setRunning(true);
    setCoordMsg(null);
    resetPipelineSteps();

    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `${API_BASE}/api/predict/stream`;

    // React Native uses XMLHttpRequest to consume SSE (no native EventSource)
    const xhr = new XMLHttpRequest();
    eventSourceRef.current = xhr;
    let buffer = '';

    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(buffer.length);
      buffer = xhr.responseText;

      const lines = newText.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          const type: string = evt.type ?? '';

          if (type === 'SUBAGENT_START') {
            setPipelineSteps(prev => prev.map(s =>
              s.agent === evt.agent
                ? { ...s, status: 'running', message: evt.hint }
                : s.status === 'running' ? { ...s, status: 'waiting' } : s
            ));
          } else if (type === 'SUBAGENT_MSG') {
            setPipelineSteps(prev => prev.map(s =>
              s.agent === evt.agent ? { ...s, message: evt.message } : s
            ));
          } else if (type === 'SUBAGENT_DONE') {
            setPipelineSteps(prev => prev.map(s =>
              s.agent === evt.agent
                ? { ...s, status: evt.status === 'completed' ? 'done' : 'failed', message: undefined }
                : s
            ));
          } else if (type === 'PRED_COORDINATOR') {
            setCoordMsg(evt.message ?? null);
          } else if (type === 'PRED_COMPLETE') {
            if (evt.predictions) setPredictions(evt.predictions);
            if (evt.last_run)    setLastRun(evt.last_run);
            if (evt.run_count)   setRunCount(evt.run_count);
            // Mark all steps done
            setPipelineSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
            setRunning(false);
            xhr.abort();
          } else if (type === 'ERROR') {
            setRunning(false);
            xhr.abort();
          }
        } catch { /* non-JSON line, skip */ }
      }
    };

    xhr.onerror = () => setRunning(false);
    xhr.onloadend = () => setRunning(false);
    xhr.send();
  }, [running]);

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const highestRisk = predictions.reduce((max, p) =>
    p.final_risk_score > (max?.final_risk_score ?? -1) ? p : max, null as Prediction | null
  );

  return (
    <ScrollView
      style={pageStyles.screen}
      contentContainerStyle={pageStyles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={subTab === 'dashboard' ? loading : loadingContext}
          onRefresh={subTab === 'dashboard' ? loadPredictions : loadRiskContext}
          tintColor={Page.primary}
        />
      }
    >
      <ScreenHeader
        kicker="Predictive AI"
        title="Risk Forecast"
        subtitle="Proactive breach prediction · separate AI agent"
      />

      {/* ── Sub Tab Selector ────────────────────────────────── */}
      <View style={styles.subTabRow}>
        <TouchableOpacity
          style={[styles.subTabButton, subTab === 'dashboard' && styles.subTabActive]}
          onPress={() => setSubTab('dashboard')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="view-dashboard-outline" size={16} color={subTab === 'dashboard' ? '#FFF' : '#6B7280'} />
          <Text style={[styles.subTabTxt, subTab === 'dashboard' && styles.subTabTxtActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabButton, subTab === 'editor' && styles.subTabActive]}
          onPress={() => setSubTab('editor')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="cog-outline" size={16} color={subTab === 'editor' ? '#FFF' : '#6B7280'} />
          <Text style={[styles.subTabTxt, subTab === 'editor' && styles.subTabTxtActive]}>Edit Risk Data</Text>
        </TouchableOpacity>
      </View>

      {subTab === 'editor' ? (
        <RiskContextEditor
          context={riskContext}
          onSave={handleSaveRiskContext}
          saving={savingContext}
        />
      ) : (
        <>


      {/* ── Agent Info Banner ─────────────────────────────────── */}
      <GlassCard style={styles.infoBanner}>
        <MaterialCommunityIcons name="head-cog-outline" size={20} color="#7C3AED" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.infoTitle}>3-Stage Prediction Pipeline</Text>
          <Text style={styles.infoSub}>
            sensor-analyst → pattern-matcher → risk-scorer
          </Text>
        </View>
        {runCount > 0 && (
          <View style={styles.runCountBadge}>
            <Text style={styles.runCountTxt}>{runCount} runs</Text>
          </View>
        )}
      </GlassCard>

      {/* ── Schedule Configurator ────────────────────────────── */}
      <Text style={styles.sectionLabel}>AUTO-RUN SCHEDULE</Text>
      <GlassCard style={styles.scheduleCard}>
        <View style={styles.intervalGrid}>
          {INTERVAL_OPTIONS.map((opt) => {
            const active = scheduler.interval_minutes === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.intervalChip, active && styles.intervalChipActive]}
                onPress={() => handleSetInterval(opt.value)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={13}
                  color={active ? '#FFF' : '#6B7280'}
                />
                <Text style={[styles.intervalTxt, active && styles.intervalTxtActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Schedule status */}
        <View style={styles.scheduleStatus}>
          {scheduler.scheduled ? (
            <View style={styles.scheduleActive}>
              <View style={styles.schedDot} />
              <Text style={styles.schedTxt}>
                Running every <Text style={{ fontFamily: 'Inter_700Bold' }}>
                  {scheduler.interval_minutes} min
                </Text>
              </Text>
              <NextRunCountdown nextRunAt={scheduler.next_run_at} />
            </View>
          ) : (
            <View style={styles.scheduleOff}>
              <Ionicons name="pause-circle-outline" size={14} color="#9CA3AF" />
              <Text style={styles.schedOffTxt}>Scheduler off — run manually below</Text>
            </View>
          )}
        </View>
      </GlassCard>

      {/* ── Run Now Button ───────────────────────────────────── */}
      <Text style={styles.sectionLabel}>MANUAL TRIGGER</Text>
      <Animated.View style={{ transform: [{ scale: running ? pulseAnim : 1 }] }}>
        <TouchableOpacity
          style={[styles.runBtn, running && styles.runBtnDisabled]}
          onPress={handleRunNow}
          disabled={running}
          activeOpacity={0.85}
        >
          {running ? (
            <>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.runBtnTxt}>Predicting...</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="head-cog-outline" size={18} color="#FFF" />
              <Text style={styles.runBtnTxt}>Run Prediction Now</Text>
              <Ionicons name="flash" size={14} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {lastRun && (
        <Text style={styles.lastRunTxt}>Last run: {formatTime(lastRun)}</Text>
      )}

      {/* ── Agent Step Indicator (while running or just finished) ────── */}
      {(running || pipelineSteps.some(s => s.status !== 'waiting')) && (
        <GlassCard style={styles.pipelineCard}>
          <View style={styles.pipelineTitleRow}>
            <Text style={styles.pipelineTitle}>
              {running ? '🔄 Pipeline running…' : '✅ Pipeline complete'}
            </Text>
            {coordMsg && (
              <Text style={styles.coordMsg}>{coordMsg}</Text>
            )}
          </View>
          {pipelineSteps.map((step, i) => {
            const isDone    = step.status === 'done';
            const isRunning = step.status === 'running';
            const isFailed  = step.status === 'failed';
            return (
              <View key={step.agent} style={styles.pipelineStep}>
                {/* Status icon */}
                {isRunning && <ActivityIndicator size="small" color="#7C3AED" />}
                {isDone    && <Ionicons name="checkmark-circle" size={16} color="#059669" />}
                {isFailed  && <Ionicons name="close-circle" size={16} color="#DC2626" />}
                {step.status === 'waiting' && (
                  <View style={styles.waitingDot} />
                )}
                {/* Label */}
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.pipelineStepTxt,
                    isDone    && { color: '#059669' },
                    isFailed  && { color: '#DC2626' },
                    isRunning && { color: '#7C3AED', fontFamily: 'Inter_600SemiBold' },
                  ]}>
                    Step {i + 1}: {step.agent}
                  </Text>
                  {isRunning && step.message && (
                    <Text style={styles.pipelineStepSub}>{step.message}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </GlassCard>
      )}

      {/* ── Top Risk Alert ───────────────────────────────────── */}
      {highestRisk && highestRisk.risk_level !== 'SAFE' && (
        <View style={[styles.topRiskAlert, { borderColor: `${RISK_COLORS[highestRisk.risk_level]}40`, backgroundColor: RISK_BG[highestRisk.risk_level] }]}>
          <Ionicons name="warning" size={18} color={RISK_COLORS[highestRisk.risk_level]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.topRiskTitle, { color: RISK_COLORS[highestRisk.risk_level] }]}>
              Highest Risk: {highestRisk.shipment_id}
            </Text>
            <Text style={styles.topRiskSub}>{highestRisk.prediction_summary}</Text>
          </View>
        </View>
      )}

      {/* ── Prediction Cards ─────────────────────────────────── */}
      {predictions.length === 0 && !running ? (
        <GlassCard style={styles.emptyCard}>
          <MaterialCommunityIcons name="shield-search" size={36} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No predictions yet</Text>
          <Text style={styles.emptySub}>
            Tap "Run Prediction Now" or set an auto schedule above.
          </Text>
        </GlassCard>
      ) : (
        <>
          <Text style={styles.sectionLabel}>RISK FORECAST PER SHIPMENT</Text>
          {predictions.map((p) => {
            const color = RISK_COLORS[p.risk_level] ?? '#6B7280';
            const bg    = RISK_BG[p.risk_level]    ?? '#F9FAFB';
            const brd   = RISK_BORDER[p.risk_level] ?? '#E5E7EB';
            const expanded = expandedId === p.shipment_id;

            return (
              <TouchableOpacity
                key={p.shipment_id}
                activeOpacity={0.9}
                onPress={() => setExpandedId(expanded ? null : p.shipment_id)}
              >
                <GlassCard style={[styles.riskCard, { borderColor: brd, backgroundColor: bg }]}>
                  {/* Card Header */}
                  <View style={styles.riskCardTop}>
                    <RiskRing score={p.final_risk_score} color={color} />
                    <View style={{ flex: 1, marginLeft: 12, gap: 4 }}>
                      <View style={styles.riskTitleRow}>
                        <Text style={styles.riskShipId}>{p.shipment_id}</Text>
                        <View style={[styles.riskLevelBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
                          <Text style={[styles.riskLevelTxt, { color }]}>{p.risk_level}</Text>
                        </View>
                      </View>
                      <Text style={styles.riskCargo}>{p.cargo_type}</Text>
                      <Text style={[styles.riskSummary, { color: '#374151' }]} numberOfLines={2}>
                        {p.prediction_summary}
                      </Text>
                    </View>
                  </View>

                  {/* Breach probability bar */}
                  <View style={styles.probRow}>
                    <Text style={styles.probLabel}>Breach probability</Text>
                    <Text style={[styles.probPct, { color }]}>{p.breach_probability_percent}%</Text>
                  </View>
                  <View style={styles.probBarBg}>
                    <View style={[styles.probBarFill, { width: `${p.breach_probability_percent}%` as any, backgroundColor: color }]} />
                  </View>

                  {/* Urgency tag */}
                  <View style={[styles.urgencyRow, { borderColor: `${color}20` }]}>
                    <Text style={[styles.urgencyTxt, { color }]}>
                      {URGENCY_LABEL[p.action_urgency] ?? p.action_urgency}
                    </Text>
                    {p.estimated_breach_in_minutes !== null && (
                      <Text style={styles.urgencyEta}>
                        ~{p.estimated_breach_in_minutes} min to breach
                      </Text>
                    )}
                  </View>

                  {/* Expandable detail */}
                  {expanded && (
                    <View style={styles.expandedSection}>
                      <Text style={styles.expandLabel}>TOP TRIGGERS</Text>
                      {p.top_triggers.map((t, i) => (
                        <View key={i} style={styles.triggerRow}>
                          <View style={[styles.triggerDot, { backgroundColor: color }]} />
                          <Text style={styles.triggerTxt}>{t}</Text>
                        </View>
                      ))}

                      <Text style={styles.expandLabel}>RECOMMENDED ACTION</Text>
                      <Text style={styles.actionTxt}>{p.recommended_action}</Text>

                      <View style={styles.confidenceRow}>
                        <Text style={styles.confidenceTxt}>
                          AI Confidence: <Text style={{ color, fontFamily: 'Inter_700Bold' }}>
                            {Math.round(p.confidence * 100)}%
                          </Text>
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.expandHint}>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={14} color="#9CA3AF"
                    />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      <View style={{ height: 40 }} />

      {/* ── Risk History Chart ────────────────────────────────── */}
      <Text style={styles.sectionLabel}>RISK HISTORY CHART</Text>
      <GlassCard style={styles.historyCard}>
        <RiskHistoryChart />
      </GlassCard>

        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 99,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  subTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 99,
  },
  subTabActive: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  subTabTxt: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#6B7280',
  },
  subTabTxtActive: {
    color: '#FFF',
  },
  // Info banner

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, marginBottom: 20,
    backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1,
  },
  infoTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#4C1D95' },
  infoSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#7C3AED' },
  runCountBadge: {
    backgroundColor: '#7C3AED', paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 99,
  },
  runCountTxt: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFF' },

  // Section labels
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#9CA3AF',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginTop: 4,
  },

  // Schedule configurator
  scheduleCard: { padding: 14, marginBottom: 20 },
  intervalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  intervalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  intervalChipActive: { backgroundColor: Page.primary, borderColor: Page.primary },
  intervalTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#6B7280' },
  intervalTxtActive: { color: '#FFF' },
  scheduleStatus: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  scheduleActive: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  schedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  schedTxt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#374151' },
  scheduleOff: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  schedOffTxt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF' },

  // Run now
  runBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7C3AED', paddingVertical: 15, borderRadius: 99,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    marginBottom: 6,
  },
  runBtnDisabled: { backgroundColor: '#A78BFA', shadowOpacity: 0 },
  runBtnTxt: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFF' },
  lastRunTxt: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },

  // Pipeline indicator
  pipelineCard: { padding: 14, marginBottom: 16, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF', borderWidth: 1 },
  pipelineTitleRow: { marginBottom: 8 },
  pipelineTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#4C1D95' },
  coordMsg: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#7C3AED', marginTop: 3, fontStyle: 'italic' },
  pipelineStep: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, minHeight: 32 },
  waitingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  pipelineStepTxt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF' },
  pipelineStepSub: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#A78BFA', marginTop: 1 },

  // Top risk alert
  topRiskAlert: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16,
  },
  topRiskTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  topRiskSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#374151', marginTop: 2 },

  // Empty state
  emptyCard: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#374151' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19 },

  // History chart
  historyCard: { padding: 16, marginBottom: 12 },

  // Risk cards
  riskCard: { marginBottom: 12, padding: 14, borderWidth: 1 },
  riskCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  riskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  riskShipId: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#111827' },
  riskLevelBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, borderWidth: 1,
  },
  riskLevelTxt: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  riskCargo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280' },
  riskSummary: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  probRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  probLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6B7280' },
  probPct: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  probBarBg: { height: 6, borderRadius: 99, backgroundColor: '#F3F4F6', overflow: 'hidden', marginBottom: 10 },
  probBarFill: { height: '100%', borderRadius: 99 },
  urgencyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, borderTopWidth: 1,
  },
  urgencyTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  urgencyEta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF' },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  expandLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#9CA3AF',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 8,
  },
  triggerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  triggerDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  triggerTxt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#374151', flex: 1, lineHeight: 18 },
  actionTxt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#1F2937', lineHeight: 18 },
  confidenceRow: { marginTop: 8 },
  confidenceTxt: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6B7280' },
  expandHint: { alignItems: 'center', marginTop: 6 },
});
