/**
 * DriverReportScreen — Two-way communication: driver reports an issue.
 * Submits to POST /api/driver-report → returns synthetic alert + re-analyze option.
 */
import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import ScreenHeader from '../components/ScreenHeader';
import { FontFamily, pageStyles, Page } from '../theme';

const API_BASE = process.env.EXPO_PUBLIC_API_URL
  ?? Platform.select({ android: 'http://10.0.2.2:8000', ios: 'http://localhost:8000', default: 'http://localhost:8000' });

const SHIPMENT_IDS = ['SHP-882', 'SHP-901', 'SHP-915', 'SHP-928'];
const ISSUE_TYPES = [
  { id: 'breakdown',   label: '🔧 Vehicle Breakdown',      color: '#DC2626' },
  { id: 'delay',       label: '⏱️ Traffic / Delay',         color: '#D97706' },
  { id: 'temperature', label: '🌡️ Temperature Breach',      color: '#7C3AED' },
  { id: 'accident',    label: '🚨 Road Accident',           color: '#DC2626' },
  { id: 'fuel',        label: '⛽ Fuel Emergency',          color: '#B45309' },
  { id: 'other',       label: '📋 Other Issue',             color: '#6B7280' },
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
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  const selectedIssue = ISSUE_TYPES.find(i => i.id === issueType)!;

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
      <View style={styles.chipRow}>
        {SHIPMENT_IDS.map(id => (
          <TouchableOpacity
            key={id}
            style={[styles.chip, shipmentId === id && styles.chipActive]}
            onPress={() => setShipmentId(id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipTxt, shipmentId === id && styles.chipTxtActive]}>{id}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Issue Type */}
      <Text style={styles.sectionLabel}>ISSUE TYPE</Text>
      <View style={styles.issueGrid}>
        {ISSUE_TYPES.map(issue => (
          <TouchableOpacity
            key={issue.id}
            style={[
              styles.issueCard,
              issueType === issue.id && { borderColor: issue.color, backgroundColor: `${issue.color}10` },
            ]}
            onPress={() => setIssueType(issue.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.issueTxt, issueType === issue.id && { color: issue.color }]}>
              {issue.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
      <Text style={styles.sectionLabel}>DESCRIPTION *</Text>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
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
