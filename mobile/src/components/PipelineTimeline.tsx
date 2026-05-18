import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FontFamily, Page, pageStyles } from '../theme';
import type { TimelineEvent } from '../types/timeline';

function KindIcon({ kind }: { kind: string }) {
  const color = kind === 'error' ? '#DC2626' : kind === 'complete' ? '#059669' : '#4B5563';
  const map: Record<string, React.ReactNode> = {
    connected: <Ionicons name="flash-outline" size={15} color={color} />,
    todo: <Ionicons name="list-outline" size={15} color={color} />,
    coordinator: <MaterialCommunityIcons name="brain" size={15} color={color} />,
    delegate: <Ionicons name="send-outline" size={15} color={color} />,
    subagent_start: <Ionicons name="play-outline" size={15} color={color} />,
    subagent_msg: <Ionicons name="chatbubble-outline" size={15} color={color} />,
    subagent_done: <Ionicons name="checkmark-circle-outline" size={15} color={color} />,
    tool_call: <Ionicons name="construct-outline" size={15} color={color} />,
    tool_result: <Ionicons name="checkmark-done-outline" size={15} color={color} />,
    step_summary: <Ionicons name="bookmark-outline" size={15} color={color} />,
    reason: <Ionicons name="document-text-outline" size={15} color={color} />,
    complete: <Ionicons name="flag-outline" size={15} color={color} />,
    error: <Ionicons name="close-circle-outline" size={15} color={color} />,
  };
  return map[kind] ?? <Ionicons name="ellipse-outline" size={15} color={color} />;
}

function EventRow({ ev }: { ev: TimelineEvent }) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <View style={styles.event}>
      <View style={styles.iconCol}>
        <View style={styles.iconBox}>
          <KindIcon kind={ev.kind} />
        </View>
      </View>
      <View style={styles.eventBody}>
        <Text style={styles.eventTitle}>{ev.title}</Text>
        {ev.subtitle ? <Text style={styles.eventSub}>{ev.subtitle}</Text> : null}
        {ev.body ? <Text style={styles.eventTxt}>{ev.body}</Text> : null}
        {ev.detail ? (
          <>
            <TouchableOpacity onPress={() => setDetailOpen((o) => !o)}>
              <Text style={styles.detailToggle}>{detailOpen ? 'Hide' : 'Show'} detail</Text>
            </TouchableOpacity>
            {detailOpen ? <Text style={styles.detail}>{ev.detail}</Text> : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

interface Props {
  events: TimelineEvent[];
  masterOpen: boolean;
  onToggleMaster: () => void;
}

export default function PipelineTimeline({ events, masterOpen, onToggleMaster }: Props) {
  return (
    <View style={[pageStyles.card, styles.wrap]}>
      <TouchableOpacity style={styles.master} onPress={onToggleMaster} activeOpacity={0.7}>
        <View style={styles.masterLeft}>
          <Text style={styles.masterTitle}>Full pipeline trace</Text>
          <Text style={styles.masterSub}>{events.length} events</Text>
        </View>
        <Ionicons name={masterOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#9CA3AF" />
      </TouchableOpacity>
      {masterOpen ? (
        events.length === 0 ? (
          <Text style={styles.empty}>Events appear as the pipeline runs.</Text>
        ) : (
          events.map((ev) => <EventRow key={ev.id} ev={ev} />)
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 0, overflow: 'hidden' },
  master: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Page.border,
  },
  masterLeft: { flex: 1 },
  masterTitle: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#111827' },
  masterSub: { fontFamily: FontFamily.regular, fontSize: 13, color: '#6B7280', marginTop: 2 },
  empty: { fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280', padding: 16 },
  event: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  iconCol: { width: 36 },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Page.border,
    paddingBottom: 10,
  },
  eventTitle: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#111827' },
  eventSub: { fontFamily: FontFamily.medium, fontSize: 12, color: Page.primary, marginTop: 2 },
  eventTxt: { fontFamily: FontFamily.regular, fontSize: 13, color: '#6B7280', marginTop: 4 },
  detailToggle: { fontFamily: FontFamily.medium, fontSize: 12, color: Page.primary, marginTop: 6 },
  detail: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});
