// src/components/ReputationCard.jsx
// Operator reputation breakdown. Pulls /api/operators/:id/reputation.

import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';

const COMPONENT_LABELS = {
  rating:   { label: 'Rating quality',  max: 40, color: '#a855f7' },
  volume:   { label: 'Completion volume', max: 20, color: '#7dd3fc' },
  hours:    { label: 'Flight hours',     max: 15, color: '#34d399' },
  certs:    { label: 'Certifications',   max: 10, color: '#fcd34d' },
  verified: { label: 'License verified', max: 15, color: '#f472b6' },
};

export default function ReputationCard({ operatorId }) {
  const [rep, setRep] = useState(null);

  useEffect(() => {
    if (!operatorId) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/operators/${operatorId}/reputation`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setRep(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [operatorId]);

  if (!rep) return null;

  // Color band by score
  const scoreColor = rep.score >= 80 ? '#34d399'
                  : rep.score >= 60 ? '#7dd3fc'
                  : rep.score >= 40 ? '#fcd34d'
                  : '#fca5a5';

  return (
    <div style={{
      background: '#111',
      border: '1px solid #333',
      borderRadius: '16px',
      padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          background: `conic-gradient(${scoreColor} ${rep.score * 3.6}deg, #1f2937 0deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            width: '74px', height: '74px',
            borderRadius: '50%',
            background: '#111',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: scoreColor }}>{rep.score}</span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>/ 100</span>
          </div>
        </div>
        <div>
          <h3 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: 600 }}>
            Reputation score
          </h3>
          <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: '12px' }}>
            {rep.factors.completed_missions} completed · {rep.factors.flight_hours}h flown ·{' '}
            {rep.factors.license_status === 'verified' ? '✓ verified' : rep.factors.license_status}
          </p>
          {rep.penalties.slash > 0 && (
            <p style={{ color: '#fca5a5', margin: '4px 0 0 0', fontSize: '11px' }}>
              -{rep.penalties.slash} slash penalty
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(COMPONENT_LABELS).map(([key, cfg]) => {
          const value = rep.breakdown[key] || 0;
          const pct = Math.round((value / cfg.max) * 100);
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px' }}>{cfg.label}</span>
                <span style={{ color: 'white', fontSize: '12px', fontWeight: 500 }}>
                  {value} / {cfg.max}
                </span>
              </div>
              <div style={{ background: '#1f2937', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  background: cfg.color,
                  height: '100%',
                  width: `${pct}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
