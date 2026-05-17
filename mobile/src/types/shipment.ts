export interface RoutePoint {
  place: string;
  lat: number;
  lon: number;
}

export interface AlternativeRoute {
  id: string;
  name: string;
  eta_minutes?: number;
  notes?: string;
  stops: RoutePoint[];
}

export interface Shipment {
  shipment_id: string;
  cargo_type: string;
  route_name: string;
  route: RoutePoint[];
  alternative_routes: AlternativeRoute[];
  eta_minutes?: number;
  current_status: string;
  destination: string;
}

export interface Scenario {
  id: string;
  label: string;
  hazard_type: string;
  affects_shipment?: string;
  text: string;
}

export function mapShipment(raw: Record<string, unknown>): Shipment {
  const route = (raw.route as RoutePoint[]) || [];
  const last = route[route.length - 1];
  return {
    shipment_id: String(raw.shipment_id),
    cargo_type: String(raw.cargo_type || ''),
    route_name: String(raw.route_name || ''),
    route,
    alternative_routes: (raw.alternative_routes as AlternativeRoute[]) || [],
    eta_minutes: raw.eta_minutes as number | undefined,
    current_status: String(raw.current_status || ''),
    destination: last?.place || '',
  };
}
