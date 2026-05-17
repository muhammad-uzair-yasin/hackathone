export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface OrchestratorTodo {
  id: string;
  content: string;
  status: TodoStatus;
}

export type AgentActivityStatus = 'pending' | 'active' | 'done' | 'error';

export interface AgentActivity {
  id: string;
  label: string;
  status: AgentActivityStatus;
  what: string;
  why: string;
  extra: string;
  expanded: boolean;
}

/** Display names for subagents + orchestrator tools */
export const AGENT_LABELS: Record<string, string> = {
  'hazard-extractor': 'Hazard Extractor',
  'fleet-scout': 'Fleet Scout',
  'impact-analyzer': 'Route Impact',
  'action-planner': 'Action Planner',
  'update_crm_tool': 'Route Update',
  notify_tool: 'Hospital Alert',
  write_summary_tool: 'Run Summary',
};

const AGENT_TODO_KEYWORDS: Record<string, string[]> = {
  'hazard-extractor': ['hazard', 'extract', 'alert', 'news'],
  'fleet-scout': ['fleet', 'scout', 'shipment', 'active'],
  'impact-analyzer': ['impact', 'affected', 'route'],
  'action-planner': ['action', 'plan', 'reroute', 'alternative'],
  update_crm_tool: ['route', 'reroute', 'crm', 'update'],
  notify_tool: ['notify', 'hospital', 'alert'],
  write_summary_tool: ['summary', 'write', 'document', 'log'],
};

export function labelForAgent(agentOrTool: string): string {
  return AGENT_LABELS[agentOrTool] || agentOrTool.replace(/-/g, ' ');
}

export function matchTodoIndex(todos: OrchestratorTodo[], agentOrTool: string): number {
  const keys = AGENT_TODO_KEYWORDS[agentOrTool];
  if (!keys?.length) return -1;
  return todos.findIndex((t) => {
    const lower = t.content.toLowerCase();
    return keys.some((k) => lower.includes(k));
  });
}

export interface OutcomeSnapshot {
  shipmentId: string;
  cargo: string;
  route: string;
  destination: string;
  status: string;
}
