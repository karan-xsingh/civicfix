import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import api from '../api/client';
import { statusColor, DEFAULT_CENTER } from '../constants';

let gradientLUT = null;
function buildGradientLUT() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0.0, '#3E6680');
  grd.addColorStop(0.4, '#3A7D5D');
  grd.addColorStop(0.7, '#F5B700');
  grd.addColorStop(1.0, '#D8571F');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

export default function PublicMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const heatCanvasRef = useRef(null);
  const [issues, setIssues] = useState([]);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const map = L.map(mapRef.current).setView(DEFAULT_CENTER, 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    map.on('move zoom', renderHeatmap);
    fetchIssues(map);
    return () => map.remove();
  }, []);

  async function fetchIssues(map) {
    const res = await api.get('/issues');
    setIssues(res.data.issues);
    setLoaded(true);
    markersLayer.current.clearLayers();
    const bounds = [];
    res.data.issues.forEach(iss => {
      const color = statusColor(iss.status);
      const marker = L.circleMarker([iss.lat, iss.lng], { radius: 8, color, fillColor: color, fillOpacity: 0.85, weight: 2 })
        .addTo(markersLayer.current);
      marker.bindPopup(
        `<strong>${iss.category_label}</strong> <span style="font-size:11px;color:#888;">(${iss.severity} severity)</span><br>` +
        (iss.description ? iss.description + '<br>' : '') +
        `<span style="font-size:11px;color:#666;">Status: ${iss.status} · ${iss.department_name}</span>` +
        (iss.overdue ? '<br><span style="font-size:11px;color:#D8571F;font-weight:600;">Overdue</span>' : '')
      );
      bounds.push([iss.lat, iss.lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    setTimeout(renderHeatmap, 80);
  }

  function renderHeatmap() {
    const map = mapInstance.current;
    const canvas = heatCanvasRef.current;
    if (!map || !canvas) return;
    const mapEl = mapRef.current;
    canvas.width = mapEl.clientWidth; canvas.height = mapEl.clientHeight;
    canvas.style.width = mapEl.clientWidth + 'px'; canvas.style.height = mapEl.clientHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!canvas.dataset.on || canvas.dataset.on !== 'true') return;

    const sevIntensity = { High: 0.75, Medium: 0.5, Low: 0.32 };
    const activeIssues = JSON.parse(canvas.dataset.issues || '[]').filter(i => i.status !== 'Resolved');
    activeIssues.forEach(iss => {
      const pt = map.latLngToContainerPoint([iss.lat, iss.lng]);
      const intensity = sevIntensity[iss.severity] || 0.5;
      const r = 34;
      const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      grd.addColorStop(0, `rgba(0,0,0,${intensity})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
    });
    if (!gradientLUT) gradientLUT = buildGradientLUT();
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      const idx = alpha * 4;
      data[i] = gradientLUT[idx]; data[i + 1] = gradientLUT[idx + 1]; data[i + 2] = gradientLUT[idx + 2];
      data[i + 3] = Math.min(255, alpha * 1.6);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  useEffect(() => {
    if (heatCanvasRef.current) {
      heatCanvasRef.current.dataset.on = String(heatmapOn);
      heatCanvasRef.current.dataset.issues = JSON.stringify(issues);
      renderHeatmap();
    }
  }, [heatmapOn, issues]);

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1">Public issue map</h2>
      <p className="text-sm text-inksoft mb-4">Every report submitted, in real time. Tap a pin for details.</p>
      <div className="flex gap-3.5 flex-wrap text-xs text-inksoft mb-3">
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full inline-block" style={{ background: '#D8571F' }} />Reported</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full inline-block" style={{ background: '#3E6680' }} />In progress</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full inline-block" style={{ background: '#3A7D5D' }} />Resolved</span>
      </div>
      <div className="flex justify-end mb-2">
        <button className="btn btn-outline" onClick={() => setHeatmapOn(h => !h)}>
          {heatmapOn ? 'Hide hotspot heatmap' : 'Show hotspot heatmap'}
        </button>
      </div>
      <div className="relative">
        <div ref={mapRef} className="h-[360px] rounded-md border-[1.5px] border-line dark:border-asphalt-2" />
        <canvas ref={heatCanvasRef} className="absolute top-0 left-0 pointer-events-none rounded-md" style={{ zIndex: 450 }} />
      </div>
      {loaded && issues.length === 0 && (
        <p className="text-center text-inksoft text-sm py-8">No reports yet — submit one from the Report tab.</p>
      )}
    </div>
  );
}
