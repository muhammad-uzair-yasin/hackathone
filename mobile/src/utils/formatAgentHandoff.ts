/** Human-readable lines for what a subagent returns to the orchestrator */
export function formatAgentHandoff(agent: string, result: Record<string, unknown>): string {
  const lines: string[] = ['→ Passed back to orchestrator'];
  const summary = result.display_summary as string | undefined;
  const why = result.why_brief as string | undefined;
  if (summary) lines.push(`Summary: ${summary}`);
  if (why) lines.push(`Why: ${why}`);

  if (agent === 'hazard-detector') {
    if (result.hazard_detected != null) lines.push(`Hazard: ${result.hazard_detected ? 'yes' : 'no'}`);
    if (result.location) lines.push(`Location: ${result.location}`);
    if (result.affected_routes) lines.push(`Routes: ${String(result.affected_routes)}`);
  }
  if (agent === 'shipment-analyzer' && Array.isArray(result.active_shipments)) {
    const ids = (result.active_shipments as { shipment_id: string; route_name: string }[])
      .map((s) => `${s.shipment_id} (${s.route_name})`)
      .join(', ');
    lines.push(`Fleet: ${ids}`);
  }
  if (agent === 'impact-analyzer') {
    if (result.impact_detected != null) lines.push(`Impact: ${result.impact_detected ? 'yes' : 'no'}`);
    if (result.affected_shipment_id) lines.push(`Affected: ${result.affected_shipment_id}`);
    if (result.risk_level) lines.push(`Risk: ${result.risk_level}`);
  }
  if (agent === 'action-planner') {
    if (result.selected_route_name) lines.push(`Route: ${result.selected_route_name}`);
    if (result.selection_rationale) lines.push(`Rationale: ${result.selection_rationale}`);
  }
  return lines.join('\n');
}

export function previewJson(value: unknown, max = 600): string {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(value).slice(0, max);
  }
}

export function taskInputPreview(args: Record<string, unknown>): string {
  const raw =
    args.task ??
    args.input ??
    args.description ??
    args.instructions ??
    args;
  const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}
