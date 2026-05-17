import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import type { AgentActivity } from '../types/agent';

interface Props {
  activities: AgentActivity[];
  masterOpen: boolean;
  onToggleMaster: () => void;
  onToggleActivity: (id: string) => void;
}

export default function ReasoningAccordion({
  activities,
  masterOpen,
  onToggleMaster,
  onToggleActivity,
}: Props) {
  const doneCount = activities.filter((a) => a.status === 'done').length;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.master} onPress={onToggleMaster} activeOpacity={0.8}>
        <View style={styles.masterLeft}>
          <Text style={styles.masterLabel}>Live agents</Text>
          <Text style={styles.masterSub}>
            {activities.length === 0
              ? 'Waiting for first agent…'
              : `${doneCount}/${activities.length} complete`}
          </Text>
        </View>
        <Text style={styles.chevron}>{masterOpen ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {masterOpen && activities.length === 0 ? (
        <Text style={styles.empty}>Agents appear here as the orchestrator delegates work.</Text>
      ) : null}

      {masterOpen &&
        activities.map((a, index) => (
          <View key={a.id} style={styles.stepBlock}>
            <TouchableOpacity
              style={styles.stepHeader}
              onPress={() => onToggleActivity(a.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.stepChevron}>{a.expanded ? '▼' : '▶'}</Text>
              <View
                style={[
                  styles.stepNum,
                  a.status === 'done' && styles.stepNumDone,
                  a.status === 'active' && styles.stepNumActive,
                  a.status === 'error' && styles.stepNumError,
                ]}
              >
                <Text style={styles.stepNumText}>
                  {a.status === 'done' ? '✓' : index + 1}
                </Text>
              </View>
              <View style={styles.stepPreview}>
                <Text style={styles.stepTitle}>{a.label}</Text>
                <Text style={styles.stepWhat} numberOfLines={a.expanded ? 4 : 2}>
                  {a.what || (a.status === 'active' ? 'Working…' : '—')}
                </Text>
              </View>
            </TouchableOpacity>
            {a.expanded && (
              <View style={styles.stepBody}>
                {a.why ? (
                  <Text style={styles.why}>
                    <Text style={styles.whyLabel}>Why: </Text>
                    {a.why}
                  </Text>
                ) : null}
                {a.extra ? <Text style={styles.extra}>{a.extra}</Text> : null}
              </View>
            )}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surfaceBright,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.primary}33`,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  master: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: `${Colors.primaryContainer}12`,
  },
  masterLeft: { flex: 1 },
  masterLabel: { ...Typography.labelMD, color: Colors.primary },
  masterSub: { ...Typography.bodySM, color: Colors.onSurface, marginTop: 2 },
  chevron: { color: Colors.outline, fontSize: 12 },
  empty: {
    ...Typography.bodySM,
    color: Colors.onSurfaceVariant,
    padding: Spacing.md,
    fontStyle: 'italic',
  },
  stepBlock: { borderTopWidth: 1, borderTopColor: `${Colors.outlineVariant}33` },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.md, gap: Spacing.sm },
  stepChevron: { color: Colors.outline, fontSize: 10, marginTop: 4 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNumDone: { backgroundColor: '#059669', borderColor: '#059669' },
  stepNumError: { backgroundColor: Colors.error, borderColor: Colors.error },
  stepNumText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  stepPreview: { flex: 1 },
  stepTitle: { ...Typography.labelSM, color: Colors.outline, textTransform: 'uppercase' },
  stepWhat: { ...Typography.bodySM, color: Colors.onSurface, marginTop: 2 },
  stepBody: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingLeft: 48 },
  why: { ...Typography.bodySM, color: Colors.primary },
  whyLabel: { fontWeight: '700' },
  extra: { ...Typography.labelMD, color: Colors.onSurfaceVariant, marginTop: Spacing.sm },
});
