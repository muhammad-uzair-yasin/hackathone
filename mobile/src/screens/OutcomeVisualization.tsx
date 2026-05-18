/**
 * Outcome — before/after from live agent run + summary.md
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedOutcomeHero from '../components/AnimatedOutcomeHero';
import GlassCard from '../components/GlassCard';
import ScreenHeader from '../components/ScreenHeader';
import ReasonMarkdownPanel from '../components/ReasonMarkdownPanel';
import { FontFamily, pageStyles, Page } from '../theme';

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
  const [activeView, setActiveView] = useState<'before' | 'after'>(
    afterState ? 'after' : 'before'
  );

  const hasData = Boolean(beforeState || afterState);
  const canShowBefore = Boolean(beforeState);
  const canShowAfter = Boolean(afterState);

  useEffect(() => {
    if (!afterState && activeView === 'after') {
      setActiveView('before');
    }
  }, [afterState, activeView]);

  const toggleView = (view: 'before' | 'after') => {
    if (view === activeView) return;
    if (view === 'after' && !canShowAfter) return;
    if (view === 'before' && !canShowBefore) return;
    setActiveView(view);
  };

  const isBefore = activeView === 'before';

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
    afterState &&
      beforeState &&
      (afterState.route !== beforeState.route ||
        afterState.status !== beforeState.status ||
        afterState.destination !== beforeState.destination)
  );

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

      <AnimatedOutcomeHero celebrate={fleetUpdated && pipelineComplete} />

      {summaryMarkdown ? (
        <ReasonMarkdownPanel markdown={summaryMarkdown} fileName={summaryFile} defaultOpen />
      ) : null}

      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, isBefore && styles.toggleOn, !canShowBefore && styles.toggleDisabled]}
            onPress={() => toggleView('before')}
            disabled={!canShowBefore}
          >
            <Text style={[styles.toggleTxt, isBefore && styles.toggleTxtOn]}>Before</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, !isBefore && styles.toggleOn, !canShowAfter && styles.toggleDisabled]}
            onPress={() => toggleView('after')}
            disabled={!canShowAfter}
          >
            <Text style={[styles.toggleTxt, !isBefore && styles.toggleTxtOn]}>After</Text>
          </Pressable>
        </View>
        <Text style={styles.shipTitle}>Shipment {shipmentLabel}</Text>
        <Text style={styles.shipSub}>{current.cargo}</Text>
      </View>

      <View key={activeView}>
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
      </View>

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
  toggleWrap: { alignItems: 'center', marginBottom: 16 },
  toggle: {
    flexDirection: 'row',
    padding: 3,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 12,
  },
  toggleBtn: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: '#FFF' },
  toggleDisabled: { opacity: 0.45 },
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
