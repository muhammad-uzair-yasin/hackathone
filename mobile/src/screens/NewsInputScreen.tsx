import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ScenarioPicker from '../components/ScenarioPicker';
import { fetchHealth, fetchScenarios } from '../api/client';
import type { Scenario } from '../types/shipment';
import { Colors, FontFamily } from '../theme';

const GLOBE_IMAGE = require('../../assets/image.png');

interface Props {
  onRunAgent: (text: string) => void;
  isAnalyzing: boolean;
  onResetDemo?: () => void | Promise<void>;
  isResetting?: boolean;
  resetToken?: number;
}

const FLOW = [
  { ion: 'radio-outline' as const, label: 'Input', sub: 'Signals' },
  { mci: 'brain' as const, label: 'Insight', sub: 'Analysis' },
  { ion: 'shield-checkmark-outline' as const, label: 'Decision', sub: 'Planning' },
  { ion: 'flash-outline' as const, label: 'Action', sub: 'Execution' },
];

function FlowIcon({ step }: { step: (typeof FLOW)[number] }) {
  const color = '#4B5563';
  if ('mci' in step) {
    return <MaterialCommunityIcons name={step.mci} size={18} color={color} />;
  }
  return <Ionicons name={step.ion} size={18} color={color} />;
}

export default function NewsInputScreen({
  onRunAgent,
  isAnalyzing,
  onResetDemo,
  isResetting,
  resetToken = 0,
}: Props) {
  const [alertText, setAlertText] = useState('');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const canLaunch = Boolean(alertText.trim()) && !isAnalyzing && !isResetting;
  const busy = isAnalyzing || isResetting;

  useEffect(() => {
    (async () => {
      setOnline(await fetchHealth());
      setScenarios(await fetchScenarios());
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (resetToken > 0) {
      setAlertText('');
      setSelectedId(null);
      setEditorOpen(false);
    }
  }, [resetToken]);

  const loadScenario = (s: Scenario) => {
    setSelectedId(s.id);
    setAlertText(s.text);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset demo?',
      'Restores fleet data and clears the last agent run.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => onResetDemo?.() },
      ]
    );
  };

  const handleRun = () => {
    if (!alertText.trim()) {
      Alert.alert('No alert selected', 'Choose a scenario or add custom alert text.');
      return;
    }
    onRunAgent(alertText.trim());
  };

  return (
    <View style={styles.root}>
      {/* Globe — prominent, real asset */}
      <View style={styles.globeLayer} pointerEvents="none">
        <Image source={GLOBE_IMAGE} style={styles.globeImg} resizeMode="contain" />
        <LinearGradient
          colors={['transparent', 'rgba(249,250,251,0.4)', '#F9FAFB']}
          style={styles.globeBottomFade}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logo}>
              <Ionicons name="flash" size={20} color="#FFFFFF" />
            </View>
            <View>
              <View style={styles.brandRow}>
                <Text style={styles.brand}>Logistics Agent</Text>
                <Text style={styles.version}>v1.0</Text>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.dot, online === false && styles.dotOff]} />
                <Text style={styles.statusLabel}>
                  {online === null ? 'Checking…' : online ? 'API online' : 'API offline'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color="#374151" />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>2</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={19} color="#6B7280" />
            </View>
          </View>
        </View>

        <Text style={styles.hero}>Autonomous Crisis Intelligence</Text>
        <Text style={styles.lead}>
          Transform live signals into coordinated AI-driven actions.
        </Text>

        <View style={styles.card}>
          <View style={styles.flowRow}>
            {FLOW.map((step, i) => (
              <React.Fragment key={step.label}>
                <View style={styles.flowItem}>
                  <View style={styles.flowIcon}>
                    <FlowIcon step={step} />
                  </View>
                  <Text style={styles.flowTitle}>{step.label}</Text>
                  <Text style={styles.flowSub}>{step.sub}</Text>
                </View>
                {i < FLOW.length - 1 ? <Text style={styles.flowArrow}>→</Text> : null}
              </React.Fragment>
            ))}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Choose how you want to start</Text>

        <View style={styles.card}>
          <View style={styles.blockHeader}>
            <View style={styles.blockIcon}>
              <Ionicons name="layers-outline" size={18} color="#4B5563" />
            </View>
            <View style={styles.blockText}>
              <Text style={styles.kicker}>Scenario</Text>
              <Text style={styles.blockTitle}>Select a scenario</Text>
              <Text style={styles.blockBody}>Pick a pre-built scenario to get started.</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} color="#2563EB" />
          ) : (
            <ScenarioPicker
              scenarios={scenarios}
              selectedId={selectedId}
              onSelect={loadScenario}
              disabled={busy}
              variant="embedded"
            />
          )}

          <View style={styles.or}>
            <View style={styles.orLine} />
            <Text style={styles.orLabel}>OR</Text>
            <View style={styles.orLine} />
          </View>

          <TouchableOpacity
            style={styles.listRow}
            onPress={() => setEditorOpen(true)}
            activeOpacity={0.7}
            disabled={busy}
          >
            <View style={styles.blockIcon}>
              <Ionicons name="create-outline" size={18} color="#4B5563" />
            </View>
            <View style={styles.blockText}>
              <Text style={styles.kicker}>Custom alert</Text>
              <Text style={styles.blockTitle}>Paste your alert text</Text>
              <Text style={styles.blockBody}>Add your own breaking news alert to analyze.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleRun}
          disabled={busy || !canLaunch}
          activeOpacity={0.85}
          style={styles.primaryWrap}
        >
          <View style={[styles.primaryBtn, !canLaunch && styles.primaryBtnOff]}>
            {isAnalyzing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={20} color="#FFF" style={styles.primaryIcon} />
                <View style={styles.primaryCopy}>
                  <Text style={styles.primaryTitle}>Launch AI Investigation</Text>
                  <Text style={styles.primarySub}>Start analysis and get instant insights.</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleReset}
          disabled={busy}
          activeOpacity={0.7}
        >
          {isResetting ? (
            <ActivityIndicator color="#6B7280" size="small" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={16} color="#6B7280" />
              <Text style={styles.secondaryText}>Reset demo for new test</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>

      <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditorOpen(false)}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalBar} />
            <Text style={styles.modalTitle}>Paste your alert text</Text>
            <Text style={styles.modalLead}>Breaking news, advisory, or incident report.</Text>
            <TextInput
              style={styles.modalField}
              value={alertText}
              onChangeText={(t) => {
                setAlertText(t);
                setSelectedId(null);
              }}
              multiline
              placeholder="Enter alert text…"
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
              autoFocus
            />
            <TouchableOpacity style={styles.modalSave} onPress={() => setEditorOpen(false)}>
              <Text style={styles.modalSaveText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  globeLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 300,
    height: 300,
    zIndex: 0,
    overflow: 'hidden',
  },
  globeImg: {
    position: 'absolute',
    top: -24,
    right: -56,
    width: 360,
    height: 360,
    opacity: 0.92,
  },
  globeBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },

  scroll: { flex: 1, zIndex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginLeft: 12 },
  brand: { fontFamily: FontFamily.bold, fontSize: 16, color: '#111827', flexShrink: 1 },
  version: { fontFamily: FontFamily.medium, fontSize: 12, color: '#6B7280' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 12, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  dotOff: { backgroundColor: '#DC2626' },
  statusLabel: { fontFamily: FontFamily.regular, fontSize: 12, color: '#6B7280' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#10B981' },
  liveLabel: { fontFamily: FontFamily.semiBold, fontSize: 10, color: '#059669' },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFF' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 6,
    maxWidth: '75%',
  },
  lead: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginBottom: 20,
    maxWidth: '88%',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flowItem: { flex: 1, alignItems: 'center' },
  flowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  flowTitle: { fontFamily: FontFamily.semiBold, fontSize: 10, color: '#111827' },
  flowSub: { fontFamily: FontFamily.regular, fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  flowArrow: { fontSize: 12, color: '#D1D5DB', marginTop: -14 },

  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: '#111827',
    marginBottom: 10,
  },

  blockHeader: { flexDirection: 'row', marginBottom: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  blockIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockText: { flex: 1, marginLeft: 12, marginRight: 8 },
  kicker: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  blockTitle: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#111827' },
  blockBody: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 18,
  },
  loader: { marginVertical: 12 },

  or: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB' },
  orLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#9CA3AF',
    marginHorizontal: 12,
  },

  primaryWrap: { marginBottom: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  primaryBtnOff: { backgroundColor: '#94A3B8' },
  primaryIcon: { marginRight: 12 },
  primaryCopy: { flex: 1 },
  primaryTitle: { fontFamily: FontFamily.semiBold, fontSize: 16, color: '#FFF' },
  primarySub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryText: { fontFamily: FontFamily.medium, fontSize: 14, color: '#6B7280' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
  },
  modalBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: 17, color: '#111827' },
  modalLead: { fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 12 },
  modalField: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 14,
  },
  modalSave: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#FFF' },
});
