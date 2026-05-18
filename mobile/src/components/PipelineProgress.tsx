import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily, pageStyles, Page } from '../theme';
import type { PipelinePhase } from '../types/timeline';

interface Props {
  phase: PipelinePhase;
  percent: number;
  label: string;
  todosDone: number;
  todosTotal: number;
  agentsDone: number;
  agentsTotal: number;
}

export default function PipelineProgress({
  phase,
  percent,
  label,
  todosDone,
  todosTotal,
  agentsDone,
  agentsTotal,
}: Props) {
  const fillColor =
    phase === 'error' ? '#DC2626' : phase === 'complete' ? '#059669' : Page.primary;

  return (
    <View style={pageStyles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.pct}>{Math.round(percent)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, percent)}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={styles.meta}>
        Plan {todosDone}/{todosTotal || '—'} · Agents {agentsDone}/{agentsTotal || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#111827', flex: 1 },
  pct: { fontFamily: FontFamily.bold, fontSize: 14, color: Page.primary },
  track: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  meta: { fontFamily: FontFamily.regular, fontSize: 12, color: '#6B7280', marginTop: 10 },
});
