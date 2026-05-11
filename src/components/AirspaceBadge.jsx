// src/components/AirspaceBadge.jsx
// LAANC-style airspace authorization indicator.
// Pulls /api/airspace/check?lat=&lng= and shows a colored chip + on-click details panel.

import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';

const STATUS_STYLES = {
  cleared:    { bg: '#0a3d1a', fg: '#34d399', icon: '✓', label: 'Airspace cleared' },
  caution:    { bg: '#3a2d0d', fg: '#fcd34d', icon: '⚠', label: 'LAANC required' },
  restricted: { bg: '#4a1d1d', fg: '#fca5a5', icon: '✕', label: 'Restricted airspace' },
};

export default function AirspaceBadge({ lat, lng, compact = false }) {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/airspace/check?lat=${lat}&lng=${lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (!data) return null;
  const s = STATUS_STYLES[data.status] || STATUS_STYLES.caution;

  if (compact) {
    return (
      <span title={data.explainer} style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: s.bg, color: s.fg,
        padding: '2px 8px', borderRadius: '999px',
        fontSize: '11px', fontWeight: 600,
        border: `1px solid ${s.fg}33`,
        cursor: 'help',
      }}>
        <span>{s.icon}</span>
        <span>{s.label}</span>
      </span>
    );
  }

  return (
    <div style={{
      background: '#111',
      border: `1px solid ${s.fg}33`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', padding: '14px 18px',
          background: 'transparent', border: 'none', color: 'white',
          cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            background: s.bg, color: s.fg,
            width: '28px', height: '28px',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700,
          }}>{s.icon}</span>
          <div>
            <div style={{ color: s.fg, fontSize: '14px', fontWeight: 600 }}>{s.label}</div>
            <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '2px' }}>
              {data.airspace_class} · max {data.max_altitude_ft} ft AGL
            </div>
          </div>
        </div>
        <span style={{ color: '#666', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{
          padding: '0 18px 18px', borderTop: '1px solid #222',
          color: '#9ca3af', fontSize: '13px',
        }}>
          <p style={{ margin: '14px 0 10px', color: '#d1d5db' }}>{data.explainer}</p>

          {data.requires_authorization && (
            <div style={{
              padding: '8px 12px', background: '#3a2d0d',
              border: '1px solid #fcd34d33', borderRadius: '6px',
              color: '#fcd34d', fontSize: '12px', marginBottom: '10px',
            }}>
              Requires LAANC authorization before flight.
            </div>
          )}

          {data.active_notams?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>ACTIVE NOTAMs</div>
              {data.active_notams.map((n, i) => (
                <div key={i} style={{ color: '#fca5a5', fontSize: '12px', marginBottom: '2px' }}>• {n}</div>
              ))}
            </div>
          )}

          {data.nearby_facilities?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>NEARBY FACILITIES</div>
              {data.nearby_facilities.map((f, i) => (
                <div key={i} style={{ fontSize: '12px', marginBottom: '2px' }}>• {f}</div>
              ))}
            </div>
          )}

          <div style={{ color: '#555', fontSize: '11px', marginTop: '12px' }}>
            {data.source} · checked {new Date(data.last_checked).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
