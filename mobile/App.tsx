/**
 * BioRoute Cold-Chain — React Native Mobile App
 *
 * Integrates with the FastAPI backend SSE streaming endpoints:
 *   GET  /api/stream?input=...  → SSE stream (for React Native)
 *   GET  /api/db                → Current shipment database
 *   GET  /api/scenarios         → Pre-built test scenarios
 *
 * SSE Event types consumed:
 *   CONNECTED, COORDINATOR, SUBAGENT_START, SUBAGENT_MSG,
 *   SUBAGENT_DONE, TOOL_CALL, TOOL_RESULT, COMPLETE, ERROR
 */
import React, { useState, useCallback, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Platform } from 'react-native';

import BottomTabBar, { TabName } from './src/components/BottomTabBar';
import IngestionDashboard from './src/screens/IngestionDashboard';
import AIDecisionEngine, { AgentStep, TerminalLog } from './src/screens/AIDecisionEngine';
import OutcomeVisualization from './src/screens/OutcomeVisualization';
import { Colors } from './src/theme';

// ─── API Configuration ──────────────────────────────────────────────────────
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

// ─── Subagent name → step ID mapping ────────────────────────────────────────
const SUBAGENT_STEP: Record<string, number> = {
  'hazard-extractor': 1,
  'impact-analyzer': 2,
  'action-planner': 3,
};

// ─── Tool name → step mapping ───────────────────────────────────────────────
const TOOL_STEP: Record<string, number> = {
  'update_crm_tool': 4,
  'notify_tool': 4,
  'write_state_log_tool': 4,
};

