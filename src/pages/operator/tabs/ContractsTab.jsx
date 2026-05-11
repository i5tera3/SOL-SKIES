// src/pages/operator/tabs/ContractsTab.jsx
// Contracts tab — your contracts grid (filterable) + open missions to apply to
// (with subtask claiming + eligibility-aware Apply button).

import { API_BASE } from '../../../lib/api';
import MissionStatePill from '../../../components/MissionStatePill';
import EligibilityBadge from '../../../components/EligibilityBadge';
import WeatherBadge from '../../../components/WeatherBadge';

export default function ContractsTab({ ctx }) {
  const {
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    regionFilter, setRegionFilter,
    uniqueRegions,
    filteredContracts,
    getStatusColor,
    setSelectedContractDetail,
    updateContractProgress,
    fetchMissions,
    missionsLoading,
    availableMissions,
    setAvailableMissions,
    appliedMissionIds,
    operatorData,
    applyingId,
    applyToMission,
  } = ctx;

  return (
    <div>
      {/* ── Section A: Your Contracts ── */}
      <div className="filters-section">
        <h2 className="section-title">Your Contracts</h2>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search contracts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 2, minWidth: '250px', padding: '12px 16px',
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: '10px', color: 'white', fontSize: '14px',
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              flex: 1, minWidth: '150px', padding: '12px 16px',
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: '10px', color: 'white', fontSize: '14px',
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            style={{
              flex: 1, minWidth: '150px', padding: '12px 16px',
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: '10px', color: 'white', fontSize: '14px',
            }}
          >
            <option value="all">All Regions</option>
            {uniqueRegions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredContracts.length > 0 ? (
        <div className="contracts-grid">
          {filteredContracts.map(contract => (
            <div key={contract.id} className="contract-card">
              <div className="contract-header">
                <span className="contract-client">{contract.client_name || 'Client'}</span>
                <span className="contract-status" style={{
                  background: `${getStatusColor(contract.status)}20`,
                  color: getStatusColor(contract.status),
                  border: `1px solid ${getStatusColor(contract.status)}30`,
                }}>
                  {contract.status}
                </span>
              </div>
              <div className="contract-mission">{contract.title || 'Mission'}</div>
              <div className="contract-details">
                <div className="detail-item">
                  <div className="detail-label">Zone</div>
                  <div className="detail-value">{contract.region || 'N/A'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Value</div>
                  <div className="detail-value">{contract.amount_sol || 0} SOL</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Date</div>
                  <div className="detail-value">{contract.created_at ? new Date(contract.created_at > 1e12 ? contract.created_at : contract.created_at * 1000).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>
              {contract.status === 'active' && (
                <div className="contract-progress">
                  <div className="progress-header">
                    <span>Progress</span>
                    <span>{contract.progress || 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${contract.progress || 0}%` }}></div>
                  </div>
                </div>
              )}
              <div className="contract-actions">
                <button className="action-btn" onClick={() => setSelectedContractDetail(contract)}>View Details</button>
                {contract.status === 'active' && (
                  <button className="action-btn primary" onClick={() => {
                    const p = prompt(`Update progress for "${contract.title}" (current: ${contract.progress || 0}%):`, contract.progress || 0);
                    if (p !== null && !isNaN(parseInt(p))) {
                      const val = Math.min(100, Math.max(0, parseInt(p)));
                      updateContractProgress(contract.id, val, val === 100);
                    }
                  }}>Update Progress</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: '#111111', borderRadius: '20px',
          padding: '60px', textAlign: 'center', border: '1px solid #222',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
          <h3 style={{ color: 'white', marginBottom: '10px' }}>No Contracts Found</h3>
          <p style={{ color: '#888', fontSize: '16px' }}>
            {searchTerm || statusFilter !== 'all' || regionFilter !== 'all'
              ? 'No contracts match your filters. Try adjusting your search.'
              : "You haven't been assigned any contracts yet."}
          </p>
        </div>
      )}

      {/* ── Section B: Open Missions to Apply To ── */}
      <div style={{ marginTop: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Open Missions</h2>
          <button onClick={fetchMissions} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
            ↻ Refresh
          </button>
        </div>
        {missionsLoading ? (
          <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>Loading missions...</div>
        ) : availableMissions.length === 0 ? (
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 20, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✈️</div>
            <h3 style={{ color: 'white', marginBottom: 8 }}>No Open Missions</h3>
            <p style={{ color: '#888', fontSize: 14 }}>Check back later — enterprises post new missions regularly.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {availableMissions.map(mission => {
              const alreadyApplied = appliedMissionIds.has(mission.id);
              const reqs = mission.requirements || {};

              const failedReqs = [];
              if (reqs.licenseRequired && !(operatorData?.certifications?.length > 0)) {
                failedReqs.push('License required');
              }
              if (reqs.certificationsRequired?.length > 0) {
                const opCerts = operatorData?.certifications || [];
                const missing = reqs.certificationsRequired.filter(c => !opCerts.includes(c));
                if (missing.length > 0) failedReqs.push(`Missing certs: ${missing.join(', ')}`);
              }
              const meetsRequirements = failedReqs.length === 0;

              return (
                <div key={mission.id}
                  style={{ background: '#111', border: '1px solid #222', borderRadius: 20, padding: 22, transition: 'all .2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#9333ea'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{mission.title}</div>
                      <div style={{ color: '#9333ea', fontSize: 13, marginBottom: 6 }}>{mission.mission_type || mission.missionType}</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <MissionStatePill state={mission.status} size="sm" />
                        <EligibilityBadge missionId={mission.id} compact />
                      </div>
                    </div>
                    <div style={{ background: '#22c55e15', border: '1px solid #22c55e30', color: '#22c55e', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 10 }}>
                      {mission.reward} USDC
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      ['📍 Region', mission.region || 'Any'],
                      ['⏰ Min Hours', reqs.minFlightHours ? `${reqs.minFlightHours}h` : 'None'],
                      ['🚁 Drone', reqs.droneType || 'Any'],
                      ['📋 License', reqs.licenseRequired ? 'Required' : 'Not required'],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: '#1a1a1a', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ color: '#666', fontSize: 11, marginBottom: 2 }}>{label}</div>
                        <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {mission.description && (
                    <p style={{ color: '#888', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                      {mission.description.length > 120 ? mission.description.slice(0, 120) + '…' : mission.description}
                    </p>
                  )}
                  {reqs.certificationsRequired?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      {reqs.certificationsRequired.map(c => (
                        <span key={c} style={{ background: '#9333ea15', border: '1px solid #9333ea30', color: '#c084fc', borderRadius: 20, padding: '2px 10px', fontSize: 11, marginRight: 6 }}>{c}</span>
                      ))}
                    </div>
                  )}
                  <WeatherBadge lat={mission.latitude} lng={mission.longitude} />

                  {mission.subtasks?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>
                        📋 {mission.subtasks.filter(s => s.status === 'open').length} of {mission.subtasks.length} subtasks available
                      </div>
                      {mission.subtasks.map(sub => {
                        const isClaimed = sub.status !== 'open';
                        const isMineClaimed = sub.claimed_by === operatorData?.id;
                        return (
                          <div key={sub.id} style={{
                            background: isClaimed ? '#0a0a0a' : '#0d0d1a',
                            border: `1px solid ${isMineClaimed ? '#22c55e40' : isClaimed ? '#333' : '#9333ea30'}`,
                            borderRadius: 8, padding: '8px 12px', marginBottom: 6,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: isClaimed ? '#555' : 'white', fontSize: 13, fontWeight: 600 }}>{sub.name}</div>
                              {sub.description && <div style={{ color: '#666', fontSize: 11 }}>{sub.description}</div>}
                              {sub.claimed_by_name && <div style={{ color: '#888', fontSize: 11 }}>Claimed by {sub.claimed_by_name}</div>}
                            </div>
                            <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{sub.sol_reward} SOL</div>
                            {!isClaimed && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`${API_BASE}/api/missions/${mission.id}/subtasks/${sub.id}/claim`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ operator_id: operatorData?.id, operator_name: operatorData?.full_name }),
                                    });
                                    const d = await res.json();
                                    if (res.ok) {
                                      setAvailableMissions(prev => prev.map(m => m.id === mission.id ? d.mission : m));
                                    } else { alert(d.error); }
                                  } catch { alert('Network error'); }
                                }}
                                style={{ background: '#9333ea', border: 'none', color: 'white', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                              >
                                Claim →
                              </button>
                            )}
                            {isMineClaimed && <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✅ Yours</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!meetsRequirements && !alreadyApplied && (
                    <div style={{
                      background: '#f59e0b10', border: '1px solid #f59e0b30',
                      borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#f59e0b',
                    }}>
                      ⚠️ {failedReqs[0]}{failedReqs.length > 1 ? ` (+${failedReqs.length - 1} more)` : ''}
                    </div>
                  )}
                  <button
                    disabled={alreadyApplied || applyingId === mission.id}
                    onClick={() => applyToMission(mission)}
                    style={{
                      width: '100%', padding: '11px 0', borderRadius: 12, border: 'none',
                      background: alreadyApplied ? '#1a1a1a' : meetsRequirements ? '#9333ea' : '#7c3aed',
                      color: alreadyApplied ? '#666' : 'white',
                      fontWeight: 600, fontSize: 14,
                      cursor: alreadyApplied ? 'default' : 'pointer',
                      transition: 'all .2s',
                      opacity: alreadyApplied ? 0.6 : 1,
                    }}
                  >
                    {applyingId === mission.id ? 'Applying…' : alreadyApplied ? '✓ Applied' : meetsRequirements ? 'Apply Now' : 'Apply Anyway'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
