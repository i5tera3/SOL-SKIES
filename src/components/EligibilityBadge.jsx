// src/components/EligibilityBadge.jsx
// Per-mission eligibility result for the authenticated operator.
// Shows ✓ / ✗ + match score, with missing requirements as a tooltip.

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export default function EligibilityBadge({ missionId, compact = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!missionId) return;
    let cancelled = false;
    apiFetch(`/api/missions/${missionId}/eligibility`)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [missionId]);

  if (error) return null;
  if (!data) return null;

  const eligible = data.eligible;
  const tooltip = eligible
    ? `Match score: ${data.score}/100`
    : 'Missing: ' + (data.missingRequirements || []).join(' • ');

  return (
    <span title={tooltip} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: eligible ? '#0a3d1a' : '#4a1d1d',
      color: eligible ? '#34d399' : '#fca5a5',
      padding: compact ? '2px 8px' : '4px 12px',
      borderRadius: '999px',
      fontSize: compact ? '11px' : '12px',
      fontWeight: 600,
      border: `1px solid ${eligible ? '#34d39933' : '#fca5a533'}`,
      cursor: 'help',
    }}>
      <span>{eligible ? '✓' : '✗'}</span>
      <span>{eligible ? `You qualify (${data.score}/100)` : `Not eligible (${data.missingRequirements?.length || 0})`}</span>
    </span>
  );
}
