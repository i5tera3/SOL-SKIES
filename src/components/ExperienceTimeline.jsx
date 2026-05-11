// src/components/ExperienceTimeline.jsx
// LinkedIn-style work-history timeline for operator profiles.
// Public read; if `canEdit` is true the owner sees +Add/Delete controls.

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE, apiFetch } from '../lib/api';
import ExperienceModal from './ExperienceModal';

function fmtDate(s) {
  if (!s) return 'Present';
  // Accept 'YYYY-MM' or 'YYYY-MM-DD'
  const [y, m] = s.split('-');
  if (!y) return s;
  if (!m) return y;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthName = months[parseInt(m, 10) - 1] || m;
  return `${monthName} ${y}`;
}

function spanLabel(start, end) {
  const a = fmtDate(start);
  const b = fmtDate(end);
  if (a === 'Present' && b === 'Present') return '';
  if (b === 'Present') return `${a} — Present`;
  return `${a} — ${b}`;
}

export default function ExperienceTimeline({ operatorId, canEdit = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    if (!operatorId) return;
    try {
      const r = await fetch(`${API_BASE}/api/operators/${operatorId}/experiences`);
      if (r.ok) setItems(await r.json());
    } catch (e) {
      console.error('Load experiences error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line */ }, [operatorId]);

  const handleDelete = async (expId) => {
    if (!confirm('Delete this experience entry?')) return;
    try {
      await apiFetch(`/api/operators/${operatorId}/experiences/${expId}`, { method: 'DELETE' });
      setItems(prev => prev.filter(x => x.id !== expId));
      toast.success('Experience removed');
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  if (loading) {
    return <div style={{ color: '#666', fontSize: 13, padding: 12 }}>Loading work history…</div>;
  }

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <h3 style={{ color: 'white', fontSize: 17, fontWeight: 600 }}>💼 Work history</h3>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            style={{
              background: '#9333ea', border: 'none', color: 'white',
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
            }}
          >
            + Add experience
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{
          background: '#111', border: '1px dashed #333', borderRadius: 12,
          padding: 24, textAlign: 'center', color: '#666', fontSize: 13,
        }}>
          {canEdit
            ? 'No experiences yet. Add your past gigs to strengthen your profile.'
            : 'This operator hasn\'t listed any past experiences yet.'}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical timeline rail */}
          <div style={{
            position: 'absolute', left: 14, top: 8, bottom: 8,
            width: 2, background: '#222',
          }} />
          {items.map(exp => {
            const isCurrent = !exp.end_date;
            return (
              <div key={exp.id} style={{
                position: 'relative', paddingLeft: 40, marginBottom: 22,
              }}>
                {/* Dot */}
                <div style={{
                  position: 'absolute', left: 8, top: 12,
                  width: 14, height: 14, borderRadius: '50%',
                  background: isCurrent ? '#9333ea' : '#444',
                  border: '2px solid #0a0a0a',
                  boxShadow: isCurrent ? '0 0 0 3px #9333ea30' : 'none',
                }} />
                <div style={{
                  background: '#111', border: '1px solid #222',
                  borderRadius: 12, padding: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{exp.role}</div>
                      <div style={{ color: '#c084fc', fontSize: 13, marginTop: 2 }}>{exp.company}</div>
                      <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                        {spanLabel(exp.start_date, exp.end_date)}
                        {exp.region ? ` · 📍 ${exp.region}` : ''}
                        {exp.industry ? ` · ${exp.industry}` : ''}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(exp.id)}
                        title="Delete"
                        style={{
                          background: 'transparent', border: 'none',
                          color: '#666', cursor: 'pointer', fontSize: 16, padding: 4,
                        }}
                      >×</button>
                    )}
                  </div>
                  {exp.description && (
                    <p style={{ color: '#bbb', fontSize: 13, lineHeight: 1.5, marginTop: 10 }}>
                      {exp.description}
                    </p>
                  )}
                  {exp.image_url && (
                    <img
                      src={exp.image_url}
                      alt={`${exp.role} at ${exp.company}`}
                      style={{
                        marginTop: 12, maxWidth: '100%', maxHeight: 280,
                        borderRadius: 10, border: '1px solid #222',
                        display: 'block', cursor: 'pointer',
                      }}
                      onClick={() => window.open(exp.image_url, '_blank', 'noopener')}
                    />
                  )}
                  {exp.drone_models?.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {exp.drone_models.map(m => (
                        <span key={m} style={{
                          background: '#9333ea15', border: '1px solid #9333ea30',
                          color: '#c084fc', borderRadius: 12,
                          padding: '2px 10px', fontSize: 11,
                        }}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <ExperienceModal
          operatorId={operatorId}
          onClose={() => setShowAdd(false)}
          onSaved={(exp) => {
            setItems(prev => [exp, ...prev]);
            setShowAdd(false);
            toast.success('Experience added');
          }}
        />
      )}
    </div>
  );
}
