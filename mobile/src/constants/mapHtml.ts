/**
 * mapHtml.ts
 * Exports the Leaflet route map as an inline HTML string so Metro bundler
 * can resolve it without needing to `require()` an .html file.
 */

const MAP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>BioRoute Route Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0f172a; }
    .legend {
      position: absolute; bottom: 16px; left: 16px; z-index: 1000;
      background: rgba(15,23,42,0.92); border-radius: 12px;
      padding: 10px 14px; backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.12);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .legend-item:last-child { margin-bottom: 0; }
    .legend-line { width: 28px; height: 3px; border-radius: 2px; }
    .legend-line.original { background: #ef4444; border-top: 3px dashed #ef4444; height: 0; }
    .legend-line.rerouted { background: #22c55e; }
    .legend-label { color: #e2e8f0; font-size: 11px; font-weight: 500; }
    .reroute-badge {
      position: absolute; top: 16px; right: 16px; z-index: 1000;
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      color: white; border-radius: 99px; padding: 6px 14px;
      font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 700;
      box-shadow: 0 4px 12px rgba(124,58,237,0.4); display: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <div class="legend-item"><div class="legend-line original"></div><span class="legend-label">Original route</span></div>
    <div class="legend-item"><div class="legend-line rerouted"></div><span class="legend-label">AI rerouted path</span></div>
  </div>
  <div class="reroute-badge" id="badge">🤖 AI Rerouted</div>
  <script>
    var map = L.map('map', { center: [25.0, 67.5], zoom: 8, zoomControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    var truckMarker = null;
    var truckAnimFrame = null;

    function makeIcon(emoji, size) {
      size = size || 28;
      return L.divIcon({ html: '<div style="font-size:' + size + 'px;line-height:1">' + emoji + '</div>', className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
    }

    function stopsToLatLngs(stops) {
      return (stops || []).filter(function(s) { return s.lat != null && (s.lon != null || s.lng != null); })
        .map(function(s) { return [parseFloat(s.lat), parseFloat(s.lon != null ? s.lon : s.lng)]; });
    }

    function animateTruck(coords, durationMs) {
      durationMs = durationMs || 10000;
      if (truckAnimFrame) cancelAnimationFrame(truckAnimFrame);
      if (coords.length < 2) return;
      var dists = [0];
      for (var i = 1; i < coords.length; i++) dists.push(dists[i-1] + map.distance(coords[i-1], coords[i]));
      var totalDist = dists[coords.length - 1];
      if (!truckMarker) { truckMarker = L.marker(coords[0], { icon: makeIcon('🚛', 26), zIndexOffset: 1000 }).addTo(map); }
      else { truckMarker.setLatLng(coords[0]); }
      var start = performance.now();
      function step(now) {
        var progress = Math.min((now - start) / durationMs, 1);
        var targetDist = progress * totalDist;
        var segIdx = 0;
        for (var j = 1; j < coords.length; j++) { if (dists[j] >= targetDist) { segIdx = j - 1; break; } }
        var segP = (targetDist - dists[segIdx]) / (dists[segIdx+1] - dists[segIdx] || 1);
        var lat = coords[segIdx][0] + (coords[segIdx+1][0] - coords[segIdx][0]) * segP;
        var lng = coords[segIdx][1] + (coords[segIdx+1][1] - coords[segIdx][1]) * segP;
        truckMarker.setLatLng([lat, lng]);
        if (progress < 1) { truckAnimFrame = requestAnimationFrame(step); }
        else { setTimeout(function() { animateTruck(coords, durationMs); }, 1000); }
      }
      truckAnimFrame = requestAnimationFrame(step);
    }

    function renderRoutes(data) {
      map.eachLayer(function(layer) { if (!(layer instanceof L.TileLayer)) map.removeLayer(layer); });
      truckMarker = null;
      if (truckAnimFrame) { cancelAnimationFrame(truckAnimFrame); truckAnimFrame = null; }
      var beforeCoords = stopsToLatLngs(data.before);
      var afterCoords  = stopsToLatLngs(data.after);
      var allCoords = beforeCoords.concat(afterCoords);
      if (allCoords.length === 0) return;
      if (beforeCoords.length >= 2) {
        L.polyline(beforeCoords, { color: '#ef4444', weight: 3, opacity: 0.7, dashArray: '10 8' }).addTo(map);
        beforeCoords.forEach(function(c, i) {
          L.circleMarker(c, { radius: 5, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.6, weight: 2 })
            .bindPopup('<b>' + (data.before[i] && data.before[i].place || 'Stop ' + (i+1)) + '</b><br>Original route').addTo(map);
        });
      }
      if (afterCoords.length >= 2) {
        L.polyline(afterCoords, { color: '#22c55e', weight: 4, opacity: 0.9 }).addTo(map);
        afterCoords.forEach(function(c, i) {
          L.circleMarker(c, { radius: (i===0||i===afterCoords.length-1)?8:5, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.8, weight: 2 })
            .bindPopup('<b>' + (data.after[i] && data.after[i].place || 'Stop ' + (i+1)) + '</b><br>AI Rerouted').addTo(map);
        });
        animateTruck(afterCoords, 10000);
        document.getElementById('badge').style.display = 'block';
      } else if (beforeCoords.length >= 2) {
        animateTruck(beforeCoords, 10000);
      }
      map.fitBounds(L.latLngBounds(allCoords), { padding: [32, 32] });
    }

    function handleMessage(event) {
      try { var data = JSON.parse(event.data); if (data.type === 'ROUTE_DATA') renderRoutes(data); } catch(e) {}
    }
    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage);
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  </script>
</body>
</html>`;

export default MAP_HTML;
