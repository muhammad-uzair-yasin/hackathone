import { useCallback, useMemo, useRef, useState } from 'react';
import {
  streamAnalyzePost,
  fetchBaselineShipments,
  fetchDbShipments,
  fetchSummaryDocument,
  resetDemoSession,
} from '../api/client';
import type { SummaryDocument } from '../types/summary';
import { connectSSE, type SSEConnection } from '../api/sse';

const EXECUTION_TOOLS = new Set(['update_crm_tool', 'notify_tool', 'write_summary_tool']);
import {
  type AgentActivity,
  type OrchestratorTodo,
  type OutcomeSnapshot,
  type TodoStatus,
  labelForAgent,
  matchTodoIndex,
} from '../types/agent';
import type { PipelinePhase, TimelineEvent } from '../types/timeline';
import type { SubagentStartNotice } from '../types/subagentNotice';
import { formatAgentHandoff, previewJson } from '../utils/formatAgentHandoff';
import { mapShipment, type Shipment } from '../types/shipment';
import { sendShipmentAlert } from '../services/NotificationService';

function snapshotFromShipments(ships: Shipment[], id?: string): OutcomeSnapshot | null {
  const target = id
    ? ships.find((s) => s.shipment_id === id)
    : ships.find((s) => /reroute/i.test(s.current_status)) || ships[0];
  if (!target) return null;
  return {
    shipmentId: target.shipment_id,
    cargo: target.cargo_type,
    route: target.route_name,
    destination: target.destination,
    status: target.current_status,
  };
}

function snapshotFromCrmState(state: Record<string, unknown>, cargo = '—'): OutcomeSnapshot {
  return {
    shipmentId: String(state.shipment_id || ''),
    cargo,
    route: String(state.route_name || ''),
    destination: String(state.destination || ''),
    status: String(state.current_status || ''),
  };
}

function snapshotsEqual(a: OutcomeSnapshot, b: OutcomeSnapshot): boolean {
  return (
    a.shipmentId === b.shipmentId &&
    a.status === b.status &&
    a.route === b.route &&
    a.destination === b.destination
  );
}

function normalizeTodos(raw: unknown[]): OrchestratorTodo[] {
  return raw.map((item, i) => {
    const o = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const status = (o.status as TodoStatus) || 'pending';
    return {
      id: `todo-${i}`,
      content: String(o.content || o.task || item),
      status,
    };
  });
}

