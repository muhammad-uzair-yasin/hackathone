/**
 * DriverReportScreen — Two-way communication: driver reports an issue.
 * Submits to POST /api/driver-report → returns synthetic alert + re-analyze option.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import ScreenHeader from '../components/ScreenHeader';
import { FontFamily, pageStyles, Page } from '../theme';

const API_BASE = process.env.EXPO_PUBLIC_API_URL
  ?? Platform.select({ android: 'http://10.0.2.2:8000', ios: 'http://localhost:8000', default: 'http://localhost:8000' });

const SHIPMENT_IDS = ['SHP-882', 'SHP-901', 'SHP-915', 'SHP-928'];
const ISSUE_TYPES = [
  { id: 'breakdown',   label: '🔧 Vehicle Breakdown',      color: '#DC2626', prefill: 'Vehicle has broken down on the road. Engine failure / flat tyre. Cargo refrigeration unit is still running. Need immediate roadside assistance and possible cargo transfer.' },
  { id: 'delay',       label: '⏱️ Traffic / Delay',         color: '#D97706', prefill: 'Heavy traffic congestion ahead. Road is blocked and movement is very slow. Estimated delay is 30–60 minutes. Cargo temperature is stable for now.' },
  { id: 'temperature', label: '🌡️ Temperature Breach',      color: '#7C3AED', prefill: 'Temperature inside the cargo unit has exceeded safe limits. Refrigeration alarm is active. Cargo is at risk of spoilage. Need urgent reroute to nearest cold storage facility.' },
  { id: 'accident',    label: '🚨 Road Accident',           color: '#DC2626', prefill: 'Road accident ahead is blocking all lanes. Police and emergency services are on scene. Traffic is being diverted. Need alternative route instructions immediately.' },
  { id: 'fuel',        label: '⛽ Fuel Emergency',          color: '#B45309', prefill: 'Fuel level is critically low. Nearest fuel station is unknown. Vehicle may stop within 10–15 km. Need directions to nearest fuel station or emergency fuel delivery.' },
  { id: 'other',       label: '📋 Other Issue',             color: '#6B7280', prefill: 'Please describe the issue in detail — what happened, current situation, and what assistance is needed.' },
];

interface ReportResult {
  report_id: string;
  message: string;
  synthetic_alert: string;
}

interface Props {
  onRunAgent?: (text: string) => void;
}

export default function DriverReportScreen({ onRunAgent }: Props) {
  const [shipmentId, setShipmentId] = useState(SHIPMENT_IDS[0]);
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0].id);
  const [description, setDescription] = useState(ISSUE_TYPES[0].prefill);
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showShipmentDrop, setShowShipmentDrop] = useState(false);
  const [showIssueDrop, setShowIssueDrop] = useState(false);
  const recordingRef = useRef<any>(null);

  const selectedIssue = ISSUE_TYPES.find(i => i.id === issueType)!;

  const handleIssueSelect = (id: string) => {
    setIssueType(id);
    const issue = ISSUE_TYPES.find(i => i.id === id)!;
    setDescription(issue.prefill);
  };

  const handleMicPress = async () => {
    if (recording) {
      // Stop recording and transcribe
      setRecording(false);
      setTranscribing(true);
      try {
        const { Audio } = require('expo-av');
        const rec = recordingRef.current;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        recordingRef.current = null;

        const formData = new FormData();
        formData.append('audio', { uri, name: 'report.m4a', type: 'audio/m4a' } as any);

        const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.transcript) {
          setDescription(prev => prev ? `${prev}\n${data.transcript}` : data.transcript);
        }
      } catch (e) {
        Alert.alert('Transcription failed', 'Could not process audio. Please type your report.');
      }
      setTranscribing(false);
    } else {
      // Start recording
      try {
        const { Audio } = require('expo-av');
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: rec } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = rec;
        setRecording(true);
      } catch (e) {
        Alert.alert('Microphone unavailable', 'Could not access microphone on this device.');
      }
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the issue before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/driver-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_id: shipmentId,
          issue_type: issueType,
          description: description.trim(),
          location: location.trim(),
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      Alert.alert('Network Error', 'Could not reach the backend. Check server is running.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReAnalyze = () => {
    if (result?.synthetic_alert && onRunAgent) {
      onRunAgent(result.synthetic_alert);
    }
  };

  const handleReset = () => {
    setResult(null);
    setDescription('');
    setLocation('');
  };

  if (result) {
    return (
      <ScrollView style={pageStyles.screen} contentContainerStyle={pageStyles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader kicker="Driver Report" title="Report submitted" subtitle="AI agent notified" />

        {/* Success Banner */}
        <GlassCard style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={40} color="#059669" />
          </View>
          <Text style={styles.successTitle}>Report Logged</Text>
          <Text style={styles.successId}>{result.report_id}</Text>
          <Text style={styles.successMsg}>{result.message}</Text>
        </GlassCard>

        {/* Synthetic Alert Preview */}
        <GlassCard style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons name="head-cog-outline" size={16} color="#7C3AED" />
            <Text style={styles.alertHeaderTxt}>AI will analyze this alert</Text>
          </View>
          <Text style={styles.alertBody}>{result.synthetic_alert}</Text>
        </GlassCard>

        {/* Actions */}
        {onRunAgent && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleReAnalyze} activeOpacity={0.85}>
            <MaterialCommunityIcons name="head-cog-outline" size={16} color="#FFF" />
            <Text style={styles.primaryBtnTxt}>Re-run AI Agent Now</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={16} color={Page.primary} />
          <Text style={styles.secondaryBtnTxt}>Submit Another Report</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={pageStyles.screen} contentContainerStyle={pageStyles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        kicker="Driver Report"
        title="Report an issue"
        subtitle="Your report triggers immediate AI re-analysis"
      />

      {/* Info Banner */}
      <GlassCard style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
        <Text style={styles.infoTxt}>
          Reports are instantly logged and converted into an AI alert for re-analysis.
          The agent will reroute affected shipments automatically.
        </Text>
      </GlassCard>

      {/* Shipment Selector */}
      <Text style={styles.sectionLabel}>SHIPMENT ID</Text>
      <TouchableOpacity style={styles.dropdown} onPress={() => setShowShipmentDrop(true)} activeOpacity={0.8}>
        <Text style={styles.dropdownValue}>{shipmentId}</Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

      {/* Issue Type */}
      <Text style={styles.sectionLabel}>ISSUE TYPE</Text>
      <TouchableOpacity style={styles.dropdown} onPress={() => setShowIssueDrop(true)} activeOpacity={0.8}>
        <Text style={styles.dropdownValue}>{selectedIssue.label}</Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

      {/* Shipment Dropdown Modal */}
      <Modal visible={showShipmentDrop} transparent animationType="fade" onRequestClose={() => setShowShipmentDrop(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowShipmentDrop(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Shipment</Text>
            {SHIPMENT_IDS.map(id => (
              <TouchableOpacity key={id} style={[styles.modalItem, shipmentId === id && styles.modalItemActive]}
                onPress={() => { setShipmentId(id); setShowShipmentDrop(false); }}>
                <Text style={[styles.modalItemTxt, shipmentId === id && styles.modalItemTxtActive]}>{id}</Text>
                {shipmentId === id && <Ionicons name="checkmark" size={16} color={Page.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Issue Dropdown Modal */}
      <Modal visible={showIssueDrop} transparent animationType="fade" onRequestClose={() => setShowIssueDrop(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowIssueDrop(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Issue Type</Text>
            {ISSUE_TYPES.map(issue => (
              <TouchableOpacity key={issue.id} style={[styles.modalItem, issueType === issue.id && styles.modalItemActive]}
                onPress={() => { handleIssueSelect(issue.id); setShowIssueDrop(false); }}>
                <Text style={[styles.modalItemTxt, issueType === issue.id && { color: issue.color }]}>{issue.label}</Text>
                {issueType === issue.id && <Ionicons name="checkmark" size={16} color={issue.color} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Location */}
      <Text style={styles.sectionLabel}>CURRENT LOCATION (optional)</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="location-outline" size={16} color="#9CA3AF" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Thatta Bypass km 42, near toll plaza"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Description */}
      <View style={styles.descHeader}>
        <Text style={styles.sectionLabel}>DESCRIPTION *</Text>
        <TouchableOpacity
          style={[styles.micBtn, recording && styles.micBtnActive]}
          onPress={handleMicPress}
          disabled={transcribing}
          activeOpacity={0.8}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name={recording ? 'stop-circle' : 'mic'} size={16} color="#FFF" />
          )}
          <Text style={styles.micTxt}>
            {transcribing ? 'Transcribing…' : recording ? 'Stop' : 'Voice'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.textAreaWrap}>
        <TextInput
          style={styles.textArea}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholder="Describe the issue in detail — what happened, severity, assistance needed..."
          placeholderTextColor="#9CA3AF"
          textAlignVertical="top"
        />
      </View>

      {/* Active Issue Preview */}
      <View style={[styles.previewRow, { borderColor: `${selectedIssue.color}30`, backgroundColor: `${selectedIssue.color}08` }]}>
        <Text style={[styles.previewLabel, { color: selectedIssue.color }]}>{selectedIssue.label}</Text>
        <Text style={styles.previewSub}>on {shipmentId}</Text>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <Ionicons name="send-outline" size={16} color="#FFF" />
            <Text style={styles.primaryBtnTxt}>Submit Report to AI System</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    marginBottom: 20,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  infoTxt: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#1D4ED8',
    flex: 1,
    lineHeight: 19,
  },
  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 13, marginBottom: 18,
  },
  dropdownValue: { fontFamily: FontFamily.medium, fontSize: 14, color: '#111827' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  modalBox: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', paddingVertical: 8 },
  modalTitle: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#9CA3AF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  modalItemActive: { backgroundColor: '#EFF6FF' },
  modalItemTxt: { fontFamily: FontFamily.medium, fontSize: 14, color: '#374151' },
  modalItemTxtActive: { color: Page.primary },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  chipActive: { borderColor: Page.primary, backgroundColor: '#EFF6FF' },
  chipTxt: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#6B7280' },
  chipTxtActive: { color: Page.primary },
  issueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  issueCard: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  issueTxt: { fontFamily: FontFamily.medium, fontSize: 12, color: '#374151' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 12,
  },
  descHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  micBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Page.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  micBtnActive: { backgroundColor: '#DC2626' },
  micTxt: { fontFamily: FontFamily.semiBold, fontSize: 11, color: '#FFF' },
  textAreaWrap: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 14,
  },
  textArea: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    lineHeight: 21,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 18,
  },
  previewLabel: { fontFamily: FontFamily.semiBold, fontSize: 13 },
  previewSub: { fontFamily: FontFamily.regular, fontSize: 12, color: '#9CA3AF' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Page.primary,
    paddingVertical: 15,
    borderRadius: 99,
    shadowColor: Page.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
  },
  primaryBtnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0 },
  primaryBtnTxt: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#FFF' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Page.border,
    backgroundColor: '#FFF',
    marginBottom: 12,
  },
  secondaryBtnTxt: { fontFamily: FontFamily.semiBold, fontSize: 13, color: Page.primary },
  // Result screen
  successCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 16,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
  },
  successIcon: { marginBottom: 12 },
  successTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: '#059669', marginBottom: 4 },
  successId: { fontFamily: FontFamily.semiBold, fontSize: 12, color: '#6EE7B7', marginBottom: 8 },
  successMsg: { fontFamily: FontFamily.regular, fontSize: 13, color: '#065F46', textAlign: 'center', lineHeight: 19 },
  alertCard: { padding: 14, marginBottom: 16, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF', borderWidth: 1 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  alertHeaderTxt: { fontFamily: FontFamily.semiBold, fontSize: 12, color: '#7C3AED' },
  alertBody: { fontFamily: FontFamily.regular, fontSize: 13, color: '#4C1D95', lineHeight: 19 },
});
