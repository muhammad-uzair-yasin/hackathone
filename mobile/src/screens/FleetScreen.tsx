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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import ScreenHeader from '../components/ScreenHeader';
import RouteStops from '../components/RouteStops';
import { fetchBaselineShipments, fetchDbShipments } from '../api/client';
import type { Shipment } from '../types/shipment';
import { FontFamily, pageStyles, Page } from '../theme';

interface Props {
  onSelectShipment: (s: Shipment) => void;
  highlightId?: string | null;
  refreshKey?: number;
}

function statusColor(status: string): string {
  if (/reroute|delay|alert|risk/i.test(status)) return '#DC2626';
  if (/transit|active|ok/i.test(status)) return '#059669';
  return '#2563EB';
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

  const activeCount = shipments.filter((s) => !/complete|delivered/i.test(s.current_status)).length;
  const altTotal = shipments.reduce((n, s) => n + s.alternative_routes.length, 0);

  return (
    <ScrollView
      style={pageStyles.screen}
      contentContainerStyle={pageStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Page.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        kicker="Fleet"
        title="Active fleet"
        subtitle="Pakistan cold-chain routes · tap a shipment for details"
        right={
          <View style={styles.countBox}>
            <Text style={styles.countNum}>{shipments.length}</Text>
            <Text style={styles.countLbl}>routes</Text>
          </View>
        }
      />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <MaterialCommunityIcons name="truck-outline" size={18} color="#4B5563" />
          <Text style={styles.statVal}>{shipments.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="navigate-outline" size={18} color="#4B5563" />
          <Text style={styles.statVal}>{activeCount}</Text>
          <Text style={styles.statLbl}>In transit</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="git-branch-outline" size={18} color="#4B5563" />
          <Text style={styles.statVal}>{altTotal}</Text>
          <Text style={styles.statLbl}>Alt routes</Text>
        </View>
      </View>

      {loading && !shipments.length ? (
        <ActivityIndicator color={Page.primary} style={{ marginTop: 24 }} />
      ) : (
        shipments.map((s) => {
          const highlighted = highlightId === s.shipment_id;
          return (
            <TouchableOpacity
              key={s.shipment_id}
              onPress={() => onSelectShipment(s)}
              activeOpacity={0.7}
            >
              <GlassCard
                style={[styles.shipCard, highlighted && styles.shipCardOn]}
                borderLeftColor={highlighted ? Page.primary : undefined}
              >
                <View style={styles.shipTop}>
                  <View style={styles.shipIdRow}>
                    <View style={styles.shipIcon}>
                      <MaterialCommunityIcons name="truck-outline" size={17} color="#374151" />
                    </View>
                    <Text style={styles.shipId}>{s.shipment_id}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${statusColor(s.current_status)}14` }]}>
                    <Text style={[styles.statusTxt, { color: statusColor(s.current_status) }]}>
                      {s.current_status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cargo}>{s.cargo_type}</Text>
                <View style={styles.routeRow}>
                  <Ionicons name="map-outline" size={14} color="#6B7280" />
                  <Text style={styles.routeName}>{s.route_name}</Text>
                </View>
                <RouteStops stops={s.route.slice(0, 3)} accent="#2563EB" />
                <View style={styles.shipFoot}>
                  <Text style={styles.altTxt}>
                    {s.alternative_routes.length} alternate route{s.alternative_routes.length !== 1 ? 's' : ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        })
      )}
      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  countBox: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Page.border,
    minWidth: 52,
  },
  countNum: { fontFamily: FontFamily.bold, fontSize: 18, color: Page.primary },
  countLbl: { fontFamily: FontFamily.medium, fontSize: 10, color: '#6B7280', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Page.border,
  },
  statVal: { fontFamily: FontFamily.bold, fontSize: 17, color: '#111827', marginTop: 6 },
  statLbl: { fontFamily: FontFamily.regular, fontSize: 10, color: '#6B7280', marginTop: 2 },
  shipCard: { marginBottom: 12, padding: 16 },
  shipCardOn: { borderColor: Page.primary },
  shipTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  shipIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  shipIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shipId: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#111827' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, maxWidth: '46%' },
  statusTxt: { fontFamily: FontFamily.semiBold, fontSize: 10, textAlign: 'right' },
  cargo: { fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280', marginBottom: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  routeName: { fontFamily: FontFamily.medium, fontSize: 13, color: '#374151', flex: 1 },
  shipFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Page.border,
  },
  altTxt: { fontFamily: FontFamily.medium, fontSize: 12, color: '#6B7280' },
});