export function useAgentStream() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const [traceOpen, setTraceOpen] = useState(true);
  const [statusLine, setStatusLine] = useState('');
  const [todos, setTodos] = useState<OrchestratorTodo[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>('idle');
  const [outcomeBefore, setOutcomeBefore] = useState<OutcomeSnapshot | null>(null);
  const [outcomeAfter, setOutcomeAfter] = useState<OutcomeSnapshot | null>(null);
  const [routeBeforeStops, setRouteBeforeStops] = useState<{place:string;lat:number;lon:number}[]>([]);
  const [routeAfterStops, setRouteAfterStops] = useState<{place:string;lat:number;lon:number}[]>([]);
  const [affectedId, setAffectedId] = useState<string | null>(null);
  const affectedIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [summaryDoc, setSummaryDoc] = useState<SummaryDocument | null>(null);
  const [subagentNotices, setSubagentNotices] = useState<SubagentStartNotice[]>([]);
  const seqRef = useRef(0);
  const completeReceivedRef = useRef(false);
  const outcomeHandledRef = useRef(false);
  const completedExecutionToolsRef = useRef<Set<string>>(new Set());
  const completedAgentsRef = useRef<Set<string>>(new Set());
  const sseRef = useRef<SSEConnection | null>(null);
  const streamAbortedRef = useRef(false);

  const abortActiveStream = useCallback(() => {
    streamAbortedRef.current = true;
    sseRef.current?.abort();
    sseRef.current = null;
  }, []);

  const loadSummary = useCallback(async () => {
    const doc = await fetchSummaryDocument();
    setSummaryDoc(doc);
  }, []);

  const showSubagentNotice = useCallback((agentId: string) => {
    const notice: SubagentStartNotice = {
      id: `notice-${Date.now()}-${agentId}`,
      agentId,
      label: labelForAgent(agentId),
    };
    setSubagentNotices((prev) => [...prev.slice(-2), notice]);
  }, []);

  const dismissSubagentNotice = useCallback((id: string) => {
    setSubagentNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const appendTimeline = useCallback((entry: Omit<TimelineEvent, 'id' | 'ts'> & { ts?: string }) => {
    seqRef.current += 1;
    const ev: TimelineEvent = {
      id: `ev-${seqRef.current}`,
      ts: entry.ts || new Date().toISOString(),
      kind: entry.kind,
      title: entry.title,
      subtitle: entry.subtitle,
      body: entry.body,
      detail: entry.detail,
      agent: entry.agent,
      status: entry.status,
    };
    setTimeline((prev) => [...prev, ev]);
  }, []);

  /** One row per key — stops duplicate "Analyzing…" spam from repeated SUBAGENT_MSG */
  const upsertTimeline = useCallback(
    (key: string, entry: Omit<TimelineEvent, 'id' | 'ts'> & { ts?: string }) => {
      setTimeline((prev) => {
        const idx = prev.findIndex((e) => e.id === key);
        const base: TimelineEvent = {
          id: key,
          ts: entry.ts || new Date().toISOString(),
          kind: entry.kind,
          title: entry.title,
          subtitle: entry.subtitle,
          body: entry.body,
          detail: entry.detail,
          agent: entry.agent,
          status: entry.status,
        };
        if (idx >= 0) {
          const next = [...prev];
          const prevEv = next[idx];
          next[idx] = {
            ...prevEv,
            ...base,
            ts: entry.ts || prevEv.ts,
            body: entry.body ?? prevEv.body,
          };
          return next;
        }
        return [...prev, base];
      });
    },
    []
  );

  const clearTimelineKey = useCallback((key: string) => {
    setTimeline((prev) => prev.filter((e) => e.id !== key));
  }, []);

  const setAffected = useCallback((id: string | null) => {
    affectedIdRef.current = id;
    setAffectedId(id);
  }, []);

  const setTodoStatus = useCallback((agentOrTool: string, status: TodoStatus) => {
    setTodos((prev) => {
      const idx = matchTodoIndex(prev, agentOrTool);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], status };
      return next;
    });
  }, []);

  const upsertActivity = useCallback((id: string, patch: Partial<AgentActivity>) => {
    setActivities((prev) => {
      const i = prev.findIndex((a) => a.id === id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          id,
          label: patch.label || labelForAgent(id),
          status: 'pending',
          what: '',
          why: '',
          extra: '',
          expanded: false,
          ...patch,
        },
      ];
    });
  }, []);

  const finishExecutionTool = useCallback(
    (tool: string, result?: Record<string, unknown>) => {
      completedExecutionToolsRef.current.add(tool);
      const msg = String(result?.message || 'Complete');
      upsertActivity(tool, {
        label: labelForAgent(tool),
        status: 'done',
        what: msg,
        expanded: false,
      });
      setTodoStatus(tool, 'completed');
      upsertTimeline(`tool-${tool}`, {
        kind: 'tool_result',
        agent: tool,
        title: `${labelForAgent(tool)} complete`,
        body: msg,
        status: 'done',
      });
    },
    [setTodoStatus, upsertActivity, upsertTimeline]
  );

  const finalizePipeline = useCallback(() => {
    setActivities((prev) =>
      prev.map((a) => ({
        ...a,
        status: 'done' as const,
        expanded: false,
        label: labelForAgent(a.id),
      }))
    );
    setTodos((prev) => prev.map((t) => ({ ...t, status: 'completed' as const })));
  }, []);

  const finalizeExecutionToolsOnComplete = useCallback(
    (crmUpdated: boolean, outcome: string) => {
      const skipMsg =
        outcome === 'all_clear'
          ? 'Not required — no affected shipments'
          : crmUpdated
            ? 'Not run this session'
            : 'Not run — analysis finished without a route change';

      setActivities((prev) =>
        prev.map((a) => {
          if (!EXECUTION_TOOLS.has(a.id) || completedExecutionToolsRef.current.has(a.id)) {
            return a;
          }
          if (a.status !== 'active' && a.status !== 'pending') return a;
          return { ...a, status: 'error' as const, what: skipMsg, expanded: false };
        })
      );
    },
    []
  );

  const applyAgentResult = useCallback(
    (agent: string, result: Record<string, unknown>, summary?: string) => {
      if (!result) return;

      const what = summary || String(result.display_summary || '');
      const why = String(result.why_brief || '');
      let extra = '';

      if (agent === 'shipment-analyzer' && Array.isArray(result.active_shipments)) {
        extra = (result.active_shipments as { shipment_id: string; route_name: string }[])
          .map((s) => `${s.shipment_id}: ${s.route_name}`)
          .join(' · ');
      }
      if (agent === 'impact-analyzer') {
        const aid = result.affected_shipment_id as string | undefined;
        if (aid) setAffected(aid);
        if (Array.isArray(result.unaffected_shipment_ids)) {
          extra = `Clear: ${(result.unaffected_shipment_ids as string[]).join(', ')}`;
        }
      }
      if (agent === 'action-planner') {
        extra = String(result.selection_rationale || result.selected_route_name || '');
      }

      upsertActivity(agent, {
        label: labelForAgent(agent),
        status: 'done',
        what,
        why,
        extra,
        expanded: false,
      });
      setTodoStatus(agent, 'completed');

      appendTimeline({
        kind: 'subagent_done',
        agent,
        title: `${labelForAgent(agent)} finished`,
        subtitle: what,
        body: formatAgentHandoff(agent, result),
        detail: previewJson(result),
        status: 'done',
      });

      if (what) setStatusLine(what);
    },
    [appendTimeline, setAffected, setTodoStatus, upsertActivity]
  );

  const handleEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = event.type as string;
      const ts = event.timestamp as string | undefined;

      if (type === 'CONNECTED') {
        setStatusLine('Connected — orchestrator planning…');
        appendTimeline({
          kind: 'connected',
          ts,
          title: 'Pipeline connected',
          body: String(event.message || 'Fleet database reset to baseline'),
          status: 'done',
        });
        return;
      }

      if (type === 'TODO_LIST' || type === 'TODO_UPDATE') {
        const raw = event.todos as unknown[] | undefined;
        if (raw?.length) {
          const normalized = normalizeTodos(raw);
          setTodos(normalized);
          appendTimeline({
            kind: 'todo',
            ts,
            title: type === 'TODO_LIST' ? 'Orchestrator plan created' : 'Plan updated',
            body: normalized.map((t) => `○ ${t.content}`).join('\n'),
            status: 'done',
          });
        }
        return;
      }

      if (type === 'COORDINATOR') {
        const msg = String(event.message || '').trim();
        if (msg) {
          setStatusLine(msg);
          upsertTimeline('coordinator-latest', {
            kind: 'coordinator',
            ts,
            title: 'Orchestrator',
            body: msg,
            status: 'active',
          });
        }
        return;
      }

      if (type === 'TASK_DELEGATE') {
        const agent = String(event.agent || 'subagent');
        const preview = String(event.input_preview || '');
        appendTimeline({
          kind: 'delegate',
          agent,
          ts,
          title: `Orchestrator → ${labelForAgent(agent)}`,
          subtitle: 'Sends task input',
          body: preview,
          status: 'active',
        });
        return;
      }

      if (type === 'TASK_COMPLETE') {
        const agent = String(event.agent || '');
        const summary = String(event.summary || 'Task returned');
        appendTimeline({
          kind: 'delegate',
          agent,
          ts,
          title: `${labelForAgent(agent)} → Orchestrator`,
          subtitle: summary,
          status: 'done',
        });
        return;
      }

      if (type === 'SUBAGENT_START') {
        const agent = event.agent as string;
        showSubagentNotice(agent);
        setTodoStatus(agent, 'in_progress');
        upsertActivity(agent, {
          label: labelForAgent(agent),
          status: 'active',
          what: 'Running…',
          expanded: true,
        });
        appendTimeline({
          kind: 'subagent_start',
          agent,
          ts,
          title: `${labelForAgent(agent)} started`,
          subtitle: 'Subagent running',
          status: 'active',
        });
        return;
      }

      if (type === 'SUBAGENT_MSG') {
        const agent = event.agent as string;
        const msg = String(event.message || '').trim();
        const hint = event.hint as string | undefined;
        if (!msg) return;

        const isGeneric =
          /analyzing operational data/i.test(msg) || msg === 'Checking live shipment database…';

        upsertTimeline(`working-${agent}`, {
          kind: 'subagent_msg',
          agent,
          ts,
          title: labelForAgent(agent),
          subtitle: hint === 'file_read' ? 'Reads fleet data' : 'In progress',
          body: isGeneric ? 'Reading data & analyzing…' : msg,
          status: 'active',
        });

        if (!isGeneric) upsertActivity(agent, { what: msg });
        return;
      }

      if (type === 'STEP_SUMMARY') {
        const result = event.result as Record<string, unknown> | undefined;
        const summary = event.summary as string | undefined;
        const agent = event.agent as string | undefined;
        if (result && agent === 'orchestrator') {
          if (result.before_state || result.success) {
            finishExecutionTool(
              'update_crm_tool',
              result as Record<string, unknown>
            );
          }
          if (summary) {
            appendTimeline({
              kind: 'step_summary',
              ts,
              title: 'Route updated',
              body: summary,
              status: 'done',
            });
          }
          return;
        }
        if (result && agent) {
          applyAgentResult(agent, result, summary);
        } else if (summary) {
          appendTimeline({
            kind: 'step_summary',
            ts,
            title: String(event.title || 'Step'),
            body: summary,
            status: 'done',
          });
        }
        return;
      }

      if (type === 'SUBAGENT_DONE') {
        const agent = event.agent as string;
        clearTimelineKey(`working-${agent}`);
        if (event.status === 'completed') {
          completedAgentsRef.current.add(agent);
          const result = event.result as Record<string, unknown> | undefined;
          if (result) applyAgentResult(agent, result, result.display_summary as string);
        } else if (!completedAgentsRef.current.has(agent)) {
          appendTimeline({
            kind: 'error',
            agent,
            ts,
            title: `${labelForAgent(agent)} failed`,
            body: String(event.error || 'Unknown error'),
            status: 'error',
          });
        }
        return;
      }

      if (type === 'TOOL_CALL') {
        const tool = event.tool_name as string;
        const agent = event.agent as string | undefined;
        const args = (event.args || {}) as Record<string, unknown>;
        const who = agent ? labelForAgent(agent) : labelForAgent(tool);
        if (tool === 'read_file' && agent) {
          upsertTimeline(`working-${agent}`, {
            kind: 'subagent_msg',
            agent,
            ts,
            title: labelForAgent(agent),
            subtitle: 'Reads fleet data',
            body: 'Reading active_shipments.json…',
            status: 'active',
          });
        } else {
          appendTimeline({
            kind: 'tool_call',
            agent: agent || tool,
            ts,
            title: `${who} calls ${tool}`,
            detail: previewJson(args),
            status: 'active',
          });
        }
        if (EXECUTION_TOOLS.has(tool)) {
          setTodoStatus(tool, 'in_progress');
          const what =
            tool === 'update_crm_tool'
              ? 'Updating route…'
              : tool === 'notify_tool'
                ? 'Sending hospital alert…'
                : 'Writing summary.md…';
          upsertActivity(tool, {
            label: labelForAgent(tool),
            status: 'active',
            what,
            expanded: true,
          });
          upsertTimeline(`tool-${tool}`, {
            kind: 'tool_call',
            agent: tool,
            ts,
            title: labelForAgent(tool),
            body: what,
            status: 'active',
          });
        }
        return;
      }

      if (type === 'TOOL_RESULT') {
        const tool = event.tool_name as string;
        const ok = event.status === 'SUCCESS';
        const result = event.result as Record<string, unknown> | undefined;
        if (EXECUTION_TOOLS.has(tool)) {
          if (ok) {
            finishExecutionTool(tool, result);
            // ⚡ Fire real push notification when notify_tool completes
            if (tool === 'notify_tool') {
              void sendShipmentAlert({
                shipmentId: String(result?.shipment_id || affectedIdRef.current || 'Unknown'),
                message: String(result?.mobile_notification || result?.message || ''),
                outcome: 'rerouted',
              });
            }
          } else {
            upsertActivity(tool, {
              label: labelForAgent(tool),
              status: 'error',
              what: String(result?.message || event.error || 'Failed'),
              expanded: false,
            });
          }
          return;
        }
        appendTimeline({
          kind: 'tool_result',
          agent: tool,
          ts,
          title: `${labelForAgent(tool)} ${ok ? 'done' : 'failed'}`,
          body: result?.message ? String(result.message) : undefined,
          detail: result ? previewJson(result) : String(event.error || ''),
          status: ok ? 'done' : 'error',
        });
        return;
      }

      if (type === 'SUMMARY_WRITTEN') {
        const file = String(event.file || 'summary.md');
        finishExecutionTool('write_summary_tool', { message: String(event.message || `${file} saved`) });
        appendTimeline({
          kind: 'reason',
          ts,
          title: 'Summary saved',
          body: file,
          status: 'done',
        });
        void loadSummary();
        return;
      }

      if (type === 'COMPLETE') {
        completeReceivedRef.current = true;
        outcomeHandledRef.current = true;
        const crmUpdated = Boolean(event.crm_updated);
        const outcome = String(event.outcome || 'completed');
        const beforeAfter = event.before_after as
          | { shipment_id?: string; before?: Record<string, unknown>; after?: Record<string, unknown> }
          | undefined;

        if (crmUpdated && beforeAfter?.before && beforeAfter?.after) {
          const cargo =
            outcomeBefore?.cargo ||
            String(beforeAfter.before.cargo_type || beforeAfter.after.cargo_type || '—');
          setOutcomeBefore(snapshotFromCrmState(beforeAfter.before, cargo));
          setOutcomeAfter(snapshotFromCrmState(beforeAfter.after, cargo));

          // Extract lat/lon route stops for the map
          const bStops = (beforeAfter.before.route as any[] | undefined) ?? [];
          const aStops = (beforeAfter.after.route as any[] | undefined) ?? [];
          if (bStops.length) setRouteBeforeStops(bStops);
          if (aStops.length) setRouteAfterStops(aStops);
        } else {
          const ships = event.current_shipments as { active_shipments?: Record<string, unknown>[] } | undefined;
          if (ships?.active_shipments) {
            const mapped = ships.active_shipments.map((s) => mapShipment(s));
            const after = snapshotFromShipments(mapped, affectedIdRef.current || undefined);
            if (after && outcomeBefore && snapshotsEqual(outcomeBefore, after) && !crmUpdated) {
              setOutcomeAfter(null);
            } else if (after) {
              setOutcomeAfter(after);
            }
          } else if (!crmUpdated) {
            setOutcomeAfter(null);
          }
        }

        finalizePipeline();
        finalizeExecutionToolsOnComplete(crmUpdated, outcome);
        setPipelinePhase('complete');
        const msg = String(event.message || 'Pipeline complete');
        setStatusLine(msg);
        const completeTitle = crmUpdated
          ? 'Reroute complete'
          : outcome === 'all_clear'
            ? 'All clear'
            : 'Analysis complete';
        appendTimeline({
          kind: 'complete',
          ts,
          title: completeTitle,
          body: msg,
          status: 'done',
        });
        void loadSummary();
        return;
      }

      if (type === 'ERROR') {
        setPipelinePhase('error');
        const msg = String(event.message || event.error || 'Unknown error');
        setError(msg);
        appendTimeline({ kind: 'error', ts, title: 'Pipeline error', body: msg, status: 'error' });
      }
    },
    [
      appendTimeline,
      applyAgentResult,
      clearTimelineKey,
      finishExecutionTool,
      finalizeExecutionToolsOnComplete,
      finalizePipeline,
      outcomeBefore,
      loadSummary,
      setTodoStatus,
      showSubagentNotice,
      upsertActivity,
      upsertTimeline,
    ]
  );

  const progress = useMemo(() => {
    const todosDone = todos.filter((t) => t.status === 'completed').length;
    const todosTotal = Math.max(todos.length, 1);
    const agentsDone = activities.filter((a) => a.status === 'done').length;
    const agentsTotal = Math.max(activities.length, 1);
    let percent = 0;
    let label = 'Ready';
    if (pipelinePhase === 'complete') {
      percent = 100;
      label = 'Complete';
    } else if (pipelinePhase === 'error') {
      percent = Math.min(90, (todosDone / todosTotal) * 40 + (agentsDone / agentsTotal) * 50);
      label = 'Error';
    } else if (isAnalyzing) {
      percent = Math.min(
        95,
        5 + (todosDone / todosTotal) * 35 + (agentsDone / agentsTotal) * 55
      );
      label = 'Running…';
    }
    return { percent, label, todosDone, todosTotal, agentsDone, agentsTotal };
  }, [todos, activities, pipelinePhase, isAnalyzing]);

  const runAnalysis = useCallback(
    async (alertText: string, onStarted?: () => void) => {
      if (!alertText.trim()) return;

      streamAbortedRef.current = false;
      setIsAnalyzing(true);
      setError(null);
      setTodos([]);
      setActivities([]);
      setTimeline([]);
      setSubagentNotices([]);
      seqRef.current = 0;
      completeReceivedRef.current = false;
      outcomeHandledRef.current = false;
      completedExecutionToolsRef.current = new Set();
      completedAgentsRef.current = new Set();
      setPipelinePhase('running');
      setStatusLine('Starting orchestrator…');
      setOutcomeAfter(null);
      setSummaryDoc(null);

      const baseline = await fetchBaselineShipments();
      const before = snapshotFromShipments(baseline);
      setOutcomeBefore(before);
      if (before) setAffected(before.shipmentId);

      onStarted?.();

      try {
        abortActiveStream();
        const { url, body } = streamAnalyzePost(alertText);
        await new Promise<void>((resolve, reject) => {
          const conn = connectSSE(url, {
            method: 'POST',
            body,
            onEvent: handleEvent,
            onError: reject,
            onDone: () => {
              sseRef.current = null;
              if (!completeReceivedRef.current) {
                finalizePipeline();
                finalizeExecutionToolsOnComplete(false, 'completed');
                setPipelinePhase((p) => (p === 'running' ? 'complete' : p));
                setStatusLine('Connection ended before pipeline finished.');
              }
              completeReceivedRef.current = false;
              resolve();
            },
          });
          sseRef.current = conn;
        });
        setPipelinePhase((p) => (p === 'running' ? 'complete' : p));
      } catch (e: unknown) {
        if (!streamAbortedRef.current) {
          const msg = e instanceof Error ? e.message : 'Connection failed';
          setError(msg);
          setPipelinePhase('error');
          upsertActivity('error', { label: 'Error', status: 'error', what: msg, expanded: true });
          appendTimeline({ kind: 'error', title: 'Connection failed', body: msg, status: 'error' });
        }
      } finally {
        sseRef.current = null;
        setIsAnalyzing(false);
        if (!outcomeHandledRef.current) {
          const dbAfter = await fetchDbShipments();
          const after = snapshotFromShipments(dbAfter, affectedIdRef.current || undefined);
          if (after && outcomeBefore && snapshotsEqual(outcomeBefore, after)) {
            setOutcomeAfter(null);
          } else if (after) {
            setOutcomeAfter(after);
          }
        }
      }
    },
    [
      appendTimeline,
      finalizeExecutionToolsOnComplete,
      finalizePipeline,
      handleEvent,
      outcomeBefore,
      setAffected,
      upsertActivity,
      abortActiveStream,
    ]
  );

  const toggleActivity = useCallback((id: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, expanded: !a.expanded } : a))
    );
  }, []);

  const resetDemo = useCallback(async (): Promise<true | string> => {
    if (isResetting) return 'Reset already in progress';
    setIsResetting(true);
    setError(null);
    abortActiveStream();
    setIsAnalyzing(false);
    setPipelinePhase('idle');
    setStatusLine('');
    try {
      await resetDemoSession();
      setTodos([]);
      setActivities([]);
      setTimeline([]);
      setSubagentNotices([]);
      seqRef.current = 0;
      setOutcomeBefore(null);
      setOutcomeAfter(null);
      outcomeHandledRef.current = false;
      completedExecutionToolsRef.current = new Set();
      setAffected(null);
      affectedIdRef.current = null;
      setSummaryDoc(null);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Reset failed';
      setError(msg);
      return msg;
    } finally {
      setIsResetting(false);
    }
  }, [abortActiveStream, isResetting]);

  return {
    isAnalyzing,
    reasoningOpen,
    setReasoningOpen,
    traceOpen,
    setTraceOpen,
    statusLine,
    todos,
    activities,
    timeline,
    pipelinePhase,
    progress,
    outcomeBefore,
    outcomeAfter,
    routeBeforeStops,
    routeAfterStops,
    summaryDoc,
    loadSummary,
    affectedId,
    error,
    isResetting,
    runAnalysis,
    resetDemo,
    toggleActivity,
    subagentNotices,
    dismissSubagentNotice,
  };
}
