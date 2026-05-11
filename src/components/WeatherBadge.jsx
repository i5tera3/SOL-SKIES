// src/components/WeatherBadge.jsx
// Compact weather flyability indicator for mission cards. Shows the current
// flyable status as a colored chip with wind + temp summary.

import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';

const COLORS = { good: '#22c55e', caution: '#f59e0b', unsafe: '#ef4444' };
const LABELS = { good: '✅ Flyable today', caution: '⚠️ Caution today', unsafe: '🚫 Poor conditions' };
const ICONS  = { Clear: '☀️', Clouds: '🌤️', Rain: '🌧️', Wind: '💨', Snow: '❄️', Thunderstorm: '⛈️' };

export default function WeatherBadge({ lat, lng }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!lat || !lng) return;
    fetch(`${API_BASE}/api/weather?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(d => { if (d.daily?.[0]) setStatus(d.daily[0]); })
      .catch(() => {});
  }, [lat, lng]);

  if (!lat || !lng || !status) return null;
  const color = COLORS[status.flyable] || '#888';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: `${color}15`, border: `1px solid ${color}40`,
      borderRadius: 8, padding: '6px 10px', marginBottom: 10, fontSize: 12,
    }}>
      <span>{ICONS[status.condition] || '🌡️'}</span>
      <span style={{ color, fontWeight: 600 }}>{LABELS[status.flyable]}</span>
      <span style={{ color: '#888', marginLeft: 'auto' }}>
        {status.wind_kmh} km/h wind · {status.temp_c}°C
      </span>
    </div>
  );
}
