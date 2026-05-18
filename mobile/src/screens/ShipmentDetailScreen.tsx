import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RouteStops from '../components/RouteStops';
import GlassCard from '../components/GlassCard';
import type { Shipment } from '../types/shipment';
import { FontFamily, pageStyles, Page } from '../theme';

interface Props {
  shipment: Shipment;
  onClose: () => void;
}

export default function ShipmentDetailScreen({ shipment, onClose }: Props) {
  return (
    <SafeAreaView style={pageStyles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.back} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Page.primary} />
          <Text style={styles.backTxt}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerId}>{shipment.shipment_id}</Text>
      </View>

      <ScrollView contentContainerStyle={pageStyles.content} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.summary}>
          <Text style={styles.cargo}>{shipment.cargo_type}</Text>
          <Text style={styles.meta}>
            {shipment.current_status} · ETA {shipment.eta_minutes ?? '—'} min
          </Text>
        </GlassCard>

        <Text style={pageStyles.sectionTitle}>Active route</Text>
        <GlassCard style={styles.block}>
          <Text style={styles.routeName}>{shipment.route_name}</Text>
          <RouteStops stops={shipment.route} label="Stops" />
        </GlassCard>

        <Text style={pageStyles.sectionTitle}>
          Alternate routes ({shipment.alternative_routes.length})
        </Text>
        {shipment.alternative_routes.map((alt) => (
          <GlassCard key={alt.id} style={styles.alt}>
            <Text style={styles.altName}>
              {alt.id} · {alt.name}
            </Text>
            {alt.notes ? <Text style={styles.altNote}>{alt.notes}</Text> : null}
            {alt.eta_minutes != null ? (
              <Text style={styles.altEta}>ETA ~{alt.eta_minutes} min</Text>
            ) : null}
            <RouteStops stops={alt.stops} accent="#2563EB" />
          </GlassCard>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Page.padH,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Page.border,
    backgroundColor: '#FFF',
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 12 },
  backTxt: { fontFamily: FontFamily.semiBold, fontSize: 15, color: Page.primary },
  headerId: { fontFamily: FontFamily.bold, fontSize: 16, color: '#111827', flex: 1 },
  summary: { padding: 16, marginBottom: 16 },
  cargo: { fontFamily: FontFamily.bold, fontSize: 20, color: '#111827' },
  meta: { fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280', marginTop: 6 },
  block: { padding: 16, marginBottom: 16 },
  routeName: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#374151', marginBottom: 10 },
  alt: { padding: 16, marginBottom: 12 },
  altName: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#111827' },
  altNote: { fontFamily: FontFamily.regular, fontSize: 13, color: '#6B7280', marginTop: 4 },
  altEta: { fontFamily: FontFamily.medium, fontSize: 12, color: Page.primary, marginTop: 4, marginBottom: 8 },
});
