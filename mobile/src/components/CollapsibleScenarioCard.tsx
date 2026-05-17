import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Scenario } from '../types/shipment';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface Props {
  scenario: Scenario;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

export default function CollapsibleScenarioCard({
  scenario,
  expanded,
  selected,
  onToggle,
  onSelect,
}: Props) {
  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.75}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{scenario.label}</Text>
          <Text style={styles.meta}>
            {scenario.hazard_type}
            {scenario.affects_shipment ? ` · ${scenario.affects_shipment}` : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.bodyText}>{scenario.text}</Text>
          <TouchableOpacity
            style={[styles.selectBtn, selected && styles.selectBtnActive]}
            onPress={onSelect}
            activeOpacity={0.8}
          >
            <Text style={[styles.selectBtnText, selected && styles.selectBtnTextActive]}>
              {selected ? '✓ Selected for agent' : 'Use this alert'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceBright,
    overflow: 'hidden',
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  headerText: { flex: 1 },
  title: { ...Typography.bodyMD, color: Colors.onSurface, fontWeight: '600' },
  meta: { ...Typography.labelMD, color: Colors.primary, marginTop: 2 },
  chevron: { fontSize: 11, color: Colors.outline, paddingLeft: Spacing.xs },
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: `${Colors.outlineVariant}55`,
  },
  bodyText: {
    ...Typography.bodySM,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  selectBtn: {
    marginTop: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  selectBtnActive: { backgroundColor: Colors.primary },
  selectBtnText: { ...Typography.labelMD, color: Colors.primary },
  selectBtnTextActive: { color: Colors.white },
});
