import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import GlassCard from '../components/GlassCard';
import RouteStops from '../components/RouteStops';
import { fetchBaselineShipments, fetchDbShipments } from '../api/client';
import type { Shipment } from '../types/shipment';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface Props {
  onSelectShipment: (s: Shipment) => void;
  highlightId?: string | null;
  refreshKey?: number;
}

export default function FleetScreen({ onSelectShipment, highlightId, refreshKey = 0 }: Props) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const live = await fetchDbShipments();
    const data = live.length ? live : await fetchBaselineShipments();
    setShipments(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>Active fleet</Text>
      <Text style={styles.subtitle}>Pakistan cold-chain routes · tap for details & alternatives</Text>

      {loading && !shipments.length ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      ) : (
        shipments.map((s) => {
          const highlighted = highlightId === s.shipment_id;
          return (
            <TouchableOpacity
              key={s.shipment_id}
              onPress={() => onSelectShipment(s)}
              activeOpacity={0.85}
            >
              <GlassCard
                style={highlighted ? { ...styles.card, ...styles.cardHighlight } : styles.card}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.id}>🚚 {s.shipment_id}</Text>
                  <Text style={styles.status}>{s.current_status}</Text>
                </View>
                <Text style={styles.cargo}>{s.cargo_type}</Text>
                <Text style={styles.routeName}>{s.route_name}</Text>
                <RouteStops stops={s.route.slice(0, 3)} />
                <Text style={styles.altHint}>
                  {s.alternative_routes.length} alternate routes on file →
                </Text>
              </GlassCard>
            </TouchableOpacity>
          );
        })
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  title: { ...Typography.headlineMD, color: Colors.onSurface },
  subtitle: { ...Typography.bodySM, color: Colors.onSurfaceVariant, marginBottom: Spacing.md },
  card: { marginBottom: Spacing.md, padding: Spacing.md },
  cardHighlight: { borderWidth: 2, borderColor: Colors.primary },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  id: { ...Typography.headlineSM, color: Colors.onSurface },
  status: { ...Typography.labelMD, color: Colors.primary, maxWidth: '50%', textAlign: 'right' },
  cargo: { ...Typography.bodySM, color: Colors.onSurfaceVariant },
  routeName: { ...Typography.labelMD, color: Colors.primary, marginVertical: Spacing.sm },
  altHint: { ...Typography.labelSM, color: Colors.outline, marginTop: Spacing.sm },
});
