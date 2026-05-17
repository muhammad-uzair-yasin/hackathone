/**
 * Pakistan fleet map — Leaflet polylines for cold-chain routes.
 */
(function (global) {
  const PAKISTAN_BOUNDS = [
    [23.4, 60.5],
    [37.6, 77.8],
  ];
  const PAKISTAN_CENTER = [30.2, 69.8];

  const SHIPMENT_COLORS = {
    'SHP-882': '#a78bfa',
    'SHP-901': '#60a5fa',
    'SHP-915': '#fbbf24',
    'SHP-928': '#34d399',
  };

  /** Fallback when route_coords missing (partial name match). */
  const PLACE_COORDS = [
    { keys: ['port qasim'], lat: 24.783, lon: 67.36 },
    { keys: ['korangi'], lat: 24.848, lon: 67.115 },
    { keys: ['malir'], lat: 24.902, lon: 67.185 },
    { keys: ['gharo'], lat: 24.741, lon: 67.585 },
    { keys: ['thatta bypass'], lat: 24.748, lon: 67.925 },
    { keys: ['hyderabad west', 'hyderabad ring'], lat: 25.382, lon: 68.368 },
    { keys: ['qasimabad', 'cold-vault'], lat: 25.401, lon: 68.342 },
    { keys: ['jamshoro', 'liaquat'], lat: 25.428, lon: 68.278 },
    { keys: ['bund road'], lat: 31.548, lon: 74.322 },
    { keys: ['thokar'], lat: 31.469, lon: 74.225 },
    { keys: ['sheikhupura'], lat: 31.713, lon: 73.985 },
    { keys: ['pindi bhattian'], lat: 31.898, lon: 73.503 },
    { keys: ['ravi toll'], lat: 31.521, lon: 74.255 },
    { keys: ['muridke'], lat: 31.583, lon: 74.262 },
    { keys: ['faisalabad ring', 'allied hospital', 'sargodha road'], lat: 31.418, lon: 73.079 },
    { keys: ['i-9 pharma'], lat: 33.652, lon: 73.042 },
    { keys: ['zero point'], lat: 33.693, lon: 73.068 },
    { keys: ['faizabad'], lat: 33.663, lon: 73.078 },
    { keys: ['committee chowk'], lat: 33.598, lon: 73.052 },
    { keys: ['holy family'], lat: 33.582, lon: 73.041 },
    { keys: ['peshawar mor'], lat: 33.721, lon: 73.055 },
    { keys: ['ijp road'], lat: 33.612, lon: 73.089 },
    { keys: ['chaklala'], lat: 33.588, lon: 73.098 },
    { keys: ['multan cold', 'gulgasht'], lat: 30.198, lon: 71.468 },
    { keys: ['dunyapur'], lat: 29.815, lon: 71.742 },
    { keys: ['khanewal'], lat: 30.31, lon: 71.932 },
    { keys: ['ahmedpur'], lat: 29.142, lon: 71.257 },
    { keys: ['bahawal victoria'], lat: 29.394, lon: 71.682 },
    { keys: ['vehari road'], lat: 30.175, lon: 71.512 },
    { keys: ['hasilpur'], lat: 29.692, lon: 71.261 },
    { keys: ['model town'], lat: 29.412, lon: 71.655 },
  ];

  function coordsForPlace(name) {
    const n = String(name || '').toLowerCase();
    for (const p of PLACE_COORDS) {
      if (p.keys.some((k) => n.includes(k))) return [p.lat, p.lon];
    }
    return null;
  }

  function pointsToLatLngs(points) {
    if (!points?.length) return null;
    const out = points
      .map((p) => (p.lat != null && p.lon != null ? [p.lat, p.lon] : coordsForPlace(p.place)))
      .filter(Boolean);
    return out.length >= 2 ? out : null;
  }

  function pointsToPlaces(points) {
    return (points || []).map((p) => p.place || String(p));
  }

  function numberedIcon(num, color, isEnd) {
    const label = isEnd ? '🏥' : String(num);
    return L.divIcon({
      className: 'fleet-marker',
      html: `<span style="background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45)">${label}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  class FleetMap {
    constructor(containerId) {
      this.containerId = containerId;
      this.map = null;
      this.layerGroup = null;
      this._initPending = false;
    }

    ensureMap() {
      const el = document.getElementById(this.containerId);
      if (!el || typeof L === 'undefined') return false;
      if (this.map) {
        setTimeout(() => this.map.invalidateSize(), 80);
        return true;
      }
      if (this._initPending) return false;
      this._initPending = true;

      this.map = L.map(el, {
        center: PAKISTAN_CENTER,
        zoom: 5,
        minZoom: 4,
        maxZoom: 12,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(this.map);

      this.layerGroup = L.layerGroup().addTo(this.map);
      L.rectangle(PAKISTAN_BOUNDS, {
        color: '#7c3aed',
        weight: 1,
        opacity: 0.35,
        fill: false,
        dashArray: '6 4',
      }).addTo(this.layerGroup);

      this._initPending = false;
      setTimeout(() => this.map.invalidateSize(), 100);
      return true;
    }

    clear() {
      if (this.layerGroup) this.layerGroup.clearLayers();
    }

    drawPolyline(latlngs, opts) {
      const line = L.polyline(latlngs, {
        color: opts.color,
        weight: opts.weight ?? 4,
        opacity: opts.opacity ?? 0.85,
        dashArray: opts.dashArray || null,
      });
      if (opts.label) {
        line.bindTooltip(opts.label, {
          sticky: true,
          className: 'fleet-line-tip',
        });
      }
      line.addTo(this.layerGroup);
      return line;
    }

    drawMarkers(latlngs, stops, color) {
      latlngs.forEach((ll, i) => {
        const isEnd = i === latlngs.length - 1;
        const m = L.marker(ll, {
          icon: numberedIcon(i + 1, color, isEnd),
        });
        m.bindPopup(
          `<strong>${i + 1}. ${stops[i] || ''}</strong>` +
            (isEnd ? '<br><em>Destination</em>' : i === 0 ? '<br><em>Origin</em>' : '')
        );
        m.addTo(this.layerGroup);
      });
    }

    render(state) {
      if (!this.ensureMap()) return;
      this.clear();

      const { shipments, reroutes, hazard, impact, viewMode } = state;
      const focusId = impact?.affected_shipment_id;
      const allBounds = [];
      const focusedOnly = viewMode === 'focused' && focusId;

      for (const ship of shipments) {
        if (focusedOnly && ship.shipment_id !== focusId) continue;
        const id = ship.shipment_id;
        const color = SHIPMENT_COLORS[id] || '#a78bfa';
        const reroute = reroutes[id];
        const isFocus = focusId === id;
        const dimOthers = focusId && !isFocus;

        if (reroute) {
          const origPoints = reroute.beforeSnapshot?.route || reroute.before?.route;
          const origCoords = pointsToLatLngs(origPoints);
          const origPlaces = pointsToPlaces(origPoints);
          if (origCoords) {
            this.drawPolyline(origCoords, {
              color: '#71717a',
              weight: isFocus ? 3 : 2,
              opacity: dimOthers ? 0.25 : 0.55,
              dashArray: '8 6',
              label: `${id} original`,
            });
            allBounds.push(...origCoords);
          }

          const plannedName = reroute.new_route || reroute.after?.route_name;
          const alt =
            plannedName && ship.alternative_routes
              ? ship.alternative_routes.find((a) => a.name === plannedName)
              : null;
          const activePoints = reroute.pending
            ? alt?.stops || reroute.after?.route || ship.route
            : ship.route;
          const activeCoords = pointsToLatLngs(activePoints);
          const activePlaces = pointsToPlaces(activePoints);
          if (activeCoords) {
            this.drawPolyline(activeCoords, {
              color: isFocus ? '#c4b5fd' : color,
              weight: isFocus ? 5 : 3,
              opacity: dimOthers ? 0.35 : 0.95,
              label: `${id} ${reroute.pending ? 'planned' : 'active'}`,
            });
            if (isFocus) this.drawMarkers(activeCoords, activePlaces, color);
            allBounds.push(...activeCoords);
          }
        } else {
          const coords = pointsToLatLngs(ship.route);
          const stops = pointsToPlaces(ship.route);
          if (!coords) continue;

          const affected =
            isFocus ||
            (hazard &&
              typeof global.routeOverlapsHazard === 'function' &&
              global.routeOverlapsHazard(ship, hazard));

          this.drawPolyline(coords, {
            color: affected ? '#f87171' : color,
            weight: affected ? 5 : 3,
            opacity: dimOthers ? 0.3 : affected ? 0.95 : 0.75,
            label: id,
          });
          if (affected || !focusId) this.drawMarkers(coords, stops, color);
          allBounds.push(...coords);
        }
      }

      if (allBounds.length) {
        this.map.fitBounds(allBounds, { padding: [36, 36], maxZoom: 8 });
      } else {
        this.map.fitBounds(PAKISTAN_BOUNDS, { padding: [24, 24] });
      }
    }
  }

  global.FleetMap = FleetMap;
  global.resolveRouteCoords = resolveCoords;
})(window);
