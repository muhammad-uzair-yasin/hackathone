/**
 * Outcome — before/after from live agent run + summary.md
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import ScreenHeader from '../components/ScreenHeader';
import ReasonMarkdownPanel from '../components/ReasonMarkdownPanel';
import { FontFamily, pageStyles, Page } from '../theme';

const OUTCOME_HERO = require('../../assets/outcome-hero.png');

function OutcomeHero() {
  return (
    <View style={styles.heroCard} pointerEvents="none">
      <Image source={OUTCOME_HERO} style={styles.heroImg} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(249,250,251,0.85)', '#F9FAFB']}
        style={styles.heroFade}
      />
    </View>
  );
}

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

  const hasData = Boolean(beforeState || afterState);

  const toggleView = (view: 'before' | 'after') => {
    if (view === 'after' && !afterState) return;
    if (view === 'before' && !beforeState) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.98, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]),
    ]).start();
    setActiveView(view);
  };

  if (!hasData && !summaryMarkdown) {
    return (
      <ScrollView style={pageStyles.screen} contentContainerStyle={pageStyles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          kicker="Outcome"
          title="Run outcome"
          subtitle="Before and after fleet state from the agent run"
        />
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
        <OutcomeHero />
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

  const current = activeView === 'before' ? beforeState! : afterState || beforeState!;
  const isBefore = activeView === 'before' || !afterState;
  const shipmentLabel = current.shipmentId.replace('SHP-', '#');

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

      <OutcomeHero />

      {summaryMarkdown ? (
        <ReasonMarkdownPanel markdown={summaryMarkdown} fileName={summaryFile} defaultOpen />
      ) : null}

      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, isBefore && styles.toggleOn]}
            onPress={() => toggleView('before')}
            disabled={!beforeState}
          >
            <Text style={[styles.toggleTxt, isBefore && styles.toggleTxtOn]}>Before</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !isBefore && styles.toggleOn]}
            onPress={() => toggleView('after')}
            disabled={!afterState}
          >
            <Text style={[styles.toggleTxt, !isBefore && styles.toggleTxtOn]}>After</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.shipTitle}>Shipment {shipmentLabel}</Text>
        <Text style={styles.shipSub}>{current.cargo}</Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <GlassCard style={styles.detailCard}>
          <View style={[styles.tag, isBefore ? styles.tagBefore : styles.tagAfter]}>
            <Text style={[styles.tagTxt, !isBefore && styles.tagTxtAfter]}>
              {isBefore ? 'Baseline' : 'After agent'}
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
              <Text style={styles.rerouteTxt}>Emergency reroute applied</Text>
            </View>
          ) : null}
        </GlassCard>
      </Animated.View>

      {!afterState && beforeState && pipelineComplete ? (
        <Text style={styles.waiting}>
          No fleet changes this run — the agent finished analysis without an emergency reroute.
        </Text>
      ) : !afterState ? (
        <Text style={styles.waiting}>After view appears when the agent updates the route.</Text>
      ) : null}

      {!summaryMarkdown && onRefreshSummary ? (
        <TouchableOpacity style={pageStyles.secondaryBtn} onPress={onRefreshSummary}>
          <Ionicons name="document-text-outline" size={16} color="#6B7280" />
          <Text style={pageStyles.secondaryBtnText}>Load summary</Text>
        </TouchableOpacity>
      ) : null}

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

function StateRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
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
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 21,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  doneText: { fontFamily: FontFamily.semiBold, fontSize: 10, color: '#059669' },
  heroCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heroImg: {
    width: '100%',
    height: 168,
    backgroundColor: '#F3F4F6',
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
  },
  toggleWrap: { alignItems: 'center', marginBottom: 16 },
  toggle: {
    flexDirection: 'row',
    padding: 3,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 12,
  },
  toggleBtn: { paddingHorizontal: 22, paddingVertical: 8, borderRadius: 8 },
  toggleOn: { backgroundColor: '#FFF' },
  toggleTxt: { fontFamily: FontFamily.medium, fontSize: 13, color: '#6B7280' },
  toggleTxtOn: { fontFamily: FontFamily.semiBold, color: Page.primary },
  shipTitle: { fontFamily: FontFamily.semiBold, fontSize: 16, color: '#111827' },
  shipSub: { fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280', marginTop: 2 },
  detailCard: { padding: 16, marginBottom: 12 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  tagBefore: { backgroundColor: '#F3F4F6' },
  tagAfter: { backgroundColor: '#EFF6FF' },
  tagTxt: { fontFamily: FontFamily.semiBold, fontSize: 11, color: '#6B7280' },
  tagTxtAfter: { color: Page.primary },
  grid: { gap: 0 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Page.border,
  },
  rowLbl: { fontFamily: FontFamily.medium, fontSize: 13, color: '#6B7280' },
  rowVal: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#111827',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  reroute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Page.border,
  },
  rerouteTxt: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#059669' },
  waiting: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
  },
});
