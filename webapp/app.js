/**
 * BioRoute Cold-Chain — Web dashboard
 */

const API = (() => {
  const host = location.hostname || 'localhost';
  if (location.port === '8000') return location.origin;
  return `http://${host}:8000`;
})();

const traceContainer = document.getElementById('trace-container');
const pipelineContainer = document.getElementById('pipeline-steps');
const todoSidebar = document.getElementById('todo-sidebar');
const startOverlay = document.getElementById('start-overlay');
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');

const PIPELINE_DEF = [
  { step: 1, label: 'Hazard Alert', placeholder: 'Reading alert…' },
  { step: 2, label: 'Active Fleet', placeholder: 'Listing shipments…' },
  { step: 3, label: 'Route Impact', placeholder: 'Who is affected…' },
  { step: 4, label: 'Action Plan', placeholder: 'Choosing route…' },
  { step: 5, label: 'Execution', placeholder: 'Route update & alerts…' },
];

const PIPELINE_MAX_STEP = 5;

const AGENT_TO_STEP = {
  'hazard-detector': 1,
  'shipment-analyzer': 2,
  'impact-analyzer': 3,
  'action-planner': 4,
};

const judgeReasoning = {
  masterOpen: true,
  steps: [],
};

const TOOL_LABELS = {
  update_crm_tool: 'Updating route',
  notify_tool: 'Send hospital notification',
  write_summary_tool: 'Write run summary (summary.md)',
};

const PHASE_LABELS = {
  baseline: 'All active routes',
  hazard: 'Hazard detected',
  impact: 'Impact assessed',
  rerouted: 'Routes updated by AI',
  clear: 'All routes safe',
};

const fleetRouteState = {
  shipments: [],
  phase: 'baseline',
  hazard: null,
  impact: null,
  reroutes: {},
  viewMode: 'all', // 'all' | 'focused' — focused shows only affected shipment
  todos: [],
  newsAlert: null,
  fleet: null,
};

let cachedScenarios = null;

let fleetMap = null;

function getFleetMap() {
  if (!fleetMap && typeof FleetMap !== 'undefined') {
    fleetMap = new FleetMap('fleet-map-container');
  }
  return fleetMap;
}

function refreshFleetMap() {
  const map = getFleetMap();
  if (map) {
    map.render({
      shipments: getDisplayShipments(),
      reroutes: fleetRouteState.reroutes,
      hazard: fleetRouteState.hazard,
      impact: fleetRouteState.impact,
      viewMode: fleetRouteState.viewMode,
    });
  }
}

function parseCrmPayload(result) {
  if (!result) return null;
  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }
  if (result.before_state || result.success) return result;
  return null;
}

