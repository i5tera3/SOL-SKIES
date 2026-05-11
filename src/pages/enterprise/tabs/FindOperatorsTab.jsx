// src/pages/enterprise/tabs/FindOperatorsTab.jsx
// Marketplace search for enterprises — find operators by region, certification,
// vehicle type, minimum rating, minimum flight hours, and license status.
//
// Each result card shows the operator's reputation score (computed server-side
// from rating × completion × hours × certs × verified × slashed-stake history),
// their primary drone, regional coverage, and a click-through to the full
// public profile page (where their work history timeline + capability score
// breakdown live).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../../lib/api';

const VEHICLE_TYPES = ['', 'multicopter', 'quad', 'hex', 'octo', 'fixed_wing', 'vtol', 'helicopter'];
const LICENSE_STATUSES = ['', 'verified', 'pending', 'none'];

export default function FindOperatorsTab() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    region: '',
    cert: '',
    vehicle_type: '',
    min_rating: '',
    min_hours: '',
    license_status: '',
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  const setFilter = (k) => (e) => setFilters(prev => ({ ...prev, [k]: e.target.value }));

  const runSearch = async () => {
    setLoading(true);
    const qs = Object.entries(filters)
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    try {
      const r = await fetch(`${API_BASE}/api/search/operators${qs ? '?' + qs : ''}`);
      if (r.ok) setResults(await r.json());
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  // Initial unfiltered load so the demo isn't empty.
  useEffect(() => { runSearch(); /* eslint-disable-next-line */ }, []);

  const reset = () => {
    setFilters({ region: '', cert: '', vehicle_type: '', min_rating: '', min_hours: '', license_status: '' });
  };

  const labelStyle = { color: '#888', fontSize: 11, marginBottom: 4, display: 'block' };
  const inputStyle = {
    width: '100%', background: '#1a1a1a', border: '1px solid #333',
    borderRadius: 8, padding: '8px 10px', color: 'white', fontSize: 13,
  };

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {/* Filter sidebar */}
      <aside style={{
        width: 260, flexShrink: 0,
        background: '#111', border: '1px solid #222',
        borderRadius: 16, padding: 18, height: 'fit-content',
        position: 'sticky', top: 20,
      }}>
        <h3 style={{ color: 'white', fontSize: 14, marginBottom: 14 }}>Filter operators</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Region</label>
            <input style={inputStyle} placeholder="Germany, Jordan, USA…"
              value={filters.region} onChange={setFilter('region')} />
          </div>

          <div>
            <label style={labelStyle}>Certification</label>
            <input style={inputStyle} placeholder="part107, easa_a2, mapping_l2…"
              value={filters.cert} onChange={setFilter('cert')} />
          </div>

          <div>
            <label style={labelStyle}>Vehicle type</label>
            <select style={inputStyle} value={filters.vehicle_type} onChange={setFilter('vehicle_type')}>
              {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v || 'Any'}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Min rating (1–5)</label>
            <input style={inputStyle} type="number" step="0.5" min="1" max="5"
              value={filters.min_rating} onChange={setFilter('min_rating')} placeholder="e.g. 4" />
          </div>

          <div>
            <label style={labelStyle}>Min flight hours</label>
            <input style={inputStyle} type="number" min="0"
              value={filters.min_hours} onChange={setFilter('min_hours')} placeholder="e.g. 200" />
          </div>

          <div>
            <label style={labelStyle}>License</label>
            <select style={inputStyle} value={filters.license_status} onChange={setFilter('license_status')}>
              {LICENSE_STATUSES.map(s => <option key={s} value={s}>{s || 'Any'}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={reset} style={{
            flex: 1, background: 'transparent', border: '1px solid #333',
            color: '#aaa', borderRadius: 8, padding: '8px 0',
            fontSize: 12, cursor: 'pointer',
          }}>Reset</button>
          <button onClick={runSearch} style={{
            flex: 2, background: '#9333ea', border: 'none',
            color: 'white', borderRadius: 8, padding: '8px 0',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Search</button>
        </div>
      </aside>

      {/* Result grid */}
      <main style={{ flex: 1 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 18,
        }}>
          <h2 style={{ color: 'white', fontSize: 20 }}>
            🔎 {loading ? 'Searching…' : `${results.length} operator${results.length === 1 ? '' : 's'} found`}
          </h2>
        </div>

        {loading ? null : results.length === 0 ? (
          <div style={{
            background: '#111', border: '1px solid #222', borderRadius: 16,
            padding: 60, textAlign: 'center', color: '#888',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🕵️</div>
            <div style={{ fontSize: 15 }}>
              {searched ? 'No operators match these filters. Loosen them and try again.' : 'No operators registered yet.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {results.map(op => (
              <div
                key={op.id}
                onClick={() => op.username && navigate(`/operator/${op.username}`)}
                style={{
                  background: '#111', border: '1px solid #222',
                  borderRadius: 16, padding: 18,
                  cursor: op.username ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#9333ea'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{op.full_name}</div>
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>@{op.username}</div>
                  </div>
                  {/* Reputation score chip */}
                  <div style={{
                    background: op.reputation >= 70 ? '#0a3d1a' : op.reputation >= 40 ? '#3a2d0d' : '#4a1d1d',
                    color: op.reputation >= 70 ? '#34d399' : op.reputation >= 40 ? '#fcd34d' : '#fca5a5',
                    border: `1px solid ${op.reputation >= 70 ? '#34d39933' : op.reputation >= 40 ? '#fcd34d33' : '#fca5a533'}`,
                    borderRadius: 999, padding: '3px 10px',
                    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    {op.reputation}/100
                  </div>
                </div>

                <div style={{ color: '#bbb', fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                  {op.region ? `📍 ${op.region}` : '🌍 Region unspecified'}
                  {op.flight_hours ? ` · ${op.flight_hours}h logged` : ''}
                  {op.rating != null ? ` · ★ ${op.rating.toFixed(1)}` : ''}
                </div>

                {op.drone_model && (
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                    🚁 {op.drone_model}
                  </div>
                )}

                {op.certifications?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {op.certifications.slice(0, 4).map(c => (
                      <span key={c} style={{
                        background: '#9333ea15', border: '1px solid #9333ea30',
                        color: '#c084fc', borderRadius: 999, padding: '2px 8px',
                        fontSize: 10, fontWeight: 600,
                      }}>{c}</span>
                    ))}
                    {op.certifications.length > 4 && (
                      <span style={{ color: '#666', fontSize: 11 }}>+{op.certifications.length - 4}</span>
                    )}
                  </div>
                )}

                {op.license_status === 'verified' && (
                  <div style={{
                    display: 'inline-block', background: '#0a3d1a',
                    color: '#34d399', border: '1px solid #34d39933',
                    borderRadius: 6, padding: '2px 8px',
                    fontSize: 10, fontWeight: 600,
                  }}>
                    ✓ License verified
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
