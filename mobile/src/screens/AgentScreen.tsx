import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedAgentHero from '../components/AnimatedAgentHero';
import SubagentStartToast from '../components/SubagentStartToast';
import ScreenHeader from '../components/ScreenHeader';
import ReasoningAccordion from '../components/ReasoningAccordion';
import OrchestratorTodoList from '../components/OrchestratorTodoList';
import PipelineProgress from '../components/PipelineProgress';
import PipelineTimeline from '../components/PipelineTimeline';
import ReasonMarkdownPanel from '../components/ReasonMarkdownPanel';
import type { AgentActivity, OrchestratorTodo } from '../types/agent';
import type { SubagentStartNotice } from '../types/subagentNotice';
import type { PipelinePhase, TimelineEvent } from '../types/timeline';
import { FontFamily, pageStyles, Page } from '../theme';

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
  const phaseLabel =
    pipelinePhase === 'complete'
      ? 'Complete'
      : pipelinePhase === 'error'
        ? 'Error'
        : isAnalyzing
          ? 'Running'
          : 'Idle';

  return (
    <View style={pageStyles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={pageStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          kicker="Agent"
          title="Agent pipeline"
          subtitle="Orchestration, subagents, and full trace"
          right={
            <View
              style={[
                styles.badge,
                pipelinePhase === 'complete' && styles.badgeOk,
                pipelinePhase === 'error' && styles.badgeErr,
                isAnalyzing && styles.badgeRun,
              ]}
            >
              {isAnalyzing ? (
                <ActivityIndicator size="small" color={Page.primary} />
              ) : (
                <View style={styles.badgeDot} />
              )}
              <Text style={styles.badgeText}>{phaseLabel}</Text>
            </View>
          }
        />

        <AnimatedAgentHero isActive={isAnalyzing || pipelinePhase === 'running'} />

        <PipelineProgress
          phase={pipelinePhase}
          percent={progress.percent}
          label={progress.label}
          todosDone={progress.todosDone}
          todosTotal={progress.todosTotal}
          agentsDone={progress.agentsDone}
          agentsTotal={progress.agentsTotal}
        />

        {statusLine ? (
          <View style={pageStyles.card}>
            <View style={styles.statusRow}>
              <Ionicons name="pulse-outline" size={18} color={Page.primary} />
              <Text style={styles.statusTxt}>{statusLine}</Text>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={[pageStyles.card, styles.errorCard]}>
            <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        ) : null}

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

        {!isAnalyzing && todos.length === 0 ? (
          <View style={pageStyles.card}>
            <Text style={styles.hint}>
              Run from the <Text style={styles.hintBold}>News</Text> tab — select a scenario, then Launch AI
              Investigation.
            </Text>
          </View>
        ) : null}

        <View style={{ height: 16 }} />
      </ScrollView>
      {onDismissSubagentNotice ? (
        <SubagentStartToast notices={subagentNotices} onDismiss={onDismissSubagentNotice} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Page.border,
  },
  badgeRun: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  badgeOk: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  badgeErr: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9CA3AF' },
  badgeText: { fontFamily: FontFamily.semiBold, fontSize: 10, color: '#111827' },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusTxt: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  errorTxt: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
  },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
  },
  hintBold: { fontFamily: FontFamily.semiBold, color: Page.primary },
});