function syncFleetFromComplete(e) {
  if (!e.current_shipments?.active_shipments) return false;
  fleetRouteState.shipments = e.current_shipments.active_shipments
    .slice(0, MAX_FLEET_SHIPMENTS)
    .map((s) => ({ ...s }));
  let synced = false;
  for (const s of fleetRouteState.shipments) {
    if (!/reroute/i.test(s.current_status || '')) continue;
    synced = true;
    const id = s.shipment_id;
    const prev = fleetRouteState.reroutes[id] || {};
    fleetRouteState.reroutes[id] = {
      ...prev,
      pending: false,
      after: {
        route_name: s.route_name,
        destination: getShipmentDestination(s),
        current_status: s.current_status,
        route: (s.route || []).map((p) => ({ ...p })),
      },
      new_route: s.route_name,
      new_destination: getShipmentDestination(s),
    };
  }
  if (synced) {
    fleetRouteState.phase = 'rerouted';
    renderRouteMapPanel();
  }
  return synced;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortPlace(name, max = 28) {
  const t = String(name || '');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const MAX_FLEET_SHIPMENTS = 4;

function findAlternative(shipment, routeName) {
  if (!routeName || !shipment?.alternative_routes) return null;
  return (
    shipment.alternative_routes.find((a) => a.name === routeName || a.id === routeName) ||
    null
  );
}

function getRoutePoints(shipment, alternativeName = null) {
  if (alternativeName) {
    const alt = findAlternative(shipment, alternativeName);
    if (alt?.stops) return alt.stops;
    if (shipment.backup_route_name === alternativeName) return shipment.backup_route || [];
  }
  return shipment.route || [];
}

function getRouteStops(shipment, alternativeName = null) {
  return getRoutePoints(shipment, alternativeName).map((p) =>
    typeof p === 'string' ? p : p.place || ''
  );
}

function getShipmentRouteName(shipment) {
  return shipment.route_name || '';
}

function getShipmentDestination(shipment, alternativeName = null) {
  const stops = getRouteStops(shipment, alternativeName);
  return stops[stops.length - 1] || '';
}

function routeChainLabel(stops) {
  if (!stops?.length) return '';
  if (stops.length <= 3) return stops.map(shortPlace).join(' → ');
  return `${shortPlace(stops[0], 18)} → ${shortPlace(stops[1], 14)} → … → ${shortPlace(stops[stops.length - 1], 18)}`;
}

function routeOverlapsHazard(shipment, hazard) {
  if (!hazard || !shipment) return false;
  const altNames = (shipment.alternative_routes || []).flatMap((a) => [
    a.name,
    a.notes,
    ...(a.stops || []).map((p) => (typeof p === 'string' ? p : p.place)),
  ]);
  const blob = [
    getShipmentRouteName(shipment),
    getShipmentDestination(shipment),
    ...altNames,
    ...getRouteStops(shipment),
    ...(shipment.alternative_routes || []).flatMap((a) =>
      (a.stops || []).map((p) => (typeof p === 'string' ? p : p.place))
    ),
  ]
    .join(' ')
    .toLowerCase();
  const affected = (hazard.affected_routes || []).map((r) => r.toLowerCase());
  const districts = (hazard.affected_districts || []).map((d) => d.toLowerCase());
  const loc = (hazard.location || '').toLowerCase();
  if (affected.some((r) => blob.includes(r) || r.includes('n-5') && blob.includes('n-5'))) return true;
  if (districts.some((d) => blob.includes(d))) return true;
  if (loc && blob.includes(loc)) return true;
  return false;
}

// ─── Waypoint timeline (numbered 1, 2, 3, 4…) ───────────────────────────────

function renderWaypointTimeline(stops, opts = {}) {
  const { lineClass = 'active', showHazard = false, eta = null, label = '' } = opts;
  const n = stops.length;
  if (n < 2) return '';

  const nodes = stops
    .map((place, i) => {
      const isStart = i === 0;
      const isEnd = i === n - 1;
      const num = String(i + 1);
      const ring =
        isStart
          ? 'bg-blue-600 border-blue-400 text-white'
          : isEnd
            ? 'bg-emerald-600 border-emerald-400 text-white'
            : 'bg-zinc-800 border-violet-400 text-violet-200';
      return `
        <div class="flex flex-col items-center flex-1 min-w-0 px-0.5">
          <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${ring} z-10 shrink-0">${num}</div>
          <span class="text-[9px] sm:text-[10px] text-zinc-400 mt-1.5 text-center leading-tight w-full" title="${escapeHtml(place)}">${escapeHtml(shortPlace(place, 22))}</span>
        </div>`;
    })
    .join('');

  return `
    ${label ? `<p class="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">${escapeHtml(label)}</p>` : ''}
    <div class="relative w-full pt-1 pb-2">
      ${showHazard ? '<div class="waypoint-line-bar hazard"></div>' : ''}
      <div class="waypoint-line-bar ${lineClass}"></div>
      <div class="relative z-10 flex justify-between items-start w-full">${nodes}</div>
      ${eta != null ? `<span class="absolute left-1/2 top-2.5 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full bg-white text-zinc-900 text-[10px] font-bold shadow-md">${eta} min</span>` : ''}
    </div>
  `;
}

function renderRouteCard(shipment, opts = {}) {
  const hazard = fleetRouteState.hazard;
  const reroute = fleetRouteState.reroutes[shipment.shipment_id];
  const isAffected =
    opts.affected ?? (reroute ? true : routeOverlapsHazard(shipment, hazard));
  const isRerouted = !!reroute && (!!reroute.after || reroute.pending);

  let status = shipment.current_status;
  let routeName = getShipmentRouteName(shipment);
  let eta = shipment.eta_minutes;
  let changeReason = null;

  const border = isRerouted
    ? 'border-violet-500/50 ring-2 ring-violet-500/30'
    : opts.highlight && isAffected
      ? 'border-red-500/50 ring-2 ring-red-500/25'
      : isAffected
        ? 'border-red-500/40 ring-1 ring-red-500/15'
        : 'border-zinc-700/80';

  const statusCls = isRerouted
    ? 'bg-red-500/15 text-red-300 border-red-500/30'
    : isAffected
      ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

  let timelines = renderWaypointTimeline(getRouteStops(shipment), {
    lineClass: isAffected && !isRerouted ? 'active' : 'active',
    showHazard: isAffected && !isRerouted,
    eta: shipment.eta_minutes,
    label: isRerouted ? '' : 'Original route',
  });

  if (isRerouted && reroute) {
    changeReason = reroute.reason;
    status = reroute.pending ? 'Reroute pending…' : 'Emergency Reroute';
    routeName = reroute.after?.route_name || reroute.new_route || routeName;
    const originalStops = reroute.beforeSnapshot?.route?.length
      ? reroute.beforeSnapshot.route.map((p) => (typeof p === 'string' ? p : p.place))
      : reroute.before?.route?.length
        ? reroute.before.route.map((p) => (typeof p === 'string' ? p : p.place))
        : getRouteStops(shipment);
    const plannedName = reroute.new_route || reroute.after?.route_name;
    const activeStops = reroute.pending
      ? getRouteStops(shipment, plannedName)
      : getRouteStops(shipment);
    timelines =
      renderWaypointTimeline(originalStops, {
        lineClass: 'original',
        label: 'Original route (before AI)',
      }) +
      `<div class="mt-4">` +
      renderWaypointTimeline(activeStops, {
        lineClass: 'active',
        eta: reroute.pending ? null : eta,
        label: reroute.pending ? 'Planned AI reroute' : 'Active route (after AI)',
      }) +
      `</div>`;
  }

  return `
    <article class="rounded-xl border ${border} bg-zinc-900/60 p-4 backdrop-blur-sm" data-shipment="${escapeHtml(shipment.shipment_id)}">
      <div class="flex justify-between items-start gap-3 mb-3">
        <div>
          <p class="font-semibold text-sm flex items-center gap-2">🚚 ${escapeHtml(shipment.shipment_id)}</p>
          <p class="text-xs text-zinc-500 mt-0.5">${escapeHtml(shipment.cargo_type)}</p>
          <p class="text-[10px] text-violet-400/90 mt-1">${escapeHtml(routeName)}</p>
          <p class="text-[10px] text-zinc-500 mt-0.5">${escapeHtml(
            isRerouted && reroute
              ? routeChainLabel(
                  reroute.pending
                    ? getRouteStops(shipment, reroute.new_route || reroute.after?.route_name)
                    : getRouteStops(shipment)
                )
              : routeChainLabel(getRouteStops(shipment))
          )}</p>
        </div>
        <span class="text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${statusCls}">${escapeHtml(status)}</span>
      </div>
      ${timelines}
      ${changeReason ? `
        <p class="mt-3 text-xs text-violet-200/90 pl-3 border-l-2 border-violet-500 leading-relaxed">
          <span class="block text-[10px] uppercase tracking-wider text-violet-400 mb-1">Why route changed</span>
          ${escapeHtml(changeReason)}
        </p>` : ''}
    </article>
  `;
}

function getAffectedShipmentId() {
  return (
    fleetRouteState.impact?.affected_shipment_id ||
    Object.keys(fleetRouteState.reroutes)[0] ||
    null
  );
}

function getDisplayShipments() {
  const affectedId = getAffectedShipmentId();
  if (fleetRouteState.viewMode === 'focused' && affectedId) {
    const ship = fleetRouteState.shipments.find((s) => s.shipment_id === affectedId);
    return ship ? [ship] : fleetRouteState.shipments.slice(0, 1);
  }
  return fleetRouteState.shipments;
}

function setFleetViewMode(mode) {
  fleetRouteState.viewMode = mode;
  updateFleetRailButtons();
  renderRouteMapPanel();
}

function updateFleetRailButtons() {
  const focusBtn = document.getElementById('btn-fleet-focus');
  const allBtn = document.getElementById('btn-fleet-all');
  if (!focusBtn || !allBtn) return;
  const focused = fleetRouteState.viewMode === 'focused';
  focusBtn.classList.toggle('ring-2', focused);
  focusBtn.classList.toggle('ring-violet-400', focused);
  focusBtn.setAttribute('aria-pressed', focused ? 'true' : 'false');
  allBtn.classList.toggle('ring-2', !focused);
  allBtn.classList.toggle('ring-violet-400', !focused);
  allBtn.setAttribute('aria-pressed', !focused ? 'true' : 'false');
}

function getRouteMapMount() {
  const overlay = document.getElementById('start-overlay');
  const hidden = overlay?.classList.contains('hidden');
  if (overlay && !hidden) return document.getElementById('preview-route-map');
  let panel = document.getElementById('route-map-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'route-map-panel';
    panel.className =
      'route-panel rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/40 to-zinc-900/80 p-5 mb-6';
    traceContainer.prepend(panel);
  }
  return panel;
}

function renderRouteMapPanel() {
  const panel = getRouteMapMount();
  if (!panel) return;

  const phase = fleetRouteState.phase;
  const affectedId = getAffectedShipmentId();
  const displayShipments = getDisplayShipments();
  const focused = fleetRouteState.viewMode === 'focused' && !!affectedId;
  const hazardText =
    fleetRouteState.impact?.display_summary ||
    fleetRouteState.hazard?.display_summary ||
    fleetRouteState.hazard?.severity_details ||
    '';

  const hazardBanner = hazardText
    ? `<div class="mb-4 flex gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-100">
        <span>⚠️</span>
        <div><strong class="text-red-300">Condition:</strong> ${escapeHtml(hazardText)}</div>
      </div>`
    : '';

  const cards = displayShipments
    .map((s) => renderRouteCard(s, { affected: true, highlight: focused }))
    .join('');

  const title = focused
    ? `🎯 Affected shipment — ${affectedId}`
    : '🗺️ Live Fleet Routes — Pakistan';

  panel.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-sm font-semibold text-white">${title}</h3>
      <span class="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300">${PHASE_LABELS[phase] || phase}</span>
    </div>
    <p class="text-[10px] text-zinc-500 mb-2">${focused ? 'Grey dashed = original · Violet = route after AI' : 'Pan and zoom · use 🎯 left rail to focus affected route'}</p>
    <div id="fleet-map-container" class="mb-5"></div>
    ${hazardBanner}
    <div class="space-y-4">${cards}</div>
    <div class="flex flex-wrap gap-4 mt-4 pt-3 border-t border-zinc-800 text-[10px] text-zinc-500">
      <span class="flex items-center gap-1.5"><i class="w-4 h-1 rounded bg-gradient-to-r from-violet-500 to-indigo-500"></i> Active route</span>
      <span class="flex items-center gap-1.5"><i class="w-4 h-0.5 border-t-2 border-dashed border-zinc-500"></i> Original (before AI)</span>
    </div>
  `;

  const inlineToggle = document.getElementById('fleet-toggle-inline');
  if (!inlineToggle) {
    const headerRow = panel.querySelector('.flex.flex-wrap');
    if (headerRow) {
      const btn = document.createElement('button');
      btn.id = 'fleet-toggle-inline';
      btn.type = 'button';
      btn.className = 'lg:hidden text-[10px] px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-400';
      btn.textContent = focused ? 'Show all routes' : 'Focus affected';
      btn.onclick = () => setFleetViewMode(focused ? 'all' : 'focused');
      headerRow.querySelector('.flex.items-center')?.prepend(btn);
    }
  }

  requestAnimationFrame(() => {
    refreshFleetMap();
    setTimeout(refreshFleetMap, 150);
  });
}

// ─── Judge reasoning (GPT-style collapsible steps) ───────────────────────────

function resetJudgeReasoning() {
  judgeReasoning.masterOpen = true;
  judgeReasoning.steps = PIPELINE_DEF.map((p) => ({
    step: p.step,
    label: p.label,
    status: 'pending',
    what: p.placeholder,
    why: '',
    extra: '',
    expanded: false,
  }));
}

function showJudgePanels() {
  const panel = document.getElementById('judge-reasoning-panel');
  const strip = document.getElementById('judge-status-strip');
  panel?.classList.remove('hidden');
  panel?.classList.add('is-visible');
  strip?.classList.remove('hidden');
  strip?.classList.add('is-visible');
  renderJudgeStatusStrip();
  renderJudgeReasoning();
}

function renderJudgeStatusStrip() {
  const el = document.getElementById('judge-status-strip');
  if (!el) return;
  const done = judgeReasoning.steps.filter((s) => s.status === 'done');
  const active = judgeReasoning.steps.find((s) => s.status === 'active');
  const latest = done[done.length - 1] || active;
  if (!latest?.what || latest.what.includes('…')) {
    el.textContent = active ? `Step ${active.step}: ${active.label}…` : 'Agent reasoning in progress…';
    return;
  }
  el.textContent = latest.what;
}

function setJudgeStep(stepNum, patch) {
  const s = judgeReasoning.steps.find((x) => x.step === stepNum);
  if (!s) return;
  Object.assign(s, patch);
  renderJudgeStatusStrip();
  renderJudgeReasoning();
}

function expandJudgeStep(stepNum) {
  judgeReasoning.steps.forEach((s) => {
    s.expanded = s.step === stepNum;
  });
  renderJudgeReasoning();
}

function updateJudgeFromAgent(agent, result, summary) {
  const stepNum = AGENT_TO_STEP[agent];
  if (!stepNum || !result) return;
  const what = summary || result.display_summary || '';
  const why = result.why_brief || '';
  let extra = '';
  if (agent === 'fleet-scout' && result.active_shipments?.length) {
    extra = result.active_shipments
      .map((s) => `${s.shipment_id}: ${s.route_name}`)
      .join(' · ');
  }
  if (agent === 'impact-analyzer' && result.unaffected_shipment_ids?.length) {
    extra = `Clear: ${result.unaffected_shipment_ids.join(', ')}`;
  }
  if (agent === 'action-planner' && result.selection_rationale) {
    extra = result.selection_rationale;
  }
  setJudgeStep(stepNum, {
    status: 'done',
    what,
    why,
    extra,
    expanded: false,
  });
  const next = judgeReasoning.steps.find((s) => s.step === stepNum + 1);
  if (next) {
    setJudgeStep(next.step, { status: 'active', expanded: true });
    expandJudgeStep(next.step);
  }
}

function updateJudgeExecution(summary, why = '') {
  setJudgeStep(5, {
    status: 'done',
    what: summary || 'Route updated and hospital notified',
    why: why || 'System state changed to match the plan',
    expanded: true,
  });
  expandJudgeStep(5);
}

function renderJudgeReasoning() {
  const panel = document.getElementById('judge-reasoning-panel');
  if (!panel) return;

  const doneCount = judgeReasoning.steps.filter((s) => s.status === 'done').length;
  const stepsHtml = judgeReasoning.steps
    .map((s) => {
      const statusCls = s.status === 'done' ? 'is-done' : s.status === 'active' ? 'is-active' : 'is-pending';
      const expandedCls = s.expanded ? 'is-expanded' : '';
      const preview =
        s.status === 'pending' ? s.what || 'Waiting…' : s.what || '—';
      const chevronOpen = s.expanded ? 'is-open' : '';
      return `
        <div class="judge-step ${statusCls} ${expandedCls}" data-step="${s.step}">
          <button type="button" class="judge-step-header" aria-expanded="${s.expanded}" data-judge-step="${s.step}">
            <span class="judge-reasoning-chevron ${chevronOpen}">▶</span>
            <span class="judge-step-num">${s.status === 'done' ? '✓' : s.step}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-[10px] uppercase tracking-wider text-zinc-500">${escapeHtml(s.label)}</span>
              <span class="judge-step-preview">${escapeHtml(preview)}</span>
            </span>
          </button>
          <div class="judge-step-detail">
            ${s.what ? `<p>${escapeHtml(s.what)}</p>` : ''}
            ${s.why ? `<p class="why"><strong>Why:</strong> ${escapeHtml(s.why)}</p>` : ''}
            ${s.extra ? `<p class="extra">${escapeHtml(s.extra)}</p>` : ''}
          </div>
        </div>`;
    })
    .join('');

  const masterOpen = judgeReasoning.masterOpen;
  panel.innerHTML = `
    <div class="judge-reasoning-header" id="judge-reasoning-toggle" role="button" tabindex="0" aria-expanded="${masterOpen}">
      <div class="min-w-0">
        <p class="text-[10px] uppercase tracking-wider text-violet-400">Agent reasoning</p>
        <p class="text-sm font-medium text-white truncate">${doneCount}/${PIPELINE_MAX_STEP} steps</p>
      </div>
      <span class="judge-reasoning-chevron ${masterOpen ? 'is-open' : ''}">▶</span>
    </div>
    <div class="judge-reasoning-body ${masterOpen ? 'is-open' : ''}" id="judge-reasoning-body">
      ${stepsHtml}
    </div>`;

  panel.querySelector('#judge-reasoning-toggle')?.addEventListener('click', () => {
    judgeReasoning.masterOpen = !judgeReasoning.masterOpen;
    renderJudgeReasoning();
  });

  panel.querySelectorAll('[data-judge-step]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const n = Number(btn.getAttribute('data-judge-step'));
      const step = judgeReasoning.steps.find((s) => s.step === n);
      if (step) {
        step.expanded = !step.expanded;
        renderJudgeReasoning();
      }
    });
  });
}

function initJudgeReasoningUi() {
  resetJudgeReasoning();
}

// ─── Pipeline & todos ────────────────────────────────────────────────────────

function initPipeline() {
  if (!pipelineContainer) return;
  pipelineContainer.innerHTML = PIPELINE_DEF.map(
    (p) => `
    <div id="pipeline-step-${p.step}" class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5 flex gap-2.5">
      <span class="w-6 h-6 rounded-full border border-zinc-600 flex items-center justify-center text-[10px] font-bold text-zinc-400" id="pipeline-num-${p.step}">${p.step}</span>
      <div class="min-w-0">
        <p class="text-[10px] uppercase tracking-wider text-zinc-500">${p.label}</p>
        <p class="text-xs text-zinc-500 mt-0.5" id="pipeline-summary-${p.step}">${p.placeholder}</p>
      </div>
    </div>`
  ).join('');
}

function setPipelineStep(step, summary, state) {
  const el = document.getElementById(`pipeline-step-${step}`);
  const sumEl = document.getElementById(`pipeline-summary-${step}`);
  const num = document.getElementById(`pipeline-num-${step}`);
  if (!el) return;
  el.className =
    'rounded-lg border p-2.5 flex gap-2.5 ' +
    (state === 'done'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : state === 'active'
        ? 'border-violet-500/40 bg-violet-500/10'
        : 'border-zinc-800 bg-zinc-900/50');
  if (num && state === 'done') num.className = 'w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white';
  if (num && state === 'active') num.className = 'w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-[10px] font-bold text-white';
  if (summary && sumEl) {
    sumEl.textContent = summary;
    sumEl.classList.remove('text-zinc-500');
    sumEl.classList.add('text-zinc-200');
  }
}

function renderTodos(todos) {
  if (!todos?.length || !todoSidebar) return;
  fleetRouteState.todos = todos.map((t) => ({ ...t }));
  todoSidebar.innerHTML = fleetRouteState.todos
    .map((t) => {
      const icon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '⏳' : '⚪';
      return `<div class="flex gap-2 text-xs text-zinc-300 mb-2"><span>${icon}</span><span>${escapeHtml(t.content)}</span></div>`;
    })
    .join('');
}

function completeReasoningTodos() {
  if (!fleetRouteState.todos.length) return;
  const keywords = ['summary', 'document', 'summary.md'];
  fleetRouteState.todos = fleetRouteState.todos.map((t) => {
    const lower = (t.content || '').toLowerCase();
    if (keywords.some((k) => lower.includes(k))) return { ...t, status: 'completed' };
    return t;
  });
  renderTodos(fleetRouteState.todos);
}

// ─── Fleet data ──────────────────────────────────────────────────────────────

async function loadFleetPreview() {
  const preview = document.getElementById('preview-route-map');
  try {
    const res = await fetch(`${API}/api/baseline`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    fleetRouteState.shipments = (data.active_shipments || [])
      .slice(0, MAX_FLEET_SHIPMENTS)
      .map((s) => ({ ...s }));
    fleetRouteState.phase = 'baseline';
    fleetRouteState.hazard = null;
    fleetRouteState.fleet = null;
    fleetRouteState.impact = null;
    fleetRouteState.reroutes = {};
    fleetRouteState.viewMode = 'all';
    updateFleetRailButtons();
    renderRouteMapPanel();
  } catch (e) {
    if (preview) {
      preview.innerHTML = `<p class="text-center text-zinc-500 text-sm py-8">Could not load routes. Run API on port 8000:<br><code class="text-violet-400 text-xs mt-2 block">uv run uvicorn langchain_agent.api.server:app --port 8000</code></p>`;
    }
  }
}

async function loadFleetBaseline() {
  try {
    const res = await fetch(`${API}/api/db`);
    if (!res.ok) return;
    const data = await res.json();
    fleetRouteState.shipments = (data.active_shipments || [])
      .slice(0, MAX_FLEET_SHIPMENTS)
      .map((s) => ({ ...s }));
    fleetRouteState.phase = 'baseline';
    fleetRouteState.hazard = null;
    fleetRouteState.fleet = null;
    fleetRouteState.impact = null;
    fleetRouteState.reroutes = {};
    fleetRouteState.viewMode = 'all';
    updateFleetRailButtons();
    renderRouteMapPanel();
  } catch (e) {
    console.warn('loadFleetBaseline', e);
  }
}

// ─── Agent stream UI ─────────────────────────────────────────────────────────

async function getRandomScenario() {
  const res = await fetch(`${API}/api/scenarios`);
  const data = await res.json();
  const hazards = data.scenarios.filter((s) => s.affects_shipment);
  return hazards[Math.floor(Math.random() * hazards.length)];
}

function agentCardDesc(r) {
  if (!r) return '';
  const parts = [r.display_summary, r.why_brief ? `Why: ${r.why_brief}` : null].filter(Boolean);
  return parts.join(' — ');
}

function compactAgentResult(agent, r) {
  if (!r) return null;
  if (agent === 'hazard-extractor') {
    return {
      location: r.location,
      severity: r.severity_level,
      why: r.why_brief,
    };
  }
  if (agent === 'fleet-scout') {
    return {
      active: r.total_active,
      why: r.why_brief,
    };
  }
  if (agent === 'impact-analyzer') {
    return {
      affected: r.affected_shipment_id,
      risk: r.risk_level,
      why: r.why_brief,
    };
  }
  if (agent === 'action-planner') {
    const db = r.database_simulation_payload || r.database_update_payload;
    return {
      route: r.selected_route_name || db?.new_route,
      why: r.why_brief,
    };
  }
  return null;
}

function formatMessage(msg) {
  if (!msg) return null;
  if (msg.startsWith('Updated todo list to')) return null;
  if (msg.trim().startsWith('{') || msg.includes('active_shipments')) return null;
  if (msg.includes("STATE LOG WRITTEN")) return null;
  const lower = msg.toLowerCase();
  if (lower.includes("i'll process this emergency") || lower.includes('processing through multi-agent')) return null;
  if (lower.startsWith('alert received') && window.__coordAlertShown) return null;
  if (lower.startsWith('alert received')) window.__coordAlertShown = true;
  return escapeHtml(msg).replace(/\n/g, '<br>');
}

function appendEvent(type, title, desc, data, kind) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const icons = { coordinator: '🧠', subagent: '🤖', tool: '🔧', complete: '✅' };
  let dataHtml = '';
  if (data && typeof data === 'object') {
    dataHtml =
      '<dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">' +
      Object.entries(data)
        .filter(([, v]) => v != null && v !== '')
        .map(
          ([k, v]) =>
            `<dt class="text-zinc-500">${escapeHtml(k.replace(/_/g, ' '))}</dt><dd class="text-zinc-300">${escapeHtml(String(v))}</dd>`
        )
        .join('') +
      '</dl>';
  }
  const card = document.createElement('div');
  card.className = 'event-card rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 flex gap-3';
  if (kind === 'coordinator' || kind === 'subagent' || kind === 'tool') {
    card.classList.add('trace-verbose');
  }
  card.innerHTML = `
    <span class="text-xl">${icons[kind] || '•'}</span>
    <div class="flex-1 min-w-0">
      <div class="flex justify-between text-[10px] text-zinc-500 uppercase tracking-wider"><span>${escapeHtml(type)}</span><span>${time}</span></div>
      <p class="font-medium text-sm mt-1">${escapeHtml(title)}</p>
      ${desc ? `<p class="text-sm text-zinc-400 mt-1">${desc}</p>` : ''}
      ${dataHtml}
    </div>`;
  traceContainer.appendChild(card);
  traceContainer.scrollTop = traceContainer.scrollHeight;
}

async function showSummaryCard(preview, fileName = 'summary.md') {
  let text = preview || '';
  if (!text) {
    try {
      const res = await fetch(`${API}/api/summary`);
      if (res.ok) {
        const data = await res.json();
        text = data.markdown || data.preview || '';
      }
    } catch (_) {
      text = 'Could not load run summary.';
    }
  }
  if (!text) return;

  const card = document.createElement('div');
  card.className =
    'rounded-xl border border-violet-500/30 bg-gradient-to-b from-violet-950/30 to-zinc-900 p-4';
  card.innerHTML = `
    <h4 class="text-sm font-semibold text-violet-300 mb-2">📄 Run summary — ${escapeHtml(fileName)}</h4>
    <div class="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">${escapeHtml(text)}</div>`;
  traceContainer.appendChild(card);
  traceContainer.scrollTop = traceContainer.scrollHeight;
}

function showBeforeAfter(ba) {
  if (!ba?.before) return;
  const card = document.createElement('div');
  card.className = 'rounded-xl border border-zinc-700 bg-zinc-900 p-4';
  card.innerHTML = `
    <h4 class="text-sm font-semibold text-violet-400 mb-3">📊 ${escapeHtml(ba.shipment_id)} — Before vs After</h4>
    <div class="grid sm:grid-cols-2 gap-3 text-xs">
      <div class="p-3 rounded-lg border-l-2 border-amber-500 bg-zinc-950"><p class="text-zinc-500 mb-2">Before</p>
        <p>Route: ${escapeHtml(ba.before.route_name)}</p>
        <p>Dest: ${escapeHtml(ba.before.destination)}</p>
        <p class="text-zinc-400 mt-1">${escapeHtml(routeChainLabel((ba.before.route || []).map((p) => p.place || p)))}</p></div>
      <div class="p-3 rounded-lg border-l-2 border-emerald-500 bg-zinc-950"><p class="text-zinc-500 mb-2">After AI</p>
        <p>Route: ${escapeHtml(ba.after.route_name)}</p>
        <p>Dest: ${escapeHtml(ba.after.destination)}</p>
        <p class="text-zinc-400 mt-1">${escapeHtml(routeChainLabel((ba.after.route || []).map((p) => p.place || p)))}</p></div>
    </div>`;
  traceContainer.appendChild(card);
}

function applyRerouteFromCrm(result) {
  if (!result?.before_state || !result?.after_state) return;
  const id = result.before_state.shipment_id;
  const hazard = fleetRouteState.hazard;
  const prev = fleetRouteState.reroutes[id] || {};
  fleetRouteState.reroutes[id] = {
    ...prev,
    before: result.before_state,
    after: result.after_state,
    beforeSnapshot: {
      route: result.before_state.route || prev.beforeSnapshot?.route || [],
    },
    pending: false,
    reason:
      prev.reason ||
      fleetRouteState.impact?.display_summary ||
      (hazard
        ? `${hazard.hazard_type} — ${hazard.display_summary || hazard.severity_details}`
        : 'Agent reroute'),
    new_route: result.after_state.route_name,
    new_destination: result.after_state.destination,
  };
  const ship = fleetRouteState.shipments.find((s) => s.shipment_id === id);
  if (ship) {
    Object.assign(ship, {
      route_name: result.after_state.route_name,
      route: result.after_state.route || ship.route,
      current_status: result.after_state.current_status,
    });
  }
  fleetRouteState.phase = 'rerouted';
  renderRouteMapPanel();
}

function handleEvent(e) {
  switch (e.type) {
    case 'CONNECTED':
      if (e.db_reset) loadFleetBaseline();
      break;
    case 'STEP_SUMMARY':
      if (e.step === 1 && e.result) {
        fleetRouteState.hazard = e.result;
        fleetRouteState.phase = 'hazard';
        renderRouteMapPanel();
        updateJudgeFromAgent('hazard-extractor', e.result, e.summary);
      }
      if (e.step === 2 && e.result?.active_shipments) {
        fleetRouteState.fleet = e.result;
        updateJudgeFromAgent('fleet-scout', e.result, e.summary);
      }
      if (e.step === 3 && e.result) {
        fleetRouteState.impact = e.result;
        fleetRouteState.phase = 'impact';
        if (e.result.impact_detected) setFleetViewMode('focused');
        renderRouteMapPanel();
        updateJudgeFromAgent('impact-analyzer', e.result, e.summary);
      }
      if (e.step === 4 && e.result) {
        updateJudgeFromAgent('action-planner', e.result, e.summary);
      }
      if (e.step === 5 && e.result?.before_state) {
        applyRerouteFromCrm(e.result);
        updateJudgeExecution(e.summary);
      }
      setPipelineStep(e.step, e.summary, 'done');
      if (e.step < PIPELINE_MAX_STEP && !e.summary?.toLowerCase().includes('no crm')) {
        setPipelineStep(e.step + 1, null, 'active');
      }
      break;
    case 'TODO_LIST':
    case 'TODO_UPDATE':
      renderTodos(e.todos);
      break;
    case 'COORDINATOR': {
      const m = formatMessage(e.message);
      if (m) appendEvent('ORCHESTRATOR', 'Coordinator', m, null, 'coordinator');
      break;
    }
    case 'SUBAGENT_START': {
      const stepNum = AGENT_TO_STEP[e.agent];
      if (stepNum) {
        setPipelineStep(stepNum, null, 'active');
        setJudgeStep(stepNum, { status: 'active', expanded: true });
        expandJudgeStep(stepNum);
      }
      break;
    }
    case 'SUBAGENT_DONE':
      if (e.status === 'completed' && e.result) {
        if (e.agent === 'hazard-extractor') {
          fleetRouteState.hazard = e.result;
          fleetRouteState.phase = 'hazard';
          renderRouteMapPanel();
        }
        if (e.agent === 'fleet-scout') {
          fleetRouteState.fleet = e.result;
        }
        if (e.agent === 'impact-analyzer') {
          fleetRouteState.impact = e.result;
          fleetRouteState.phase = e.result.impact_detected ? 'impact' : 'clear';
          if (e.result.impact_detected) setFleetViewMode('focused');
          renderRouteMapPanel();
        }
        if (e.agent === 'fleet-scout') {
          fleetRouteState.fleet = e.result;
        }
        if (e.agent === 'action-planner') {
          const db = e.result.database_simulation_payload || e.result.database_update_payload;
          const id = db?.shipment_id;
          if (id && fleetRouteState.hazard) {
            const ship = fleetRouteState.shipments.find((s) => s.shipment_id === id);
            const originalRoute = ship?.route ? ship.route.map((p) => ({ ...p })) : [];
            fleetRouteState.reroutes[id] = {
              before: ship
                ? {
                    route_name: ship.route_name,
                    destination: getShipmentDestination(ship),
                    current_status: ship.current_status,
                    route: originalRoute,
                  }
                : {},
              after: {
                route_name: db.new_route,
                destination: db.new_destination,
                current_status: db.new_status,
                route: (findAlternative(ship, db.new_route)?.stops || []).map((p) => ({ ...p })),
              },
              beforeSnapshot: { route: originalRoute },
              reason:
                e.result?.why_brief ||
                e.result?.selection_rationale ||
                fleetRouteState.impact?.why_brief ||
                fleetRouteState.impact?.display_summary ||
                `${fleetRouteState.hazard.hazard_type} — ${fleetRouteState.hazard.display_summary || fleetRouteState.hazard.severity_details}`,
              new_route: db.new_route,
              new_destination: db.new_destination,
              pending: true,
            };
            renderRouteMapPanel();
          }
        }
        updateJudgeFromAgent(e.agent, e.result, e.result?.display_summary);
        appendEvent(
          'AGENT',
          e.agent.replace(/-/g, ' '),
          agentCardDesc(e.result) || 'Done',
          compactAgentResult(e.agent, e.result),
          'subagent'
        );
      }
      break;
    case 'TOOL_CALL':
      if (e.tool_name === 'write_todos' || e.tool_name === 'task') break;
      appendEvent('EXECUTION', TOOL_LABELS[e.tool_name] || e.tool_name, 'Running…', null, 'tool');
      break;
    case 'TOOL_RESULT':
      if (e.tool_name === 'write_summary_tool') {
        if (e.status === 'SUCCESS') {
          completeReasoningTodos();
          appendEvent(
            'EXECUTION',
            TOOL_LABELS[e.tool_name] || e.tool_name,
            e.result?.message || 'Summary saved',
            null,
            'tool'
          );
        }
        break;
      }
      if (e.tool_name === 'update_crm_tool' && e.status === 'SUCCESS') {
        const crm = parseCrmPayload(e.result);
        if (crm?.before_state) {
          applyRerouteFromCrm(crm);
          setPipelineStep(5, 'Route updated', 'done');
          setJudgeStep(5, { status: 'active', expanded: true });
          expandJudgeStep(5);
        }
      }
      if (e.status === 'SUCCESS') {
        const crm = parseCrmPayload(e.result);
        const msg = crm?.message || e.result?.message || 'Done';
        appendEvent('EXECUTION', TOOL_LABELS[e.tool_name] || e.tool_name, msg, null, 'tool');
      }
      break;
    case 'COMPLETE': {
      const didReroute =
        e.crm_updated ||
        e.before_after ||
        syncFleetFromComplete(e);
      if (didReroute) {
        setPipelineStep(5, 'Route updated', 'done');
        updateJudgeExecution(completeTitle, 'Shipment record and hospital alert updated');
        fleetRouteState.phase = 'rerouted';
        setFleetViewMode('focused');
        if (e.before_after) {
          applyRerouteFromCrm({
            before_state: { shipment_id: e.before_after.shipment_id, ...e.before_after.before },
            after_state: { shipment_id: e.before_after.shipment_id, ...e.before_after.after },
          });
        }
      } else if (e.outcome === 'all_clear') {
        setPipelineStep(4, 'No reroute', 'done');
        setPipelineStep(5, 'No route change', 'done');
        fleetRouteState.phase = 'clear';
        renderRouteMapPanel();
      }
      const completeTitle = didReroute
        ? 'Reroute complete'
        : e.outcome === 'all_clear'
          ? 'All clear'
          : 'Complete';
      appendEvent('COMPLETE', completeTitle, e.message, null, 'complete');
      if (e.before_after && didReroute) showBeforeAfter(e.before_after);
      completeReasoningTodos();
      if (e.summary_preview || e.summary_file) showSummaryCard(e.summary_preview);
      break;
    }
    case 'SUMMARY_WRITTEN':
      completeReasoningTodos();
      showSummaryCard(null, e.file || 'summary.md');
      break;
    case 'ERROR':
      appendEvent('ERROR', 'Failed', e.message || e.error, null, 'tool');
      break;
  }
}

async function startAgent() {
  startOverlay.classList.add('hidden');
  document.getElementById('fleet-rail')?.classList.remove('hidden');
  document.getElementById('fleet-rail')?.classList.add('lg:flex');
  statusBadge.classList.add('active');
  statusText.textContent = 'Agent Active';
  traceContainer.innerHTML = '';
  window.__coordAlertShown = false;
  initJudgeReasoningUi();
  showJudgePanels();
  setJudgeStep(1, { status: 'active', expanded: true });
  expandJudgeStep(1);
  initPipeline();
  if (todoSidebar) todoSidebar.innerHTML = '<p class="text-sm text-zinc-500 italic">Waiting…</p>';

  try {
    const scenario = await getRandomScenario();
    setNewsAlert(scenario);
    await loadFleetBaseline();

    const ctx = document.createElement('div');
    ctx.className = 'rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 mb-4';
    ctx.innerHTML = `<p class="text-[10px] uppercase tracking-wider text-blue-400 mb-2">📥 Incoming alert</p><p class="text-sm text-zinc-300 italic">"${escapeHtml(scenario.text).replace(/\n/g, '<br>')}"</p>`;
    traceContainer.appendChild(ctx);

    const res = await fetch(`${API}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: scenario.text }),
    });
    if (!res.ok) throw new Error('API error');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      for (const line of buf.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            handleEvent(JSON.parse(line.slice(6)));
          } catch (_) {}
        }
      }
      buf = buf.split('\n').pop() || '';
    }
  } catch (err) {
    appendEvent('ERROR', 'Pipeline failed', err.message, null, 'tool');
  } finally {
    statusBadge.classList.remove('active');
    statusText.textContent = 'Task Completed';
  }
}

