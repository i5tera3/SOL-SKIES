// src/components/AuditTimeline.jsx
// Vertical timeline of mission/contract audit events.
// Pulls /api/missions/:id/audit (public) or /api/contracts/:id/audit (auth required).

import { useEffect, useState } from 'react';
import { apiFetch, API_BASE } from '../lib/api';

const ACTION_LABELS = {
  mission_created:        { icon: '📋', label: 'Mission created', color: '#7dd3fc' },
  mission_funded:         { icon: '💰', label: 'Escrow funded',   color: '#34d399' },
  mission_status_changed: { icon: '🔄', label: 'Status changed',  color: '#a855f7' },
  slot_claimed:           { icon: '✋', label: 'Slot claimed',    color: '#fcd34d' },
  slot_activated:         { icon: '▶',  label: 'Slot activated',  color: '#7dd3fc' },
  slot_completed:         { icon: '✓',  label: 'Slot completed',  color: '#34d399' },
  contract_completed:     { icon: '🏁', label: 'Contract completed', color: '#34d399' },
  dispute_raised:         { icon: '⚠',  label: 'Dispute raised',  color: '#fca5a5' },
  dispute_resolved:       { icon: '⚖',  label: 'Dispute resolved', color: '#a855f7' },
  mission_completed:      { icon: '🎉', label: 'Mission completed', color: '#34d399' },
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function describePayload(action, payload) {
  if (!payload) return null;
  if (action === 'mission_status_changed') {
    return `${payload.from} → ${payload.to}${payload.trigger ? ` (${payload.trigger})` : ''}`;
  }
  if (action === 'slot_claimed') return `Slot ${payload.slot_index + 1}${payload.stake_lamports ? ` · ${(payload.stake_lamports / 1e9).toFixed(2)} SOL stake` : ''}`;
  if (action === 'contract_completed') return `Rating: ${payload.rating}★`;
  if (action === 'dispute_raised') return payload.reason ? `"${payload.reason.slice(0, 80)}"` : null;
  if (action === 'dispute_resolved') return `Decision: ${payload.decision}`;
  if (action === 'mission_funded') return payload.lamports ? `${(payload.lamports / 1e9).toFixed(2)} SOL` : null;
  return null;
}

export default function AuditTimeline({ entityType = 'mission', entityId, requireAuth = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    const path = `/api/${entityType}s/${entityId}/audit`;
    const fetcher = requireAuth ? apiFetch(path) : fetch(`${API_BASE}${path}`).then(r => r.ok ? r.json() : { events: [] });
    Promise.resolve(fetcher)
      .then(d => { if (!cancelled) { setEvents(d.events || []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId, requireAuth]);

  if (loading) return <div style={{ color: '#666', fontSize: '13px' }}>Loading timeline…</div>;
  if (!events.length) return <div style={{ color: '#666', fontSize: '13px' }}>No events yet.</div>;

  return (
    <div style={{ position: 'relative', paddingLeft: '24px' }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute',
        left: '8px', top: '8px', bottom: '8px',
        width: '2px',
        background: '#333',
      }} />

      {events.map((ev, i) => {
        const cfg = ACTION_LABELS[ev.action] || { icon: '•', label: ev.action, color: '#9ca3af' };
        const detail = describePayload(ev.action, ev.payload);
        return (
          <div key={ev.id || i} style={{ position: 'relative', paddingBottom: '14px' }}>
            <div style={{
              position: 'absolute',
              left: '-20px',
              width: '16px', height: '16px',
              borderRadius: '50%',
              background: cfg.color,
              border: '2px solid #0a0a0a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px',
              color: 'black',
            }}>
              {cfg.icon}
            </div>
            <div style={{
              background: '#111',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: cfg.color, fontSize: '13px', fontWeight: 600 }}>
                  {cfg.label}
                </span>
                <span style={{ color: '#666', fontSize: '11px' }}>
                  {formatTime(ev.timestamp)}
                </span>
              </div>
              {detail && (
                <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
                  {detail}
                </div>
              )}
              {ev.actor_role && (
                <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>
                  by {ev.actor_role}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
