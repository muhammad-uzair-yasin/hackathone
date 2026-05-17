import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';
import type { RoutePoint } from '../types/shipment';

interface Props {
  stops: RoutePoint[];
  label?: string;
  accent?: string;
}

export default function RouteStops({ stops, label, accent = Colors.primary }: Props) {
  if (!stops?.length) return null;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {stops.map((p, i) => (
        <View key={`${p.place}-${i}`} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: accent }]}>
            <Text style={styles.dotNum}>{i + 1}</Text>
          </View>
          <Text style={styles.place}>{p.place}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  label: { ...Typography.labelMD, color: Colors.outline, marginBottom: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotNum: { fontSize: 10, fontWeight: '700', color: Colors.white },
  place: { ...Typography.bodySM, color: Colors.onSurface, flex: 1 },
});