window.startAgent = startAgent;
window.routeOverlapsHazard = routeOverlapsHazard;

function setNewsAlert(scenario) {
  if (!scenario) return;
  fleetRouteState.newsAlert = {
    id: scenario.id,
    label: scenario.label,
    text: scenario.text,
    hazard_type: scenario.hazard_type,
  };
}

async function loadScenariosCache() {
  if (cachedScenarios) return cachedScenarios;
  try {
    const res = await fetch(`${API}/api/scenarios`);
    if (!res.ok) return [];
    const data = await res.json();
    cachedScenarios = data.scenarios || [];
  } catch {
    cachedScenarios = [];
  }
  return cachedScenarios;
}

function renderNewsPanelContent(scenario) {
  const body = document.getElementById('news-panel-body');
  const meta = document.getElementById('news-panel-meta');
  const list = document.getElementById('news-panel-list');
  const title = document.getElementById('news-panel-title');
  if (!body || !meta) return;

  if (list) list.classList.add('hidden');
  body.classList.remove('hidden');

  if (scenario) {
    if (title) title.textContent = scenario.label || 'Incoming alert';
    meta.innerHTML = `<span class="text-blue-400/90">${escapeHtml(scenario.id || '')}</span>${scenario.hazard_type ? ` · ${escapeHtml(scenario.hazard_type)}` : ''}`;
    body.textContent = scenario.text || '';
    return;
  }

  if (fleetRouteState.newsAlert) {
    renderNewsPanelContent(fleetRouteState.newsAlert);
    return;
  }

  if (title) title.textContent = 'Scenario library';
  meta.textContent = 'Select a scenario to preview (agent uses a random hazard alert on start)';
  body.classList.add('hidden');
  if (list) {
    list.classList.remove('hidden');
    list.innerHTML = '<p class="text-xs text-zinc-500 px-2 py-4">Loading scenarios…</p>';
  }
}

