import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import type { Scenario } from '../types/shipment';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface Props {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (scenario: Scenario) => void;
  disabled?: boolean;
}

export default function ScenarioPicker({
  scenarios,
  selectedId,
  onSelect,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = scenarios.find((s) => s.id === selectedId);

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <View style={styles.triggerText}>
          <Text style={styles.triggerLabel}>Test scenario</Text>
          <Text style={styles.triggerValue} numberOfLines={2}>
            {selected ? selected.label : 'Choose a scenario to load…'}
          </Text>
        </View>
        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Load scenario</Text>
            <FlatList
              data={scenarios}
              keyExtractor={(item) => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionTitle}>{item.label}</Text>
                    <Text style={styles.optionMeta}>
                      {item.hazard_type}
                      {item.affects_shipment ? ` · ${item.affects_shipment}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceBright,
    marginBottom: Spacing.md,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerText: { flex: 1 },
  triggerLabel: { ...Typography.labelMD, color: Colors.outline, marginBottom: 2 },
  triggerValue: { ...Typography.bodyMD, color: Colors.onSurface, fontWeight: '500' },
  chevron: { fontSize: 12, color: Colors.outline, marginLeft: Spacing.sm },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: Colors.surfaceBright,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  sheetTitle: {
    ...Typography.labelMD,
    color: Colors.outline,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  list: { maxHeight: 360 },
  option: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.outlineVariant}55`,
  },
  optionActive: { backgroundColor: `${Colors.primary}12` },
  optionTitle: { ...Typography.bodyMD, color: Colors.onSurface, fontWeight: '600' },
  optionMeta: { ...Typography.labelMD, color: Colors.primary, marginTop: 2 },
  cancelBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { ...Typography.labelMD, color: Colors.onSurfaceVariant },
});
