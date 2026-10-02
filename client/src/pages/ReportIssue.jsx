import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import api from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import { CATEGORIES, SEVERITIES, DEFAULT_CENTER } from '../constants';

// Fix default marker icon paths (Vite + Leaflet quirk)
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

export default function ReportIssue() {
  const { showToast } = useToast();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);

  const [category, setCategory] = useState(null);
  const [severity, setSeverity] = useState('Medium');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState(null);
  const [locStatus, setLocStatus] = useState('No location set — or tap the map below');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [dupWarning, setDupWarning] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);
    map.on('click', e => {
      setPin([e.latlng.lat, e.latlng.lng]);
      setLocStatus(`Pinned: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
    });
    mapInstance.current = map;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';
      recognition.onresult = e => {
        const transcript = e.results[0][0].transcript;
        setDescription(d => (d ? d + ' ' : '') + transcript);
      };
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !pin) return;
    if (markerInstance.current) mapInstance.current.removeLayer(markerInstance.current);
    markerInstance.current = L.marker(pin).addTo(mapInstance.current);
  }, [pin]);

  useEffect(() => {
    if (!pin || !category) { setDupWarning(''); return; }
    api.get('/issues/duplicates', { params: { lat: pin[0], lng: pin[1], category } })
      .then(res => {
        const nearby = res.data.nearby;
        if (!nearby.length) return setDupWarning('');
        setDupWarning(
          nearby.length === 1
            ? `Heads up: there's already an open report for this kind of issue near this spot (#${nearby[0].id.replace('issue-', '').slice(0, 8)}). You can still submit — it just may be a duplicate.`
            : `Heads up: there are already ${nearby.length} open reports for this kind of issue near this spot. You can still submit — it just may be a duplicate.`
        );
      })
      .catch(() => {});
  }, [pin, category]);

  function useMyLocation() {
    if (!navigator.geolocation) { setLocStatus('Geolocation not supported on this device.'); return; }
    setLocStatus('Locating…');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        setPin(ll);
        mapInstance.current.setView(ll, 16);
        setLocStatus(`Pinned: ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}`);
      },
      () => setLocStatus('Could not get location — tap the map to pin manually.')
    );
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setAiResult('');
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  // Heuristic client-side "AI Assist": analyzes darkness ratio + luminance variance
  // as a proxy for shadow depth / surface texture. Not a trained model — in production
  // this button would call a backend endpoint running a CNN fine-tuned on labeled photos.
  function runAiAssist() {
    if (!photoPreview) return;
    setAiBusy(true);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0, sumSq = 0, darkCount = 0, n = 0;
      for (let i = 0; i < data.length; i += 16) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += lum; sumSq += lum * lum; n++;
        if (lum < 60) darkCount++;
      }
      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      const darkRatio = darkCount / n;
      const score = Math.min(100, Math.round(darkRatio * 140 + Math.sqrt(variance) * 0.9));
      let sev, confidence;
      if (score > 55) { sev = 'High'; confidence = Math.min(95, 55 + score / 4); }
      else if (score > 28) { sev = 'Medium'; confidence = 60 + score / 3; }
      else { sev = 'Low'; confidence = 70 - score; }
      confidence = Math.round(Math.max(50, Math.min(95, confidence)));
      setSeverity(sev);
      setAiResult(`AI Assist suggests ${sev} severity (~${confidence}% confidence, from shadow/texture analysis). You can override it above.`);
      setAiBusy(false);
    };
    img.src = photoPreview;
  }

  function toggleMic() {
    if (!recognitionRef.current || listening) return;
    setListening(true);
    try { recognitionRef.current.start(); } catch { setListening(false); }
  }

  async function handleSubmit() {
    if (!category) return alert('Please pick a category for the issue.');
    if (!pin) return alert('Please set a location — tap the map or use current location.');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('category', category);
      fd.append('description', description.trim());
      fd.append('lat', pin[0]);
      fd.append('lng', pin[1]);
      fd.append('severity', severity);
      if (photoFile) fd.append('photo', photoFile);
      const res = await api.post('/issues', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const ticketId = res.data.issue.id.replace('issue-', '');
      setConfirmMsg(`Report submitted. Ticket #${ticketId.slice(0, 8)} routed to ${res.data.issue.department_name}. Track it on the Public Map or Track a Report tab.`);
      showToast(`Report submitted — ticket #${ticketId.slice(0, 8)} created.`);
      setCategory(null); setSeverity('Medium'); setDescription('');
      setPin(null); setPhotoFile(null); setPhotoPreview(null);
      setDupWarning(''); setAiResult(''); setLocStatus('No location set — or tap the map below');
      if (markerInstance.current) { mapInstance.current.removeLayer(markerInstance.current); markerInstance.current = null; }
    } catch (err) {
      alert(err.response?.data?.error || 'Something went wrong submitting your report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1">Report a civic issue</h2>
      <p className="text-sm text-inksoft mb-5 max-w-[60ch]">
        Pick a category, pin the location, add a photo if you can. It's routed to the right department automatically.
      </p>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5">What's the issue?</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`text-left rounded-md border-[1.5px] px-2.5 py-2 text-sm font-medium ${
                category === c.id ? 'border-signal-yellow bg-amber-50 dark:bg-amber-950/30 shadow-[0_0_0_1.5px_theme(colors.signal.yellow)_inset]' : 'border-line dark:border-asphalt-2 bg-panel dark:bg-asphalt-2'
              }`}
            >
              {c.label}
              <small className="block text-inksoft font-normal text-[11.5px] mt-0.5">{c.dept}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5">How severe is it?</label>
        <div className="flex gap-2">
          {SEVERITIES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`flex-1 rounded-md border-[1.5px] py-2 text-sm font-semibold ${
                severity === s
                  ? s === 'Low' ? 'bg-signal-green text-white border-transparent'
                  : s === 'Medium' ? 'bg-signal-yellow text-asphalt border-transparent'
                  : 'bg-signal-orange text-white border-transparent'
                  : 'border-line dark:border-asphalt-2 text-inksoft'
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5">Description</label>
        <div className="relative">
          <textarea
            className="field-input min-h-[70px] resize-y"
            placeholder="A short note helps — e.g. 'deep pothole near the bus stop, causing traffic to swerve'"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          {recognitionRef.current && (
            <button
              type="button" onClick={toggleMic}
              className={`absolute right-2 bottom-2 w-8 h-8 rounded-full border-[1.5px] flex items-center justify-center ${listening ? 'bg-signal-orange border-signal-orange text-white' : 'border-line bg-panel text-inksoft'}`}
              title="Dictate description"
            >🎤</button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5">Location</label>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <button type="button" onClick={useMyLocation} className="btn btn-outline">Use my current location</button>
          <span className="text-xs font-mono text-inksoft">{locStatus}</span>
        </div>
        <div ref={mapRef} className="h-[220px] rounded-md border-[1.5px] border-line dark:border-asphalt-2" />
        <p className="text-xs text-inksoft mt-1.5">Tap anywhere on the map to drop a pin at the issue location.</p>
        {dupWarning && (
          <div className="mt-2.5 bg-orange-50 dark:bg-orange-950/30 border-[1.5px] border-signal-orange rounded-md px-3 py-2 text-sm text-orange-900 dark:text-orange-200">
            {dupWarning}
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold mb-1.5">Photo (optional)</label>
        <div className="border-[1.5px] border-dashed border-line dark:border-asphalt-2 rounded-md p-3.5 text-center bg-panel dark:bg-asphalt-2">
          <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} />
          {photoPreview && <img src={photoPreview} className="max-w-full max-h-40 rounded-md mt-2.5 mx-auto" />}
        </div>
        <div className="flex items-center gap-2.5 flex-wrap mt-2.5">
          <button type="button" disabled={!photoPreview || aiBusy} onClick={runAiAssist} className="btn btn-ai disabled:opacity-50">
            {aiBusy ? 'Analyzing…' : 'Analyze photo for severity'}
          </button>
          {aiResult && <div className="flex-1 min-w-[200px] text-xs text-inksoft card">{aiResult}</div>}
        </div>
      </div>

      <button className="btn btn-yellow" disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Submitting…' : 'Submit report'}
      </button>

      {confirmMsg && (
        <div className="mt-4 bg-amber-50 dark:bg-amber-950/30 border-[1.5px] border-signal-yellow rounded-md px-4 py-3 text-sm">
          {confirmMsg}
        </div>
      )}
    </div>
  );
}