async function renderNewsScenarioList() {
  const list = document.getElementById('news-panel-list');
  if (!list) return;
  const scenarios = await loadScenariosCache();
  if (!scenarios.length) {
    list.innerHTML = '<p class="text-xs text-zinc-500 px-2 py-4">Could not load scenarios. Is the API running on port 8000?</p>';
    return;
  }
  list.innerHTML = scenarios
    .map(
      (s) => `
    <button type="button" class="news-scenario-btn" data-scenario-id="${escapeHtml(s.id)}">
      <span class="block text-xs font-medium text-zinc-200">${escapeHtml(s.label || s.id)}</span>
      <span class="block text-[10px] text-zinc-500 mt-1">${escapeHtml(s.hazard_type || '')}${s.affects_shipment ? ` · ${escapeHtml(s.affects_shipment)}` : ''}</span>
    </button>`
    )
    .join('');
  list.querySelectorAll('.news-scenario-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-scenario-id');
      const s = scenarios.find((x) => x.id === id);
      if (!s) return;
      list.querySelectorAll('.news-scenario-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderNewsPanelContent(s);
    });
  });
}

function openNewsPanel() {
  const panel = document.getElementById('news-panel');
  const backdrop = document.getElementById('news-panel-backdrop');
  if (!panel || !backdrop) return;

  if (fleetRouteState.newsAlert) {
    renderNewsPanelContent(fleetRouteState.newsAlert);
  } else {
    renderNewsPanelContent(null);
    renderNewsScenarioList();
  }

  panel.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  backdrop.setAttribute('aria-hidden', 'false');
  document.getElementById('btn-view-news')?.classList.add('ring-2', 'ring-blue-400');
}

