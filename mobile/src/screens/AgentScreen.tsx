import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import SubagentStartToast from '../components/SubagentStartToast';
import ReasoningAccordion from '../components/ReasoningAccordion';
import OrchestratorTodoList from '../components/OrchestratorTodoList';
import PipelineProgress from '../components/PipelineProgress';
import PipelineTimeline from '../components/PipelineTimeline';
import ReasonMarkdownPanel from '../components/ReasonMarkdownPanel';
import type { AgentActivity, OrchestratorTodo } from '../types/agent';
import type { SubagentStartNotice } from '../types/subagentNotice';
import type { PipelinePhase, TimelineEvent } from '../types/timeline';
import { Colors, Typography, Spacing } from '../theme';

interface Props {
  isAnalyzing: boolean;
  statusLine: string;
  todos: OrchestratorTodo[];
  activities: AgentActivity[];
  timeline: TimelineEvent[];
  pipelinePhase: PipelinePhase;
  progress: {
    percent: number;
    label: string;
    todosDone: number;
    todosTotal: number;
    agentsDone: number;
    agentsTotal: number;
  };
  reasoningOpen: boolean;
  traceOpen: boolean;
  onToggleMaster: () => void;
  onToggleTrace: () => void;
  onToggleActivity: (id: string) => void;
  summaryMarkdown?: string | null;
  summaryFile?: string;
  error?: string | null;
  subagentNotices?: SubagentStartNotice[];
  onDismissSubagentNotice?: (id: string) => void;
}

export default function AgentScreen({
  isAnalyzing,
  statusLine,
  todos,
  activities,
  timeline,
  pipelinePhase,
  progress,
  reasoningOpen,
  traceOpen,
  onToggleMaster,
  onToggleTrace,
  onToggleActivity,
  summaryMarkdown,
  summaryFile,
  error,
  subagentNotices = [],
  onDismissSubagentNotice,
}: Props) {
  return (
    <View style={styles.root}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Agent pipeline</Text>
      <Text style={styles.subtitle}>
        Progress, orchestrator plan, subagent handoffs, and full trace
      </Text>

      <PipelineProgress
        phase={pipelinePhase}
        percent={progress.percent}
        label={progress.label}
        todosDone={progress.todosDone}
        todosTotal={progress.todosTotal}
        agentsDone={progress.agentsDone}
        agentsTotal={progress.agentsTotal}
      />

      {isAnalyzing ? (
        <View style={styles.runningRow}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.runningText}>Agents working…</Text>
        </View>
      ) : null}

      {statusLine ? (
        <View style={styles.statusStrip}>
          <Text style={styles.statusText}>{statusLine}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <OrchestratorTodoList todos={todos} waiting={isAnalyzing && todos.length === 0} />

      <ReasoningAccordion
        activities={activities}
        masterOpen={reasoningOpen}
        onToggleMaster={onToggleMaster}
        onToggleActivity={onToggleActivity}
      />

      <PipelineTimeline events={timeline} masterOpen={traceOpen} onToggleMaster={onToggleTrace} />

      {summaryMarkdown ? (
        <ReasonMarkdownPanel markdown={summaryMarkdown} fileName={summaryFile} defaultOpen={false} />
      ) : null}

      <Text style={styles.hint}>
        Start from News → pick a scenario → Run agent. Expand trace rows for JSON detail.
      </Text>
      <View style={{ height: 100 }} />
    </ScrollView>
    {onDismissSubagentNotice ? (
      <SubagentStartToast notices={subagentNotices} onDismiss={onDismissSubagentNotice} />
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  title: { ...Typography.headlineMD, color: Colors.onSurface },
  subtitle: { ...Typography.bodySM, color: Colors.onSurfaceVariant, marginBottom: Spacing.md },
  runningRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  runningText: { ...Typography.bodySM, color: Colors.primary },
  statusStrip: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  statusText: { ...Typography.bodySM, color: Colors.onSurface },
  error: { ...Typography.bodySM, color: Colors.error, marginBottom: Spacing.md },
  hint: { ...Typography.labelMD, color: Colors.outline, marginTop: Spacing.lg, textAlign: 'center' },
});
