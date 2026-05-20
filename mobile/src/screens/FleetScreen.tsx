import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import RouteStops from '../components/RouteStops';
import { fetchBaselineShipments, fetchDbShipments } from '../api/client';
import type { Shipment } from '../types/shipment';
import { FontFamily, Page } from '../theme';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({ android: 'http://10.0.2.2:8000', ios: 'http://localhost:8000', default: 'http://localhost:8000' });

interface HistoryEntry {
  timestamp: string;
  shipment_id?: string;
  before_route?: string;
  after_route?: string;
  after_status?: string;
  event: string;
}

interface Props {
  onSelectShipment: (s: Shipment) => void;
  highlightId?: string | null;
  refreshKey?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusMeta(status: string): { color: string; bg: string; icon: string; pulse: boolean } {
  if (/reroute/i.test(status))  return { color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle', pulse: true };
  if (/delay|risk|alert/i.test(status)) return { color: '#F97316', bg: '#FFF7ED', icon: 'warning', pulse: true };
  if (/transit|active|time/i.test(status)) return { color: '#10B981', bg: '#ECFDF5', icon: 'checkmark-circle', pulse: false };
  return { color: '#2563EB', bg: '#EFF6FF', icon: 'information-circle', pulse: false };
}

function cargoIcon(cargo: string): string {
  if (/blood|plasma/i.test(cargo)) return 'water';
  if (/vaccine|covid/i.test(cargo)) return 'medical';
  if (/insulin|biolog/i.test(cargo)) return 'flask';
  if (/organ/i.test(cargo)) return 'heart';
  return 'cube';
}

function cargoColor(cargo: string): string {
  if (/blood|plasma/i.test(cargo)) return '#EF4444';
  if (/vaccine/i.test(cargo)) return '#3B82F6';
  if (/insulin/i.test(cargo)) return '#8B5CF6';
  if (/organ/i.test(cargo)) return '#EC4899';
  return '#6B7280';
}

function etaLabel(minutes?: number): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// ── Pulse dot component ───────────────────────────────────────────────────────

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.9, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, opacity, transform: [{ scale }],
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

// ── ETA Ring ─────────────────────────────────────────────────────────────────

function EtaRing({ minutes, color }: { minutes?: number; color: string }) {
  return (
    <View style={[styles.etaRing, { borderColor: `${color}30`, backgroundColor: `${color}0D` }]}>
      <Ionicons name="time-outline" size={11} color={color} />
      <Text style={[styles.etaVal, { color }]}>{etaLabel(minutes)}</Text>
    </View>
  );
}

// ── Shipment Card ─────────────────────────────────────────────────────────────

function ShipCard({
  s, highlighted, onPress,
}: { s: Shipment; highlighted: boolean; onPress: () => void }) {
  const sm = statusMeta(s.current_status);
  const cIcon = cargoIcon(s.cargo_type);
  const cColor = cargoColor(s.cargo_type);
  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.cardTouch}>
        <View style={[styles.card, highlighted && styles.cardHighlighted]}>
          {/* Accent bar */}
          <View style={[styles.accentBar, { backgroundColor: highlighted ? Page.primary : cColor }]} />

          <View style={styles.cardInner}>
            {/* Top row */}
            <View style={styles.cardTop}>
              {/* Cargo icon badge */}
              <View style={[styles.cargoIconWrap, { backgroundColor: `${cColor}15` }]}>
                <Ionicons name={cIcon as any} size={20} color={cColor} />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.idRow}>
                  <Text style={styles.shipId}>{s.shipment_id}</Text>
                  {highlighted && (
                    <View style={styles.alertBadge}>
                      <Text style={styles.alertBadgeTxt}>🎯 AFFECTED</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cargoTxt} numberOfLines={1}>{s.cargo_type}</Text>
              </View>

              {/* Status pill with pulse */}
              <View style={[styles.statusPill, { backgroundColor: sm.bg }]}>
                {sm.pulse && <PulseDot color={sm.color} />}
                {!sm.pulse && <Ionicons name={sm.icon as any} size={10} color={sm.color} />}
                <Text style={[styles.statusTxt, { color: sm.color }]} numberOfLines={1}>
                  {s.current_status.replace(/\s*\(.*?\)/, '')}
                </Text>
              </View>
            </View>

            {/* Route name + ETA */}
            <View style={styles.routeMeta}>
              <Ionicons name="navigate-outline" size={13} color="#6B7280" />
              <Text style={styles.routeName} numberOfLines={1}>{s.route_name}</Text>
              <EtaRing minutes={s.eta_minutes} color={sm.color} />
            </View>

            {/* Route stops mini-timeline */}
            <RouteStops stops={s.route.slice(0, 3)} accent={cColor} />

            {/* Footer */}
            <View style={styles.cardFoot}>
              <View style={styles.altTag}>
                <Ionicons name="git-branch-outline" size={11} color="#7C3AED" />
                <Text style={styles.altTxt}>{s.alternative_routes.length} alt routes</Text>
              </View>
              <View style={styles.destTag}>
                <Ionicons name="location-outline" size={11} color="#6B7280" />
                <Text style={styles.destTxt} numberOfLines={1}>{s.destination}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function FleetScreen({ onSelectShipment, highlightId, refreshKey = 0 }: Props) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const live = await fetchDbShipments();
    setShipments(live.length ? live : await fetchBaselineShipments());
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      const data = await res.json();
      setHistory((data.history ?? []).slice().reverse());
    } catch {}
    setHistoryLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { if (historyOpen) void loadHistory(); }, [historyOpen]);

  const activeCount = shipments.filter(s => !/complete|delivered/i.test(s.current_status)).length;
  const alertCount = shipments.filter(s => /reroute|delay|risk|alert/i.test(s.current_status)).length;
  const altTotal = shipments.reduce((n, s) => n + s.alternative_routes.length, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#7C3AED" />}
    >
      {/* ── Premium Gradient Header ─────────────────────────── */}
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4338CA']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroKicker}>🇵🇰 PAKISTAN COLD-CHAIN</Text>
            <Text style={styles.heroTitle}>Fleet Command</Text>
            <Text style={styles.heroSub}>Live biomedical logistics network</Text>
          </View>
          <View style={styles.heroBadge}>
            <PulseDot color="#10B981" />
            <Text style={styles.heroBadgeTxt}>LIVE</Text>
          </View>
        </View>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          {[
            { label: 'Total', value: shipments.length, icon: 'truck-outline', color: '#A5B4FC' },
            { label: 'In Transit', value: activeCount, icon: 'navigate', color: '#34D399' },
            { label: 'Alerts', value: alertCount, icon: 'alert-circle', color: alertCount > 0 ? '#FCA5A5' : '#A5B4FC' },
            { label: 'Alt Routes', value: altTotal, icon: 'git-branch-outline', color: '#C4B5FD' },
          ].map((k) => (
            <View key={k.label} style={styles.kpi}>
              <Ionicons name={k.icon as any} size={14} color={k.color} />
              <Text style={[styles.kpiVal, { color: k.color }]}>{k.value}</Text>
              <Text style={styles.kpiLbl}>{k.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* ── Section label ───────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>ACTIVE SHIPMENTS</Text>
        <Text style={styles.sectionSub}>Tap for full details</Text>
      </View>

      {/* ── Ship Cards ─────────────────────────────────────── */}
      {loading && !shipments.length ? (
        <ActivityIndicator color="#7C3AED" style={{ marginTop: 32 }} />
      ) : (
        shipments.map((s) => (
          <ShipCard
            key={s.shipment_id}
            s={s}
            highlighted={highlightId === s.shipment_id}
            onPress={() => onSelectShipment(s)}
          />
        ))
      )}

      {/* ── Incident History ────────────────────────────────── */}
      <TouchableOpacity
        style={styles.historyBtn}
        onPress={() => setHistoryOpen(o => !o)}
        activeOpacity={0.8}
      >
        <View style={styles.historyBtnLeft}>
          <Ionicons name="time-outline" size={16} color="#7C3AED" />
          <Text style={styles.historyBtnTxt}>Incident History Log</Text>
        </View>
        <View style={styles.historyBtnRight}>
          {historyLoading && <ActivityIndicator size="small" color="#7C3AED" />}
          <Ionicons name={historyOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
        </View>
      </TouchableOpacity>

      {historyOpen && (
        <GlassCard style={styles.historyCard}>
          {history.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Ionicons name="folder-open-outline" size={24} color="#D1D5DB" />
              <Text style={styles.historyEmptyTxt}>No incidents logged yet.</Text>
              <Text style={styles.historyEmptySub}>Run the agent to generate history.</Text>
            </View>
          ) : (
            history.slice(0, 10).map((entry, idx) => {
              const isReroute = /reroute/i.test(entry.after_status ?? '');
              return (
                <View key={idx} style={[styles.historyRow, idx > 0 && styles.historyRowBorder]}>
                  <View style={[styles.historyDot, { backgroundColor: isReroute ? '#7C3AED' : '#10B981' }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.historyRowTop}>
                      <View style={[styles.historyTag, { backgroundColor: isReroute ? '#EDE9FE' : '#ECFDF5' }]}>
                        <Text style={[styles.historyTagTxt, { color: isReroute ? '#7C3AED' : '#059669' }]}>
                          {isReroute ? '⚡ REROUTED' : '✓ UPDATED'}
                        </Text>
                      </View>
                      <Text style={styles.historyShipId}>{entry.shipment_id ?? '—'}</Text>
                      <Text style={styles.historyTime}>
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Text>
                    </View>
                    {(entry.before_route || entry.after_route) && (
                      <Text style={styles.historyRoute} numberOfLines={1}>
                        {entry.before_route ?? '—'} → {entry.after_route ?? '—'}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </GlassCard>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 },

  // Hero
  heroCard: {
    borderRadius: 20, padding: 20, marginBottom: 20,
    shadowColor: '#312E81', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  heroKicker: { fontFamily: FontFamily.semiBold, fontSize: 10, color: '#A5B4FC', letterSpacing: 1.2, marginBottom: 4 },
  heroTitle: { fontFamily: FontFamily.bold, fontSize: 26, color: '#FFF', letterSpacing: -0.5 },
  heroSub: { fontFamily: FontFamily.regular, fontSize: 13, color: '#C7D2FE', marginTop: 2 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
  },
  heroBadgeTxt: { fontFamily: FontFamily.bold, fontSize: 11, color: '#34D399', letterSpacing: 1 },

  // KPIs
  kpiRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 12, gap: 4,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 3 },
  kpiVal: { fontFamily: FontFamily.bold, fontSize: 20 },
  kpiLbl: { fontFamily: FontFamily.regular, fontSize: 10, color: '#C7D2FE', textAlign: 'center' },

  // Section
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: 11, color: '#374151', letterSpacing: 1 },
  sectionSub: { fontFamily: FontFamily.regular, fontSize: 11, color: '#9CA3AF' },

  // Card
  cardTouch: { marginBottom: 12 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  cardHighlighted: { borderColor: '#7C3AED', borderWidth: 1.5 },
  accentBar: { width: 4, borderRadius: 0 },
  cardInner: { flex: 1, padding: 14 },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cargoIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  shipId: { fontFamily: FontFamily.bold, fontSize: 15, color: '#111827' },
  alertBadge: {
    backgroundColor: '#EDE9FE', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  alertBadgeTxt: { fontFamily: FontFamily.bold, fontSize: 9, color: '#7C3AED', letterSpacing: 0.5 },
  cargoTxt: { fontFamily: FontFamily.regular, fontSize: 12, color: '#6B7280' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
    maxWidth: 120,
  },
  statusTxt: { fontFamily: FontFamily.semiBold, fontSize: 10 },

  routeMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  routeName: { fontFamily: FontFamily.medium, fontSize: 12, color: '#374151', flex: 1 },
  etaRing: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  etaVal: { fontFamily: FontFamily.bold, fontSize: 10 },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1F5F9',
  },
  altTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F3FF', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  altTxt: { fontFamily: FontFamily.semiBold, fontSize: 11, color: '#7C3AED' },
  destTag: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  destTxt: { fontFamily: FontFamily.regular, fontSize: 11, color: '#9CA3AF', flex: 1 },

  // History
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
  },
  historyBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyBtnTxt: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#374151' },
  historyBtnRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyCard: { padding: 8, marginBottom: 12, overflow: 'hidden' },
  historyEmpty: { alignItems: 'center', padding: 24, gap: 6 },
  historyEmptyTxt: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#6B7280' },
  historyEmptySub: { fontFamily: FontFamily.regular, fontSize: 12, color: '#9CA3AF' },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10 },
  historyRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6' },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  historyRowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  historyTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  historyTagTxt: { fontFamily: FontFamily.bold, fontSize: 9, letterSpacing: 0.3 },
  historyShipId: { fontFamily: FontFamily.semiBold, fontSize: 12, color: '#374151', flex: 1 },
  historyTime: { fontFamily: FontFamily.regular, fontSize: 10, color: '#9CA3AF' },
  historyRoute: { fontFamily: FontFamily.regular, fontSize: 11, color: '#6B7280' },
});
