import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily } from '../theme';
import type { RoutePoint } from '../types/shipment';

interface Props {
  stops: RoutePoint[];
  label?: string;
  accent?: string;
}

export default function RouteStops({ stops, label, accent = '#2563EB' }: Props) {
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
  wrap: { gap: 6 },
  label: { fontFamily: FontFamily.medium, fontSize: 11, color: '#6B7280', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotNum: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFF' },
  place: { fontFamily: FontFamily.regular, fontSize: 13, color: '#111827', flex: 1 },
});
