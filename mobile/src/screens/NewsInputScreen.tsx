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
} from 'react-native';
import GlassCard from '../components/GlassCard';
import ScenarioPicker from '../components/ScenarioPicker';
import CollapsibleScenarioCard from '../components/CollapsibleScenarioCard';
import { fetchHealth, fetchScenarios } from '../api/client';
import type { Scenario } from '../types/shipment';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface Props {
  onRunAgent: (text: string) => void;
  isAnalyzing: boolean;
  onResetDemo?: () => void | Promise<void>;
  isResetting?: boolean;
  resetToken?: number;
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedScenario = scenarios.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    (async () => {
      setOnline(await fetchHealth());
      const list = await fetchScenarios();
      setScenarios(list);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (resetToken > 0) {
      setAlertText('');
      setSelectedId(null);
      setPreviewOpen(false);
      setEditorOpen(false);
    }
  }, [resetToken]);

  const loadScenario = (s: Scenario) => {
    setSelectedId(s.id);
    setAlertText(s.text);
    setPreviewOpen(true);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset demo?',
      'Restores fleet CRM, clears notifications and agent results so you can run again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => onResetDemo?.() },
      ]
    );
  };

  const handleRun = () => {
    if (!alertText.trim()) {
      Alert.alert('No alert', 'Choose a scenario from the dropdown, or add custom text.');
      return;
    }
    onRunAgent(alertText.trim());
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Breaking news input</Text>
      <Text style={styles.subtitle}>
        Pick a scenario from the dropdown, then run the agent — or paste your own alert.
      </Text>

      <View style={[styles.badge, online === false && styles.badgeOff]}>
        <Text style={styles.badgeText}>
          {online === null ? '…' : online ? 'API online' : 'API offline — start server :8000'}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Scenario</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : (
        <ScenarioPicker
          scenarios={scenarios}
          selectedId={selectedId}
          onSelect={loadScenario}
          disabled={isAnalyzing || isResetting}
        />
      )}

      {selectedScenario ? (
        <CollapsibleScenarioCard
          scenario={selectedScenario}
          expanded={previewOpen}
          selected
          onToggle={() => setPreviewOpen((o) => !o)}
          onSelect={() => loadScenario(selectedScenario)}
        />
      ) : null}

      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setEditorOpen((o) => !o)}
        activeOpacity={0.8}
      >
        <Text style={styles.sectionLabel}>Custom alert text</Text>
        <Text style={styles.chevron}>{editorOpen ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {editorOpen ? (
        <GlassCard style={styles.editorCard}>
          <TextInput
            style={styles.input}
            value={alertText}
            onChangeText={(t) => {
              setAlertText(t);
              setSelectedId(null);
            }}
            multiline
            placeholder="Paste Sindh advisory, traffic alert, heat warning…"
            placeholderTextColor={Colors.outline}
            textAlignVertical="top"
          />
        </GlassCard>
      ) : null}

      <TouchableOpacity
        style={[styles.runBtn, (isAnalyzing || isResetting) && styles.runBtnDisabled]}
        onPress={handleRun}
        disabled={isAnalyzing || isResetting}
      >
        {isAnalyzing ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.runBtnText}>▶ Run agent with this alert</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.resetBtn, (isAnalyzing || isResetting) && styles.runBtnDisabled]}
        onPress={handleReset}
        disabled={isAnalyzing || isResetting}
      >
        {isResetting ? (
          <ActivityIndicator color={Colors.outline} size="small" />
        ) : (
          <Text style={styles.resetBtnText}>↺ Reset demo for new test</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  title: { ...Typography.headlineMD, color: Colors.onSurface },
  subtitle: { ...Typography.bodySM, color: Colors.onSurfaceVariant, marginTop: Spacing.xs, marginBottom: Spacing.md },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  badgeOff: { backgroundColor: `${Colors.error}18` },
  badgeText: { ...Typography.labelMD, color: Colors.primary },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionLabel: { ...Typography.labelMD, color: Colors.outline, marginBottom: Spacing.sm },
  chevron: { fontSize: 11, color: Colors.outline },
  editorCard: { padding: 0, marginBottom: Spacing.lg },
  input: { ...Typography.bodySM, color: Colors.onSurface, padding: Spacing.md, minHeight: 140 },
  runBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText: { ...Typography.labelMD, color: Colors.white, fontSize: 15 },
  resetBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  resetBtnText: { ...Typography.labelMD, color: Colors.onSurfaceVariant },
});
