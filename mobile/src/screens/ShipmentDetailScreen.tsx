import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import RouteStops from '../components/RouteStops';
import type { Shipment } from '../types/shipment';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface Props {
  shipment: Shipment;
  onClose: () => void;
}

export default function ShipmentDetailScreen({ shipment, onClose }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{shipment.shipment_id}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.cargo}>{shipment.cargo_type}</Text>
        <Text style={styles.meta}>{shipment.current_status} · ETA {shipment.eta_minutes ?? '—'} min</Text>

        <Text style={styles.section}>Active route</Text>
        <Text style={styles.routeName}>{shipment.route_name}</Text>
        <RouteStops stops={shipment.route} label="Stops" />

        <Text style={[styles.section, { marginTop: Spacing.lg }]}>
          Alternate routes ({shipment.alternative_routes.length})
        </Text>
        {shipment.alternative_routes.map((alt) => (
          <View key={alt.id} style={styles.altCard}>
            <Text style={styles.altName}>
              {alt.id} · {alt.name}
            </Text>
            {alt.notes ? <Text style={styles.altNotes}>{alt.notes}</Text> : null}
            {alt.eta_minutes != null ? (
              <Text style={styles.altEta}>ETA ~{alt.eta_minutes} min</Text>
            ) : null}
            <RouteStops stops={alt.stops} accent="#6366f1" />
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  closeBtn: { marginRight: Spacing.md },
  closeText: { ...Typography.bodyMD, color: Colors.primary },
  headerTitle: { ...Typography.headlineSM, color: Colors.onSurface },
  content: { padding: Spacing.lg },
  cargo: { ...Typography.headlineMD, color: Colors.onSurface },
  meta: { ...Typography.bodySM, color: Colors.outline, marginBottom: Spacing.lg },
  section: { ...Typography.labelMD, color: Colors.outline, textTransform: 'uppercase' },
  routeName: { ...Typography.bodyMD, color: Colors.primary, marginVertical: Spacing.sm },
  altCard: {
    backgroundColor: Colors.surfaceBright,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.outlineVariant}55`,
  },
  altName: { ...Typography.bodyMD, fontWeight: '600', color: Colors.onSurface },
  altNotes: { ...Typography.bodySM, color: Colors.onSurfaceVariant, marginTop: 4 },
  altEta: { ...Typography.labelMD, color: Colors.primary, marginTop: 2, marginBottom: Spacing.sm },
});
