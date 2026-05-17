import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
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
  const barColor =
    phase === 'error' ? Colors.error : phase === 'complete' ? '#059669' : Colors.primary;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.pct}>{Math.round(percent)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, percent)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.meta}>
        Plan {todosDone}/{todosTotal || '—'} · Agents {agentsDone}/{agentsTotal || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  label: { ...Typography.bodySM, color: Colors.onSurface, fontWeight: '600', flex: 1 },
  pct: { ...Typography.labelMD, color: Colors.primary, fontWeight: '700' },
  track: {
    height: 6,
    backgroundColor: `${Colors.outlineVariant}66`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  meta: { ...Typography.labelMD, color: Colors.outline, marginTop: Spacing.xs },
});
