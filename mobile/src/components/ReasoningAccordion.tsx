import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, Page, pageStyles } from '../theme';
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
  const skippedCount = activities.filter((a) => a.status === 'error').length;

  return (
    <View style={[pageStyles.card, styles.wrap]}>
      <TouchableOpacity style={styles.master} onPress={onToggleMaster} activeOpacity={0.7}>
        <View style={styles.masterLeft}>
          <Text style={styles.masterTitle}>Live agents</Text>
          <Text style={styles.masterSub}>
            {activities.length === 0
              ? 'Waiting for first agent…'
              : skippedCount > 0
                ? `${doneCount}/${activities.length} complete · ${skippedCount} skipped`
                : `${doneCount}/${activities.length} complete`}
          </Text>
        </View>
        <Ionicons
          name={masterOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#9CA3AF"
        />
      </TouchableOpacity>

      {masterOpen && activities.length === 0 ? (
        <Text style={styles.empty}>Agents appear here as work is delegated.</Text>
      ) : null}

      {masterOpen &&
        activities.map((a, index) => (
          <View key={a.id} style={styles.step}>
            <TouchableOpacity
              style={styles.stepHead}
              onPress={() => onToggleActivity(a.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={a.expanded ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color="#9CA3AF"
              />
              <View
                style={[
                  styles.num,
                  a.status === 'done' && styles.numDone,
                  a.status === 'active' && styles.numActive,
                  a.status === 'error' && styles.numErr,
                ]}
              >
                {a.status === 'done' ? (
                  <Ionicons name="checkmark" size={11} color="#FFF" />
                ) : (
                  <Text style={styles.numTxt}>{index + 1}</Text>
                )}
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepLabel}>{a.label}</Text>
                <Text style={styles.stepWhat} numberOfLines={a.expanded ? 4 : 2}>
                  {a.what || (a.status === 'active' ? 'Working…' : '—')}
                </Text>
              </View>
            </TouchableOpacity>
            {a.expanded && (
              <View style={styles.stepDetail}>
                {a.why ? (
                  <Text style={styles.why}>
                    <Text style={styles.whyBold}>Why: </Text>
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
  empty: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#6B7280',
    padding: 16,
  },
  step: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Page.border },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 8 },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Page.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numActive: { backgroundColor: Page.primary, borderColor: Page.primary },
  numDone: { backgroundColor: '#059669', borderColor: '#059669' },
  numErr: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  numTxt: { fontFamily: FontFamily.bold, fontSize: 10, color: '#6B7280' },
  stepBody: { flex: 1 },
  stepLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepWhat: { fontFamily: FontFamily.regular, fontSize: 14, color: '#111827', marginTop: 2 },
  stepDetail: { paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 48 },
  why: { fontFamily: FontFamily.regular, fontSize: 14, color: '#374151', lineHeight: 20 },
  whyBold: { fontFamily: FontFamily.semiBold },
  extra: { fontFamily: FontFamily.regular, fontSize: 12, color: '#6B7280', marginTop: 8 },
});
