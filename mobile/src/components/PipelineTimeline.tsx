import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import type { TimelineEvent } from '../types/timeline';

const KIND_ICON: Record<string, string> = {
  connected: '⚡',
  todo: '📋',
  coordinator: '🧠',
  delegate: '📤',
  subagent_start: '▶',
  subagent_msg: '💭',
  subagent_done: '✓',
  tool_call: '🔧',
  tool_result: '✔',
  step_summary: '📌',
  reason: '📝',
  complete: '🏁',
  error: '✕',
};

interface Props {
  events: TimelineEvent[];
  masterOpen: boolean;
  onToggleMaster: () => void;
}

function EventRow({ ev }: { ev: TimelineEvent }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const icon = KIND_ICON[ev.kind] || '•';

  return (
    <View style={styles.event}>
      <View style={styles.dotCol}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.line} />
      </View>
      <View style={styles.eventBody}>
        <Text style={styles.eventTitle}>{ev.title}</Text>
        {ev.subtitle ? <Text style={styles.eventSub}>{ev.subtitle}</Text> : null}
        {ev.body ? <Text style={styles.eventBodyText}>{ev.body}</Text> : null}
        {ev.detail ? (
          <>
            <TouchableOpacity onPress={() => setDetailOpen((o) => !o)} activeOpacity={0.7}>
              <Text style={styles.detailToggle}>{detailOpen ? 'Hide detail ▲' : 'Show detail ▼'}</Text>
            </TouchableOpacity>
            {detailOpen ? <Text style={styles.detail}>{ev.detail}</Text> : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function PipelineTimeline({ events, masterOpen, onToggleMaster }: Props) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.master} onPress={onToggleMaster} activeOpacity={0.8}>
        <View style={styles.masterLeft}>
          <Text style={styles.masterLabel}>Full pipeline trace</Text>
          <Text style={styles.masterSub}>{events.length} events</Text>
        </View>
        <Text style={styles.chevron}>{masterOpen ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {masterOpen ? (
        events.length === 0 ? (
          <Text style={styles.empty}>Events appear here as the orchestrator and subagents run.</Text>
        ) : (
          events.map((ev) => <EventRow key={ev.id} ev={ev} />)
        )
      ) : null}
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
  event: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  dotCol: { width: 28, alignItems: 'center' },
  icon: { fontSize: 14 },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: `${Colors.outlineVariant}44`,
    marginTop: 4,
    minHeight: 8,
  },
  eventBody: { flex: 1, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: `${Colors.outlineVariant}33` },
  eventTitle: { ...Typography.bodySM, color: Colors.onSurface, fontWeight: '600' },
  eventSub: { ...Typography.labelMD, color: Colors.primary, marginTop: 2 },
  eventBodyText: { ...Typography.bodySM, color: Colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
  detailToggle: { ...Typography.labelMD, color: Colors.outline, marginTop: 6 },
  detail: {
    ...Typography.labelMD,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
});