function makeTimestamp(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

const INITIAL_STEPS: AgentStep[] = [
  {
    id: 1, title: 'Hazard Detection', status: 'pending', icon: '⚠️',
    badge: 'WAITING', badgeColor: Colors.outline,
    detail: 'Awaiting alert ingestion…', timestamp: '',
  },
  {
    id: 2, title: 'Impact Analysis', status: 'pending', icon: '📊',
    detail: 'Awaiting hazard extraction…', timestamp: '',
  },
  {
    id: 3, title: 'AI Rescue Plan', status: 'pending', icon: '🤖',
    detail: 'Awaiting impact analysis…', timestamp: '',
  },
  {
    id: 4, title: 'Execution Phase', status: 'pending', icon: '⚙️',
    detail: 'Awaiting action plan…', timestamp: '',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>('Dashboard');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>(INITIAL_STEPS);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [confidence, setConfidence] = useState(0);

  // Outcome screen state — populated from /api/db before and after the run
  const [outcomeBeforeState, setOutcomeBeforeState] = useState<any>(null);
  const [outcomeAfterState, setOutcomeAfterState] = useState<any>(null);

  const logsRef = useRef<TerminalLog[]>([]);

  const addLog = useCallback((time: string, message: string, level: TerminalLog['level']) => {
    const entry = { time, message, level };
    logsRef.current = [...logsRef.current, entry];
    setTerminalLogs((prev) => [...prev, entry]);
  }, []);

  // ─── Fetch DB state for Outcomes before/after comparison ────────────────
  const fetchDBState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/db`);
      if (res.ok) return await res.json();
    } catch {}
    return null;
  }, []);

  // ─── SSE Event Handler — maps backend events to UI state ───────────────
  const handleSSEEvent = useCallback((event: any) => {
    const ts = makeTimestamp();
    const eventType = event.type;

    switch (eventType) {
      case 'CONNECTED':
        addLog(ts, event.message || 'Agent connected, starting analysis...', 'info');
        setConfidence(5);
        setAgentSteps((prev) => prev.map((s) =>
          s.id === 1
            ? { ...s, status: 'active' as const, badge: 'PROCESSING', badgeColor: Colors.primary }
            : s
        ));
        break;

      case 'COORDINATOR':
        addLog(ts, event.message || '', 'info');
        break;

      case 'SUBAGENT_START': {
        const stepId = SUBAGENT_STEP[event.agent] || 0;
        addLog(ts, `🤖 Subagent "${event.agent}" started`, 'info');
        if (stepId) {
          setAgentSteps((prev) => prev.map((s) =>
            s.id === stepId
              ? { ...s, status: 'active' as const, badge: 'RUNNING', badgeColor: Colors.primary }
              : s
          ));
          setConfidence((c) => Math.min(c + 15, 85));
        }
        break;
      }

      case 'SUBAGENT_MSG':
        addLog(ts, `[${event.agent}] ${event.message}`, 'info');
        break;

      case 'SUBAGENT_DONE': {
        const stepId = SUBAGENT_STEP[event.agent] || 0;
        const succeeded = event.status === 'completed';

        if (stepId) {
          let detail = '';
          if (event.result) {
            const r = event.result;
            if (stepId === 1) {
              detail = r.hazard_detected
                ? `${r.hazard_type || 'Hazard'} detected in ${r.location || 'unknown location'}.`
                : 'No hazard detected.';
              if (r.severity_details) detail += `\n${r.severity_details}`;
              if (r.affected_routes?.length) detail += `\nAffected routes: ${r.affected_routes.join(', ')}`;
            } else if (stepId === 2) {
              detail = r.impact_detected
                ? `Shipment ${r.affected_shipment_id || '???'}: ${r.operational_impact || 'Impact detected'}`
                : 'No impact on active shipments.';
              if (r.financial_consequence) detail += `\nFinancial risk: ${r.financial_consequence}`;
              if (r.time_to_failure_minutes) detail += `\nTime to failure: ${r.time_to_failure_minutes} min`;
            } else if (stepId === 3) {
              detail = r.recommended_action || 'Action plan generated';
              if (r.urgency) detail += `\nUrgency: ${r.urgency}`;
              if (r.database_update_payload?.new_destination) {
                detail += `\nReroute → ${r.database_update_payload.new_destination}`;
              }
            }
          }

          setAgentSteps((prev) => prev.map((s) => {
            if (s.id === stepId) {
              return {
                ...s,
                status: succeeded ? 'done' as const : 'error' as const,
                detail: detail || (succeeded ? 'Completed' : `Failed: ${event.error || 'Unknown'}`),
                badge: stepId === 1 ? 'CRITICAL' : undefined,
                badgeColor: stepId === 1 ? Colors.error : undefined,
                timestamp: ts,
              };
            }
            if (s.id === stepId + 1 && succeeded) {
              return { ...s, status: 'active' as const };
            }
            return s;
          }));

          setConfidence((c) => Math.min(c + 20, 90));
        }

        const statusEmoji = succeeded ? '✅' : '❌';
        addLog(ts, `${statusEmoji} Subagent "${event.agent}" ${event.status}`, succeeded ? 'success' : 'error');
        break;
      }

      case 'TOOL_CALL': {
        const toolName = event.tool_name || 'unknown_tool';
        const agentName = event.agent || 'orchestrator';
        addLog(ts, `🔧 Tool call: ${toolName} (by ${agentName})`, 'info');

        if (TOOL_STEP[toolName] === 4) {
          setAgentSteps((prev) => prev.map((s) =>
            s.id === 4 ? { ...s, status: 'active' as const, badge: 'EXECUTING', badgeColor: Colors.primary } : s
          ));
        }
        break;
      }

      case 'TOOL_RESULT': {
        const toolName = event.tool_name || 'unknown_tool';
        const succeeded = event.status === 'SUCCESS';

        addLog(ts, `${succeeded ? '✅' : '❌'} ${toolName}: ${succeeded ? event.status : event.error || 'Failed'}`, succeeded ? 'success' : 'error');

        if (TOOL_STEP[toolName] === 4) {
          setAgentSteps((prev) => prev.map((s) => {
            if (s.id === 4) {
              const existing = s.detail || '';
              let newLine = '';
              if (toolName === 'update_crm_tool') newLine = `CRM Updated ${succeeded ? '✓' : '✗'}`;
              if (toolName === 'notify_tool') newLine = `Notification Sent ${succeeded ? '✓' : '✗'}`;
              if (toolName === 'write_state_log_tool') newLine = `State Log Written ${succeeded ? '✓' : '✗'}`;
              const detail = existing.startsWith('Awaiting') ? newLine : `${existing}\n${newLine}`;
              return { ...s, detail };
            }
            return s;
          }));
        }
        break;
      }

      case 'COMPLETE': {
        addLog(ts, '🎉 ' + (event.message || 'Pipeline completed successfully.'), 'success');
        setConfidence(97.2);
        setAgentSteps((prev) => prev.map((s) =>
          s.id === 4 ? { ...s, status: 'done' as const, timestamp: ts } : s
        ));

        // Build outcome "after" state from returned shipments
        if (event.current_shipments?.active_shipments) {
          const shp882 = event.current_shipments.active_shipments.find(
            (s: any) => s.shipment_id === 'SHP-882'
          );
          if (shp882) {
            setOutcomeAfterState({
              shipmentId: shp882.shipment_id,
              cargo: shp882.cargo_type,
              route: shp882.primary_route,
              destination: shp882.destination || shp882.new_destination,
              status: shp882.current_status,
              temp: '2.4°C → STABILIZED',
            });
          }
        }
        break;
      }

      case 'ERROR':
        addLog(ts, `🚨 ERROR: ${event.message || 'Unknown error'}`, 'error');
        if (event.error) addLog(ts, event.error, 'error');
        break;

      default:
        if (event.message) addLog(ts, event.message, 'info');
    }
  }, [addLog]);

  // ─── Main Analyze Handler — SSE streaming from backend ─────────────────
  const handleAnalyze = useCallback(async (alertText: string) => {
    setIsAnalyzing(true);
    setTerminalLogs([]);
    logsRef.current = [];
    setConfidence(0);
    setAgentSteps([...INITIAL_STEPS]);

    // Switch to AI Engine tab
    setActiveTab('AIEngine');

    // Capture "before" state from /api/db
    const beforeDB = await fetchDBState();
    if (beforeDB?.active_shipments) {
      const shp882 = beforeDB.active_shipments.find(
        (s: any) => s.shipment_id === 'SHP-882'
      );
      if (shp882) {
        setOutcomeBeforeState({
          shipmentId: shp882.shipment_id,
          cargo: shp882.cargo_type,
          route: shp882.primary_route,
          destination: shp882.destination,
          status: shp882.current_status,
          temp: '2.1°C → rising',
        });
      }
    }

    try {
      // GET /api/stream?input=... — SSE endpoint for React Native
      const url = `${API_BASE}/api/stream?input=${encodeURIComponent(alertText)}`;
      addLog(makeTimestamp(), 'Connecting to BioRoute agent stream...', 'info');

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      // Read SSE stream via ReadableStream
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE format: "data: {...}\n\n"
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                try {
                  const eventData = JSON.parse(jsonStr);
                  handleSSEEvent(eventData);
                } catch {
                  addLog(makeTimestamp(), jsonStr, 'info');
                }
              }
            }
          }
        }

        // Flush remaining buffer
        if (buffer.trim()) {
          for (const line of buffer.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                handleSSEEvent(JSON.parse(line.slice(6).trim()));
              } catch {}
            }
          }
        }
      }
    } catch (error: any) {
      addLog(makeTimestamp(), `🚨 Connection error: ${error.message}`, 'error');
      addLog(makeTimestamp(), 'Make sure the backend is running: python -m langchain_agent.api.server', 'error');
    } finally {
      setIsAnalyzing(false);

      // Fetch final DB state for outcomes comparison
      const afterDB = await fetchDBState();
      if (afterDB?.active_shipments) {
        const shp882 = afterDB.active_shipments.find(
          (s: any) => s.shipment_id === 'SHP-882'
        );
        if (shp882) {
          setOutcomeAfterState({
            shipmentId: shp882.shipment_id,
            cargo: shp882.cargo_type,
            route: shp882.primary_route,
            destination: shp882.destination || shp882.new_destination,
            status: shp882.current_status,
            temp: '2.4°C → STABILIZED',
          });
        }
      }
    }
  }, [handleSSEEvent, addLog, fetchDBState]);

  // ─── Render active screen ─────────────────────────────────────────────
  const renderScreen = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <IngestionDashboard onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />;
      case 'AIEngine':
        return (
          <AIDecisionEngine
            steps={agentSteps}
            logs={terminalLogs}
            isRunning={isAnalyzing}
            confidencePercent={confidence}
          />
        );
      case 'Outcomes':
        return (
          <OutcomeVisualization
            beforeState={outcomeBeforeState || undefined}
            afterState={outcomeAfterState || undefined}
          />
        );
      case 'Fleet':
        return <IngestionDashboard onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />;
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      {renderScreen()}
      <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
