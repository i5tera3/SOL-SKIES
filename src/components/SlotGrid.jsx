// src/components/SlotGrid.jsx
// Visual slot occupancy for multi-operator missions, with click-to-claim.
// Renders [● ● ○ ○] style indicators + a list of slot statuses with operator names.

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { apiFetch, API_BASE } from '../lib/api';

const SLOT_COLORS = {
  open:      { bg: '#0d3a26', fg: '#6ee7b7', dot: '○' },
  claimed:   { bg: '#3a2d0d', fg: '#fcd34d', dot: '◐' },
  active:    { bg: '#0e2c4a', fg: '#7dd3fc', dot: '◔' },
  completed: { bg: '#0a3d1a', fg: '#34d399', dot: '●' },
  failed:    { bg: '#4a1d1d', fg: '#fca5a5', dot: '✕' },
};

export default function SlotGrid({ missionId, currentUser, onChange }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!missionId) return;
    try {
      const r = await fetch(`${API_BASE}/api/missions/${missionId}/slots`);
      if (r.ok) setData(await r.json());
    } catch (_) { /* ignore */ }
  }, [missionId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleClaim = async (slotId) => {
    if (!currentUser || currentUser.role !== 'operator') {
      toast.error('Only operators can claim slots');
      return;
    }
    setError(null);
    setClaiming(slotId);
    const promise = apiFetch(`/api/missions/${missionId}/slots/${slotId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ stake_lamports: 100_000_000 }),
    });
    try {
      const result = await toast.promise(promise, {
        loading: 'Claiming slot…',
        success: 'Slot claimed — 0.1 SOL staked',
        error: (e) => e.message || 'Claim failed',
      });
      await refresh();
      if (onChange) onChange(result);
    } catch (e) {
      // toast.promise already showed the error; keep inline display for tests.
      setError(e.message || 'Claim failed');
    } finally {
      setClaiming(null);
    }
  };

  if (!data || !data.slots || !data.slots.length) return null;

  const { slots, counts } = data;
  const fillPct = counts.total ? Math.round(((counts.claimed + counts.active + counts.completed) / counts.total) * 100) : 0;

  return (
    <div style={{
      background: '#111',
      border: '1px solid #333',
      borderRadius: '12px',
      padding: '20px',
      marginTop: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: 600 }}>
          Operator slots
        </h3>
        <span style={{ color: '#9ca3af', fontSize: '13px' }}>
          {counts.completed + counts.active + counts.claimed}/{counts.total} filled · {fillPct}%
        </span>
      </div>

      {/* Compact dot row */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', fontSize: '20px' }}>
        {slots.map(s => {
          const c = SLOT_COLORS[s.status] || SLOT_COLORS.open;
          return (
            <span key={s.id} title={`Slot ${s.slot_index + 1}: ${s.status}`} style={{ color: c.fg }}>
              {c.dot}
            </span>
          );
        })}
      </div>

      {/* Per-slot rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slots.map(s => {
          const c = SLOT_COLORS[s.status] || SLOT_COLORS.open;
          const isMine = currentUser?.id && s.operator_id === currentUser.id;
          const canClaim = s.status === 'open' && currentUser?.role === 'operator';
          return (
            <div key={s.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: '#0a0a0a',
              border: `1px solid ${c.fg}22`,
              borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  background: c.bg, color: c.fg,
                  padding: '2px 8px', borderRadius: '999px',
                  fontSize: '11px', fontWeight: 600,
                  border: `1px solid ${c.fg}33`,
                }}>
                  Slot {s.slot_index + 1}
                </span>
                <span style={{ color: c.fg, fontSize: '13px', fontWeight: 500, textTransform: 'capitalize' }}>
                  {s.status}
                </span>
                {s.operator_username && (
                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                    @{s.operator_username}{isMine ? ' (you)' : ''}
                  </span>
                )}
              </div>
              {canClaim && (
                <button
                  onClick={() => handleClaim(s.id)}
                  disabled={claiming === s.id}
                  style={{
                    background: '#9333ea', color: 'white',
                    border: 'none', borderRadius: '999px',
                    padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                    cursor: claiming === s.id ? 'wait' : 'pointer',
                    opacity: claiming === s.id ? 0.6 : 1,
                  }}
                >
                  {claiming === s.id ? 'Claiming…' : 'Claim slot'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: '#4a1d1d',
          color: '#fca5a5',
          borderRadius: '8px',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
