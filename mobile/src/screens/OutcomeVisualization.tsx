/**
 * Outcome — before/after fleet state + 3-way notification chat bubbles
 * + confidence score badge + PDF download
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedOutcomeHero from '../components/AnimatedOutcomeHero';
import GlassCard from '../components/GlassCard';
import ScreenHeader from '../components/ScreenHeader';
import ReasonMarkdownPanel from '../components/ReasonMarkdownPanel';
import { WebView } from 'react-native-webview';
import MAP_HTML from '../constants/mapHtml';
import { FontFamily, pageStyles, Page } from '../theme';

const API_BASE = process.env.EXPO_PUBLIC_API_URL
  ?? Platform.select({ android: 'http://10.0.2.2:8000', ios: 'http://localhost:8000', default: 'http://localhost:8000' });

export interface ShipmentState {
  shipmentId: string;
  cargo: string;
  route: string;
  destination: string;
  status: string;
  temp: string;
}

interface NotifBubble {
  type: 'driver' | 'hospital' | 'coordinator';
  label: string;
  icon: string;
  message: string;
  channel: string;
  color: string;
  bgColor: string;
  alignRight: boolean;
}

interface RouteStop {
  place: string;
  lat: number;
  lon?: number;
  lng?: number;
}

interface Props {
  beforeState?: ShipmentState;
  afterState?: ShipmentState;
  pipelineComplete?: boolean;
  summaryMarkdown?: string | null;
  summaryFile?: string;
  onRefreshSummary?: () => void;
  beforeStops?: RouteStop[];
  afterStops?: RouteStop[];
}

export default function OutcomeVisualization({
  beforeState,
  afterState,
  pipelineComplete,
  summaryMarkdown,
  summaryFile,
  onRefreshSummary,
  beforeStops,
  afterStops,
}: Props) {
  const [activeView, setActiveView] = useState<'before' | 'after' | 'map'>(
    afterState ? 'after' : 'before'
  );
  const [notifications, setNotifications] = useState<NotifBubble[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const webViewRef = React.useRef<any>(null);

  const hasData = Boolean(beforeState || afterState);
  const canShowBefore = Boolean(beforeState);
  const canShowAfter = Boolean(afterState);
  const canShowMap = Boolean(beforeStops?.length || afterStops?.length);

  useEffect(() => {
    if (!afterState && activeView === 'after') setActiveView('before');
  }, [afterState, activeView]);

  // Load notifications & confidence when pipeline completes
  useEffect(() => {
    if (!pipelineComplete) return;
    loadNotifications();
    loadConfidence();
  }, [pipelineComplete]);

  const loadNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const res = await fetch(`${API_BASE}/api/notifications`);
      const data = await res.json();
      const notifs: NotifBubble[] = [];

      for (const n of (data.notifications ?? [])) {
        const type = n.recipient_type as string;
        if (type === 'driver') {
          notifs.push({
            type: 'driver',
            label: `🚚 Driver (${n.shipment_id})`,
            icon: 'car-outline',
            message: n.message ?? '',
            channel: 'SMS + Radio',
            color: '#7C3AED',
            bgColor: '#F5F3FF',
            alignRight: false,
          });
        } else if (type === 'hospital') {
          notifs.push({
            type: 'hospital',
            label: `🏥 ${n.recipient ?? 'Hospital'}`,
            icon: 'medical-outline',
            message: n.message ?? '',
            channel: 'Email',
            color: '#059669',
            bgColor: '#ECFDF5',
            alignRight: true,
          });
        } else if (type === 'coordinator') {
          notifs.push({
            type: 'coordinator',
            label: `📡 Fleet Coordinator`,
            icon: 'radio-outline',
            message: n.message ?? '',
            channel: 'Email + Dashboard',
            color: '#D97706',
            bgColor: '#FFFBEB',
            alignRight: false,
          });
        }
      }
      setNotifications(notifs);
    } catch {}
    setLoadingNotifs(false);
  };

  const loadConfidence = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/summary`);
      const data = await res.json();
      const pipeline = data?.session?.pipeline ?? {};
      const actionPlan = pipeline?.step_4_action_plan ?? {};
      const score = actionPlan?.confidence_score;
      if (typeof score === 'number') setConfidenceScore(score);
    } catch {}
  };

  const handleDownloadPdf = async () => {
    setLoadingPdf(true);
    try {
      const url = `${API_BASE}/api/summary/pdf`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('PDF Download', `Open this URL in your browser:\n${url}`);
      }
    } catch {
      Alert.alert('Error', 'Could not open PDF. Ensure the backend is running.');
    }
    setLoadingPdf(false);
  };

  const toggleView = (view: 'before' | 'after' | 'map') => {
    if (view === activeView) return;
    if (view === 'after' && !canShowAfter) return;
    if (view === 'before' && !canShowBefore) return;
    if (view === 'map' && !canShowMap) return;
    setActiveView(view);

    // When switching to map, post route data to WebView
    if (view === 'map' && webViewRef.current) {
      setTimeout(() => {
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'ROUTE_DATA',
          before: beforeStops ?? [],
          after: afterStops ?? [],
        }));
      }, 600);
    }
  };

  const isBefore = activeView === 'before';
  const isMap = activeView === 'map';

  if (!hasData && !summaryMarkdown) {
    return (
      <ScrollView style={pageStyles.screen} contentContainerStyle={pageStyles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader kicker="Outcome" title="Run outcome" subtitle="Before and after fleet state from the agent run" />
        <View style={[pageStyles.card, styles.empty]}>
          <Ionicons name="analytics-outline" size={32} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No outcome yet</Text>
          <Text style={styles.emptyBody}>
            Run the agent from the News tab. After a reroute completes, shipment data appears here.
          </Text>
        </View>
      </ScrollView>
    );
  }

  if (!hasData && summaryMarkdown) {
    return (
      <ScrollView style={pageStyles.screen} contentContainerStyle={pageStyles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader kicker="Outcome" title="Run outcome" subtitle="Why the route changed" />
        <AnimatedOutcomeHero celebrate={false} />
        <ReasonMarkdownPanel markdown={summaryMarkdown} fileName={summaryFile} />
        {onRefreshSummary ? (
          <TouchableOpacity style={pageStyles.secondaryBtn} onPress={onRefreshSummary}>
            <Ionicons name="refresh-outline" size={16} color="#6B7280" />
            <Text style={pageStyles.secondaryBtnText}>Reload summary</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  }

  const current =
    activeView === 'before'
      ? beforeState ?? afterState!
      : afterState ?? beforeState!;
  const shipmentLabel = current.shipmentId.replace('SHP-', '#');
  const fleetUpdated = Boolean(
    afterState && beforeState &&
    (afterState.route !== beforeState.route ||
      afterState.status !== beforeState.status ||
      afterState.destination !== beforeState.destination)
  );

  const confidenceLevel =
    confidenceScore === null ? null
    : confidenceScore >= 0.85 ? 'high'
    : confidenceScore >= 0.65 ? 'medium'
    : 'low';

  const confidenceColors: Record<string, string> = {
    high: '#059669', medium: '#D97706', low: '#DC2626',
  };

  return (
    <ScrollView style={pageStyles.screen} contentContainerStyle={pageStyles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        kicker="Outcome"
        title="Run outcome"
        subtitle={pipelineComplete ? 'Agent run complete' : 'Snapshot from last run'}
        right={
          pipelineComplete ? (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={styles.doneText}>Done</Text>
            </View>
          ) : null
        }
      />

      <AnimatedOutcomeHero celebrate={fleetUpdated && !!pipelineComplete} />

      {/* ── Confidence Score Badge ──────────────────────────── */}
      {confidenceScore !== null && confidenceLevel && (
        <GlassCard style={styles.confidenceCard}>
          <View style={styles.confidenceRow}>
            <MaterialCommunityIcons name="head-cog-outline" size={18} color={confidenceColors[confidenceLevel]} />
            <Text style={styles.confidenceLabel}>AI Confidence</Text>
            <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColors[confidenceLevel]}15`, borderColor: `${confidenceColors[confidenceLevel]}40` }]}>
              <Text style={[styles.confidenceScore, { color: confidenceColors[confidenceLevel] }]}>
                {Math.round(confidenceScore * 100)}%
              </Text>
              <Text style={[styles.confidenceLevel, { color: confidenceColors[confidenceLevel] }]}>
                {confidenceLevel.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.confidenceBar}>
            <View style={[styles.confidenceBarFill, {
              width: `${Math.round(confidenceScore * 100)}%` as any,
              backgroundColor: confidenceColors[confidenceLevel],
            }]} />
          </View>
        </GlassCard>
      )}

      {summaryMarkdown ? (
        <ReasonMarkdownPanel markdown={summaryMarkdown} fileName={summaryFile} defaultOpen />
      ) : null}

      {/* ── Before / After Toggle ────────────────────────── */}
      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, isBefore && styles.toggleOn, !canShowBefore && styles.toggleDisabled]}
            onPress={() => toggleView('before')}
            disabled={!canShowBefore}
          >
            <Text style={[styles.toggleTxt, isBefore && styles.toggleTxtOn]}>📍 Before</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, activeView === 'after' && styles.toggleOn, !canShowAfter && styles.toggleDisabled]}
            onPress={() => toggleView('after')}
            disabled={!canShowAfter}
          >
            <Text style={[styles.toggleTxt, activeView === 'after' && styles.toggleTxtOn]}>✅ After</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, isMap && styles.toggleOnMap, !canShowMap && styles.toggleDisabled]}
            onPress={() => toggleView('map')}
            disabled={!canShowMap}
          >
            <Text style={[styles.toggleTxt, isMap && styles.toggleTxtOn]}>🗺️ Map</Text>
          </Pressable>
        </View>
        <Text style={styles.shipTitle}>Shipment {shipmentLabel}</Text>
        <Text style={styles.shipSub}>{current.cargo}</Text>
      </View>

      {isMap ? (
        // Full-height Leaflet map
        <View style={styles.mapWrap}>
          <WebView
            ref={webViewRef}
            source={{ html: MAP_HTML }}
            originWhitelist={['*']}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            javaScriptEnabled
            onLoad={() => {
              // Post route data once WebView is loaded
              setTimeout(() => {
                webViewRef.current?.postMessage(JSON.stringify({
                  type: 'ROUTE_DATA',
                  before: beforeStops ?? [],
                  after: afterStops ?? [],
                }));
              }, 300);
            }}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'MAP_READY') {
                  webViewRef.current?.postMessage(JSON.stringify({
                    type: 'ROUTE_DATA',
                    before: beforeStops ?? [],
                    after: afterStops ?? [],
                  }));
                }
              } catch {}
            }}
            style={styles.mapView}
          />
          {afterStops && afterStops.length > 0 && (
            <View style={styles.mapBadge}>
              <Text style={styles.mapBadgeTxt}>🤖 AI Rerouted</Text>
            </View>
          )}
        </View>
      ) : (
      <View key={activeView}>
        <GlassCard style={styles.detailCard}>
          <View style={[styles.tag, isBefore ? styles.tagBefore : styles.tagAfter]}>
            <Text style={[styles.tagTxt, !isBefore && styles.tagTxtAfter]}>
              {isBefore ? 'Baseline Route' : 'After Agent Reroute'}
            </Text>
          </View>

          <View style={styles.grid}>
            <StateRow label="Shipment" value={current.shipmentId} />
            <StateRow label="Cargo" value={current.cargo} />
            <StateRow label="Route" value={current.route} />
            <StateRow label="Destination" value={current.destination} />
            <StateRow
              label="Status"
              value={current.status}
              highlight={/reroute/i.test(current.status) ? '#DC2626' : '#059669'}
            />
            {current.temp !== '—' ? <StateRow label="Temperature" value={current.temp} /> : null}
          </View>

          {!isBefore && /reroute/i.test(current.status) ? (
            <View style={styles.reroute}>
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <Text style={styles.rerouteTxt}>Emergency reroute applied by AI agent</Text>
            </View>
          ) : null}
        </GlassCard>
      </View>
      )}

      {!afterState && beforeState && pipelineComplete ? (
        <Text style={styles.waiting}>
          No fleet changes this run — the agent finished analysis without an emergency reroute.
        </Text>
      ) : !afterState ? (
        <Text style={styles.waiting}>After view appears when the agent updates the route.</Text>
      ) : null}

      {/* ── 3-Way Notification Chat Bubbles ─────────────── */}
      {pipelineComplete && (
        <View style={styles.notifSection}>
          <View style={styles.notifHeader}>
            <Ionicons name="chatbubbles-outline" size={16} color={Page.primary} />
            <Text style={styles.notifTitle}>Notifications Sent</Text>
            {loadingNotifs && <ActivityIndicator size="small" color={Page.primary} />}
          </View>
          <Text style={styles.notifSub}>3 recipients notified simultaneously</Text>

          {notifications.length === 0 && !loadingNotifs ? (
            <View style={styles.noNotif}>
              <Text style={styles.noNotifTxt}>Notifications load after agent completes step 6.</Text>
              <TouchableOpacity onPress={loadNotifications} style={styles.reloadBtn}>
                <Ionicons name="refresh-outline" size={14} color={Page.primary} />
                <Text style={styles.reloadTxt}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.chatPane}>
              {notifications.map((n, idx) => (
                <View
                  key={idx}
                  style={[styles.bubble, n.alignRight && styles.bubbleRight]}
                >
                  <Text style={[styles.bubbleAvatar, n.alignRight && { textAlign: 'right' }]}>
                    {n.label}
                  </Text>
                  <View style={[
                    styles.bubbleBody,
                    { backgroundColor: n.bgColor, borderColor: `${n.color}30` },
                    n.alignRight && styles.bubbleBodyRight,
                  ]}>
                    <Text style={[styles.bubbleText, { color: '#1F2937' }]}>
                      {n.message.slice(0, 280)}{n.message.length > 280 ? '…' : ''}
                    </Text>
                  </View>
                  <View style={[styles.bubbleFooter, n.alignRight && { justifyContent: 'flex-end' }]}>
                    <Ionicons name="checkmark-done-outline" size={11} color={n.color} />
                    <Text style={[styles.bubbleChannel, { color: n.color }]}>{n.channel}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── PDF Download ─────────────────────────────────── */}
      {pipelineComplete && (
        <TouchableOpacity
          style={[styles.pdfBtn, loadingPdf && styles.pdfBtnDisabled]}
          onPress={handleDownloadPdf}
          disabled={loadingPdf}
          activeOpacity={0.85}
        >
          {loadingPdf ? (
            <ActivityIndicator size="small" color="#6366F1" />
          ) : (
            <Ionicons name="document-text-outline" size={16} color="#6366F1" />
          )}
          <Text style={styles.pdfBtnTxt}>Download Run Report (PDF)</Text>
        </TouchableOpacity>
      )}

      {!summaryMarkdown && onRefreshSummary ? (
        <TouchableOpacity style={pageStyles.secondaryBtn} onPress={onRefreshSummary}>
          <Ionicons name="document-text-outline" size={16} color="#6B7280" />
          <Text style={pageStyles.secondaryBtnText}>Load summary</Text>
        </TouchableOpacity>
      ) : null}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StateRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLbl}>{label}</Text>
      <Text style={[styles.rowVal, highlight ? { color: highlight } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: 16, color: '#111827', marginTop: 12 },
  emptyBody: {
    fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280',
    textAlign: 'center', marginTop: 6, lineHeight: 21,
  },

  // Done badge
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
  },
  doneText: { fontFamily: FontFamily.semiBold, fontSize: 10, color: '#059669' },

  // Confidence
  confidenceCard: { padding: 14, marginBottom: 14 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  confidenceLabel: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#374151', flex: 1 },
  confidenceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1,
  },
  confidenceScore: { fontFamily: FontFamily.bold, fontSize: 15 },
  confidenceLevel: { fontFamily: FontFamily.semiBold, fontSize: 9, letterSpacing: 0.8 },
  confidenceBar: {
    height: 5, borderRadius: 99, backgroundColor: '#F3F4F6', overflow: 'hidden',
  },
  confidenceBarFill: { height: '100%', borderRadius: 99 },

  // Before/After toggle
  toggleWrap: { alignItems: 'center', marginBottom: 16 },
  toggle: {
    flexDirection: 'row', padding: 3,
    backgroundColor: '#F3F4F6', borderRadius: 10, marginBottom: 12,
  },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  toggleOn: { backgroundColor: '#FFF' },
  toggleOnMap: { backgroundColor: '#ECFDF5' },
  toggleDisabled: { opacity: 0.45 },
  toggleTxt: { fontFamily: FontFamily.medium, fontSize: 13, color: '#6B7280' },
  toggleTxtOn: { fontFamily: FontFamily.semiBold, color: Page.primary },
  shipTitle: { fontFamily: FontFamily.semiBold, fontSize: 16, color: '#111827' },
  shipSub: { fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280', marginTop: 2 },

  // Map view
  mapWrap: { height: 340, borderRadius: 14, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  mapView: { flex: 1 },
  mapBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(124,58,237,0.9)', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  mapBadgeTxt: { fontFamily: FontFamily.semiBold, fontSize: 12, color: '#FFF' },

  // Detail card
  detailCard: { padding: 16, marginBottom: 12 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 12 },
  tagBefore: { backgroundColor: '#F3F4F6' },
  tagAfter: { backgroundColor: '#EFF6FF' },
  tagTxt: { fontFamily: FontFamily.semiBold, fontSize: 11, color: '#6B7280' },
  tagTxtAfter: { color: Page.primary },
  grid: { gap: 0 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Page.border,
  },
  rowLbl: { fontFamily: FontFamily.medium, fontSize: 13, color: '#6B7280' },
  rowVal: {
    fontFamily: FontFamily.semiBold, fontSize: 14, color: '#111827',
    flex: 1, textAlign: 'right', marginLeft: 12,
  },
  reroute: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Page.border,
  },
  rerouteTxt: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#059669' },
  waiting: {
    fontFamily: FontFamily.regular, fontSize: 13, color: '#9CA3AF',
    textAlign: 'center', marginBottom: 12,
  },

  // Notification chat bubbles
  notifSection: { marginBottom: 16 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  notifTitle: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#111827', flex: 1 },
  notifSub: { fontFamily: FontFamily.regular, fontSize: 12, color: '#9CA3AF', marginBottom: 10 },
  noNotif: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  noNotifTxt: { fontFamily: FontFamily.regular, fontSize: 12, color: '#9CA3AF', flex: 1 },
  reloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reloadTxt: { fontFamily: FontFamily.semiBold, fontSize: 12, color: Page.primary },
  chatPane: {
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  bubble: { maxWidth: '88%', alignSelf: 'flex-start', gap: 3 },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleAvatar: { fontFamily: FontFamily.semiBold, fontSize: 10, color: '#6B7280', paddingHorizontal: 4 },
  bubbleBody: {
    padding: 10,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleBodyRight: { borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 18 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  bubbleChannel: { fontFamily: FontFamily.medium, fontSize: 10 },

  // PDF Download
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 99,
    borderWidth: 1, borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    marginBottom: 12,
  },
  pdfBtnDisabled: { opacity: 0.6 },
  pdfBtnTxt: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#4F46E5' },
});
