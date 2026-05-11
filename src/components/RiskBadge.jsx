// src/components/RiskBadge.jsx
// Mission risk indicator — pulls /api/missions/:id/risk on mount.

import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';

const COLORS = {
  low:    { bg: '#0a3d1a', fg: '#34d399', icon: '✓' },
  medium: { bg: '#3a2d0d', fg: '#fcd34d', icon: '⚠' },
  high:   { bg: '#4a1d1d', fg: '#fca5a5', icon: '✕' },
};

export default function RiskBadge({ missionId, compact = false }) {
  const [risk, setRisk] = useState(null);
  useEffect(() => {
    if (!missionId) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/missions/${missionId}/risk`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setRisk(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [missionId]);

  if (!risk) return null;
  const c = COLORS[risk.level] || COLORS.medium;
  return (
    <span title={`Risk score: ${risk.score}`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: c.bg,
      color: c.fg,
      padding: compact ? '2px 8px' : '4px 12px',
      borderRadius: '999px',
      fontSize: compact ? '11px' : '12px',
      fontWeight: 600,
      border: `1px solid ${c.fg}33`,
    }}>
      <span>{c.icon}</span>
      <span>Risk: {risk.level}</span>
    </span>
  );
}
