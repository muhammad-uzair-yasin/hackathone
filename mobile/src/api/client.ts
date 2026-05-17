import { API_BASE } from './config';
import type { SummaryDocument } from '../types/summary';
import type { Scenario } from '../types/shipment';
import { mapShipment, type Shipment } from '../types/shipment';

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchScenarios(): Promise<Scenario[]> {
  const res = await fetch(`${API_BASE}/api/scenarios`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.scenarios || [];
}

export async function fetchBaselineShipments(): Promise<Shipment[]> {
  const res = await fetch(`${API_BASE}/api/baseline`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.active_shipments || []).map((s: Record<string, unknown>) => mapShipment(s));
}

export async function fetchDbShipments(): Promise<Shipment[]> {
  const res = await fetch(`${API_BASE}/api/db`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.active_shipments || []).map((s: Record<string, unknown>) => mapShipment(s));
}

export function streamAnalyzeUrl(alertText: string): string {
  return `${API_BASE}/api/stream?input=${encodeURIComponent(alertText)}`;
}

/** Preferred for React Native — avoids long GET URLs and works with XHR SSE */
export function streamAnalyzePost(alertText: string): { url: string; body: string } {
  return {
    url: `${API_BASE}/api/analyze`,
    body: JSON.stringify({ input: alertText }),
  };
}

export async function resetDemoSession(): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Reset failed (${res.status})`);
  }
  return res.json();
}

export async function fetchSummaryDocument(): Promise<SummaryDocument | null> {
  const res = await fetch(`${API_BASE}/api/summary`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  const markdown = String(data.markdown || data.preview || '').trim();
  if (!markdown || markdown.includes('Waiting for agent run')) return null;
  return {
    file: data.file || 'summary.md',
    markdown,
    preview: data.preview || markdown.slice(0, 2000),
    session: data.session,
  };
}