function closeNewsPanel() {
  document.getElementById('news-panel')?.classList.add('hidden');
  const backdrop = document.getElementById('news-panel-backdrop');
  backdrop?.classList.add('hidden');
  backdrop?.setAttribute('aria-hidden', 'true');
  document.getElementById('btn-view-news')?.classList.remove('ring-2', 'ring-blue-400');
}

function initNewsPanel() {
  const openers = [
    'btn-view-news',
    'btn-view-news-header',
    'btn-view-news-start',
  ];
  openers.forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => openNewsPanel());
  });
  document.getElementById('btn-close-news')?.addEventListener('click', closeNewsPanel);
  document.getElementById('news-panel-backdrop')?.addEventListener('click', closeNewsPanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNewsPanel();
  });
}

function initFleetRail() {
  const focusBtn = document.getElementById('btn-fleet-focus');
  const allBtn = document.getElementById('btn-fleet-all');
  if (focusBtn) focusBtn.addEventListener('click', () => setFleetViewMode('focused'));
  if (allBtn) allBtn.addEventListener('click', () => setFleetViewMode('all'));
  updateFleetRailButtons();
}

document.addEventListener('DOMContentLoaded', () => {
  initJudgeReasoningUi();
  initPipeline();
  initFleetRail();
  initNewsPanel();
  loadFleetPreview();
  loadScenariosCache();
});
