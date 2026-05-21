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
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedGlobeHero from '../components/AnimatedGlobeHero';
import AppDialog from '../components/AppDialog';
import ScenarioPicker from '../components/ScenarioPicker';
import GlassCard from '../components/GlassCard';
import { fetchHealth, fetchScenarios, extractTextFromUrl, extractTextFromPdf } from '../api/client';
import type { Scenario } from '../types/shipment';
import { Colors, FontFamily } from '../theme';
import VoiceInputButton from '../components/VoiceInputButton';
import * as DocumentPicker from 'expo-document-picker';


const APP_ICON = require('../../assets/icon.png');

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
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<'scenarios' | 'manual' | 'extract'>('scenarios');

  const [urlInput, setUrlInput] = useState('');
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfName, setPdfName] = useState('');

  const { width: screenWidth } = useWindowDimensions();
  const heroTextMaxWidth = Math.min(screenWidth * 0.56, screenWidth - 200);

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
      setUrlInput('');
      setPdfName('');
      setActiveInputTab('scenarios');
    }
  }, [resetToken]);

  const loadScenario = (s: Scenario) => {
    setSelectedId(s.id);
    setAlertText(s.text);
  };

  const handleExtractUrl = async () => {
    if (!urlInput.trim()) {
      Alert.alert('Empty URL', 'Please enter a valid webpage URL.');
      return;
    }
    setIsExtractingUrl(true);
    try {
      const res = await extractTextFromUrl(urlInput.trim());
      if (res.success && res.text) {
        setAlertText(res.text);
        setSelectedId(null);
        Alert.alert(
          'Extraction Success',
          `Successfully extracted text from web link (${res.text.length} characters). Preview or run AI agent now.`
        );
      } else {
        Alert.alert('Extraction Failed', res.error || 'Failed to extract text from URL.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred during extraction.');
    } finally {
      setIsExtractingUrl(false);
    }
  };

  const handleExtractPdf = async () => {
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const asset = pickerResult.assets[0];
      setPdfName(asset.name || 'Selected PDF');
      setIsExtractingPdf(true);

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri,
        name: asset.name || 'document.pdf',
        type: 'application/pdf',
      } as any);

      const res = await extractTextFromPdf(formData);
      if (res.success && res.text) {
        setAlertText(res.text);
        setSelectedId(null);
        Alert.alert(
          'Extraction Success',
          `Successfully extracted text from PDF (${res.text.length} characters). Preview or run AI agent now.`
        );
      } else {
        Alert.alert('Extraction Failed', res.error || 'Failed to extract text from PDF.');
        setPdfName('');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred during PDF selection/upload.');
      setPdfName('');
    } finally {
      setIsExtractingPdf(false);
    }
  };


  const handleResetPress = () => {
    if (!onResetDemo) return;
    setResetDialogOpen(true);
  };

  const handleResetConfirm = async () => {
    await onResetDemo?.();
    setResetDialogOpen(false);
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
      <AnimatedGlobeHero />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logo}>
              <Image source={APP_ICON} style={styles.logoImg} resizeMode="cover" />
            </View>
            <View>
              <View style={styles.brandRow}>
                <Text style={styles.brand}>RouteWise AI</Text>
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

        <View style={[styles.heroTextBlock, { maxWidth: heroTextMaxWidth }]}>
          <Text style={styles.hero}>Autonomous Crisis Intelligence</Text>
          <Text style={styles.lead}>
            Transform live signals into coordinated AI-driven actions.
          </Text>
        </View>

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

        <Text style={styles.sectionLabel}>Choose input source</Text>

        {/* ── Input Tab Switcher ──────────────────────────────── */}
        <View style={styles.inputTabRow}>
          <TouchableOpacity
            style={[styles.inputTabBtn, activeInputTab === 'scenarios' && styles.inputTabBtnActive]}
            onPress={() => setActiveInputTab('scenarios')}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Ionicons name="layers-outline" size={15} color={activeInputTab === 'scenarios' ? '#FFF' : '#6B7280'} />
            <Text style={[styles.inputTabTxt, activeInputTab === 'scenarios' && styles.inputTabTxtActive]}>Scenarios</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inputTabBtn, activeInputTab === 'manual' && styles.inputTabBtnActive]}
            onPress={() => setActiveInputTab('manual')}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Ionicons name="create-outline" size={15} color={activeInputTab === 'manual' ? '#FFF' : '#6B7280'} />
            <Text style={[styles.inputTabTxt, activeInputTab === 'manual' && styles.inputTabTxtActive]}>Text/Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inputTabBtn, activeInputTab === 'extract' && styles.inputTabBtnActive]}
            onPress={() => setActiveInputTab('extract')}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Ionicons name="cloud-upload-outline" size={15} color={activeInputTab === 'extract' ? '#FFF' : '#6B7280'} />
            <Text style={[styles.inputTabTxt, activeInputTab === 'extract' && styles.inputTabTxtActive]}>URL/PDF</Text>
          </TouchableOpacity>
        </View>

        {/* ── Tab Contents ────────────────────────────────────── */}
        {activeInputTab === 'scenarios' && (
          <View style={styles.card}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIcon}>
                <Ionicons name="layers-outline" size={18} color="#4B5563" />
              </View>
              <View style={styles.blockText}>
                <Text style={styles.kicker}>Scenario</Text>
                <Text style={styles.blockTitle}>Select a pre-built scenario</Text>
                <Text style={styles.blockBody}>Pick a simulated event to analyze risk outcomes.</Text>
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
          </View>
        )}

        {activeInputTab === 'manual' && (
          <>
            {/* Custom text entry */}
            <View style={styles.card}>
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
                  <Text style={styles.kicker}>Custom text alert</Text>
                  <Text style={styles.blockTitle}>
                    {alertText ? 'Review or edit text' : 'Paste custom text alert'}
                  </Text>
                  <Text style={styles.blockBody}>
                    Input custom weather warnings or logistics blockades.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Voice Input */}
            <View style={styles.card}>
              <View style={styles.blockHeader}>
                <View style={styles.blockIcon}>
                  <Ionicons name="mic-outline" size={18} color="#DC2626" />
                </View>
                <View style={styles.blockText}>
                  <Text style={[styles.kicker, { color: '#DC2626' }]}>Voice Alert</Text>
                  <Text style={styles.blockTitle}>Speak your incident</Text>
                  <Text style={styles.blockBody}>
                    Hold mic and describe the blockade or issue.
                  </Text>
                </View>
              </View>
              <VoiceInputButton
                disabled={busy}
                onTranscript={(text) => {
                  setAlertText(text);
                  setSelectedId(null);
                }}
              />
            </View>
          </>
        )}

        {activeInputTab === 'extract' && (
          <>
            {/* Web Link */}
            <View style={styles.card}>
              <View style={styles.blockHeader}>
                <View style={styles.blockIcon}>
                  <Ionicons name="link-outline" size={18} color="#2563EB" />
                </View>
                <View style={styles.blockText}>
                  <Text style={[styles.kicker, { color: '#2563EB' }]}>Web Link Extractor</Text>
                  <Text style={styles.blockTitle}>Extract from website URL</Text>
                  <Text style={styles.blockBody}>
                    AI will scrape text content from the link.
                  </Text>
                </View>
              </View>
              <View style={styles.urlInputRow}>
                <TextInput
                  style={styles.urlField}
                  value={urlInput}
                  onChangeText={setUrlInput}
                  placeholder="https://example.com/news-story"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  keyboardType="url"
                  editable={!busy && !isExtractingUrl}
                />
                <TouchableOpacity
                  style={[styles.urlBtn, (!urlInput.trim() || isExtractingUrl) && styles.urlBtnDisabled]}
                  onPress={handleExtractUrl}
                  disabled={busy || isExtractingUrl || !urlInput.trim()}
                  activeOpacity={0.7}
                >
                  {isExtractingUrl ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="download-outline" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* PDF Extractor */}
            <View style={styles.card}>
              <View style={styles.blockHeader}>
                <View style={styles.blockIcon}>
                  <Ionicons name="document-text-outline" size={18} color="#059669" />
                </View>
                <View style={styles.blockText}>
                  <Text style={[styles.kicker, { color: '#059669' }]}>PDF Extractor</Text>
                  <Text style={styles.blockTitle}>Extract from PDF Document</Text>
                  <Text style={styles.blockBody}>
                    AI will parse text content out of your PDF.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.pdfBtn, isExtractingPdf && styles.pdfBtnActive]}
                onPress={handleExtractPdf}
                disabled={busy || isExtractingPdf}
                activeOpacity={0.7}
              >
                {isExtractingPdf ? (
                  <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.pdfBtnText}>
                  {isExtractingPdf ? 'Extracting text...' : pdfName ? `Uploaded: ${pdfName}` : 'Select & Process PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Active News Input Preview Banner ────────────────── */}
        {alertText ? (
          <GlassCard style={styles.previewBanner}>
            <View style={styles.previewHeader}>
              <View style={styles.previewHeaderLeft}>
                <Text style={styles.previewTitle}>🎯 Loaded Alert Text</Text>
                {selectedId && (
                  <View style={styles.activeScenarioBadge}>
                    <Text style={styles.activeScenarioBadgeTxt}>Scenario Active</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => { setAlertText(''); setSelectedId(null); }} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.previewBody} numberOfLines={3}>{alertText}</Text>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditorOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={14} color="#2563EB" />
              <Text style={styles.editBtnTxt}>Edit Alert Text</Text>
            </TouchableOpacity>
          </GlassCard>
        ) : null}


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
          onPress={handleResetPress}
          disabled={isResetting || !onResetDemo}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
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

      <AppDialog
        visible={resetDialogOpen}
        title="Reset demo?"
        message="Restores fleet data and clears the last agent run."
        primaryLabel="Reset"
        secondaryLabel="Cancel"
        primaryDestructive
        loading={isResetting}
        onPrimary={() => void handleResetConfirm()}
        onSecondary={() => !isResetting && setResetDialogOpen(false)}
        onRequestClose={() => !isResetting && setResetDialogOpen(false)}
      />

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

  scroll: { flex: 1, zIndex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'web' ? 24 : 96,
  },

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
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logoImg: {
    width: '100%',
    height: '100%',
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

  heroTextBlock: {
    marginBottom: 20,
    zIndex: 2,
  },
  hero: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  lead: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
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

  urlInputRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  urlField: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  urlBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    backgroundColor: '#059669',
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  pdfBtnActive: {
    backgroundColor: '#047857',
  },
  pdfBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },

  /* ── Tab Switcher Styles ───────────────────────────── */
  inputTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  inputTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  inputTabBtnActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  inputTabTxt: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: '#475569',
  },
  inputTabTxtActive: {
    color: '#FFF',
    fontFamily: FontFamily.semiBold,
  },

  /* ── Preview Banner Styles ─────────────────────────── */
  previewBanner: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.15)',
    backgroundColor: 'rgba(239, 246, 255, 0.6)',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#1E3A8A',
  },
  activeScenarioBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  activeScenarioBadgeTxt: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: '#1D4ED8',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#DC2626',
  },
  previewBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
    marginBottom: 10,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtnTxt: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#2563EB',
  },
});

