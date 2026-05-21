import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import RouteStops from '../components/RouteStops';
import GlassCard from '../components/GlassCard';
import MAP_HTML from '../constants/mapHtml';
import type { Shipment } from '../types/shipment';
import { FontFamily, pageStyles, Page } from '../theme';

interface Props {
  shipment: Shipment;
  onClose: () => void;
}

export default function ShipmentDetailScreen({ shipment, onClose }: Props) {
  const webViewRef = React.useRef<any>(null);
  const [activeStops, setActiveStops] = React.useState(shipment.route);
  const [activeRouteId, setActiveRouteId] = React.useState<string>('active');

  const updateMap = (stops: any[]) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'ROUTE_DATA',
        before: [],
        after: stops,
      }));
    }
  };

  React.useEffect(() => {
    updateMap(activeStops);
  }, [activeStops]);

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

        {/* ── Real Map View ─────────────────────────────────── */}
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: MAP_HTML }}
            originWhitelist={['*']}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            javaScriptEnabled
            onLoad={() => {
              setTimeout(() => {
                updateMap(activeStops);
              }, 400);
            }}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'MAP_READY') {
                  updateMap(activeStops);
                }
              } catch {}
            }}
            style={styles.mapView}
          />
        </View>

        <Text style={pageStyles.sectionTitle}>Active route</Text>
        <TouchableOpacity
          onPress={() => {
            setActiveRouteId('active');
            setActiveStops(shipment.route);
          }}
          activeOpacity={0.8}
        >
          <GlassCard style={[styles.block, activeRouteId === 'active' && styles.selectedBlockActive]}>
            <View style={styles.routeHeaderRow}>
              <Text style={styles.routeName}>{shipment.route_name}</Text>
              {activeRouteId === 'active' && (
                <View style={styles.routeSelectedBadge}>
                  <Text style={styles.routeSelectedBadgeTxt}>🗺️ Map Active</Text>
                </View>
              )}
            </View>
            <RouteStops stops={shipment.route} label="Stops" />
          </GlassCard>
        </TouchableOpacity>

        <Text style={pageStyles.sectionTitle}>
          Alternate routes ({shipment.alternative_routes.length})
        </Text>
        {shipment.alternative_routes.map((alt) => (
          <TouchableOpacity
            key={alt.id}
            onPress={() => {
              setActiveRouteId(alt.id);
              setActiveStops(alt.stops);
            }}
            activeOpacity={0.8}
          >
            <GlassCard style={[styles.alt, activeRouteId === alt.id && styles.selectedBlockAlt]}>
              <View style={styles.routeHeaderRow}>
                <Text style={styles.altName}>
                  {alt.id} · {alt.name}
                </Text>
                {activeRouteId === alt.id && (
                  <View style={styles.routeSelectedBadge}>
                    <Text style={styles.routeSelectedBadgeTxt}>🗺️ Map Active</Text>
                  </View>
                )}
              </View>
              {alt.notes ? <Text style={styles.altNote}>{alt.notes}</Text> : null}
              {alt.eta_minutes != null ? (
                <Text style={styles.altEta}>ETA ~{alt.eta_minutes} min</Text>
              ) : null}
              <RouteStops stops={alt.stops} accent="#2563EB" />
            </GlassCard>
          </TouchableOpacity>
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
  routeName: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#374151' },
  alt: { padding: 16, marginBottom: 12 },
  altName: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#111827' },
  altNote: { fontFamily: FontFamily.regular, fontSize: 13, color: '#6B7280', marginTop: 4 },
  altEta: { fontFamily: FontFamily.medium, fontSize: 12, color: Page.primary, marginTop: 4, marginBottom: 8 },

  /* ── Interactive Map Styles ────────────────────────── */
  mapContainer: {
    height: 280,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Page.border,
    backgroundColor: '#0f172a',
    marginBottom: 16,
  },
  mapView: {
    flex: 1,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  routeSelectedBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  routeSelectedBadgeTxt: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#1D4ED8',
  },
  selectedBlockActive: {
    borderColor: '#7C3AED',
    borderWidth: 1.5,
  },
  selectedBlockAlt: {
    borderColor: '#2563EB',
    borderWidth: 1.5,
  },
});
