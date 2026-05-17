export type TimelineKind =
  | 'connected'
  | 'todo'
  | 'coordinator'
  | 'delegate'
  | 'subagent_start'
  | 'subagent_msg'
  | 'subagent_done'
  | 'tool_call'
  | 'tool_result'
  | 'step_summary'
  | 'reason'
  | 'complete'
  | 'error';

export type PipelinePhase = 'idle' | 'running' | 'complete' | 'error';

export interface TimelineEvent {
  id: string;
  ts: string;
  kind: TimelineKind;
  title: string;
  subtitle?: string;
  body?: string;
  detail?: string;
  agent?: string;
  status?: 'active' | 'done' | 'error';
}
