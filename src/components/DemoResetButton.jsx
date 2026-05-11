// src/components/DemoResetButton.jsx
// Admin-only button to wipe + re-seed the demo dataset.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE } from '../lib/api';

export default function DemoResetButton({ onComplete }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const handleReset = async () => {
    if (!confirm('Wipe ALL data and re-seed demo dataset? This cannot be undone.')) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/seed-demo`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Seed failed');
      setResult({ ok: true, summary: d.summary });
      toast.success(`Demo seeded: ${d.summary.operators} ops, ${d.summary.missions} missions, ${d.summary.slots_created} slots`);
      if (onComplete) onComplete(d);
    } catch (e) {
      setResult({ ok: false, error: e.message });
      toast.error(`Seed failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div>
        <h3 style={{ color: 'white', margin: 0, fontSize: '14px', fontWeight: 600 }}>
          Demo dataset
        </h3>
        <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: '12px' }}>
          Wipes the database and seeds 3 operators, 2 enterprises, 3 missions
          including a multi-op mission with 4 slots (1 already claimed).
        </p>
      </div>
      <button onClick={handleReset} disabled={busy} style={{
        background: '#9333ea',
        color: 'white',
        border: 'none',
        borderRadius: '999px',
        padding: '10px 20px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.6 : 1,
        alignSelf: 'flex-start',
      }}>
        {busy ? 'Resetting…' : 'Reset & seed demo'}
      </button>
      {result && (
        <div style={{
          background: result.ok ? '#0a3d1a' : '#4a1d1d',
          color: result.ok ? '#34d399' : '#fca5a5',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '12px',
        }}>
          {result.ok
            ? `✓ Seeded: ${result.summary.operators} operators, ${result.summary.enterprises} enterprises, ${result.summary.missions} missions, ${result.summary.slots_created} slots (${result.summary.slots_claimed} claimed)`
            : `✗ ${result.error}`}
        </div>
      )}
    </div>
  );
}
