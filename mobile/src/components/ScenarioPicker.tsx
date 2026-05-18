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
import { Ionicons } from '@expo/vector-icons';
import type { Scenario } from '../types/shipment';
import { Colors, Spacing, BorderRadius, FontFamily } from '../theme';

interface Props {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (scenario: Scenario) => void;
  disabled?: boolean;
  variant?: 'default' | 'embedded';
}

export default function ScenarioPicker({
  scenarios,
  selectedId,
  onSelect,
  disabled,
  variant = 'default',
}: Props) {
  const embedded = variant === 'embedded';
  const [open, setOpen] = useState(false);
  const selected = scenarios.find((s) => s.id === selectedId);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          embedded && styles.triggerEmbedded,
          disabled && styles.triggerDisabled,
        ]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <View style={styles.triggerText}>
          <Text style={styles.triggerLabel}>Test scenario</Text>
          <Text
            style={[styles.triggerValue, !selected && styles.triggerPlaceholder]}
            numberOfLines={2}
          >
            {selected ? selected.label : 'Choose a scenario to load...'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  triggerEmbedded: { marginBottom: 0 },
  triggerDisabled: { opacity: 0.5 },
  triggerText: { flex: 1 },
  triggerLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  triggerValue: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  triggerPlaceholder: {
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  sheetTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: Colors.textMuted,
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
  optionActive: { backgroundColor: '#EFF6FF' },
  optionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  optionMeta: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },
  cancelBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.textSecondary },
});
