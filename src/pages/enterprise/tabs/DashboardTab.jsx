// src/pages/enterprise/tabs/DashboardTab.jsx
// Enterprise dashboard "overview" — wallet card, stat cards, active contracts
// (with progress slider + rate + dispute), and active missions grid.

import MissionStatePill from '../../../components/MissionStatePill';
import RiskBadge from '../../../components/RiskBadge';

export default function DashboardTab({ ctx }) {
  const {
    balance, refreshWalletBalance, solPrice,
    publicKey, maskWalletAddress,
    missions, activeMissions, completedMissions,
    setShowCreateMissionModal,
    activeContracts, updateContractProgress,
    openRatingModal, setDisputeFor,
    fetchApplicants,
  } = ctx;

  return (
    <>
      {/* Wallet Section */}
      <div className="wallet-section">
        <div className="wallet-card-large">
          <div className="wallet-header">
            <h3>💰 Wallet Balance</h3>
            <button
              className="primary-btn small"
              onClick={refreshWalletBalance}
              title="Refresh balance"
            >
              ↻ Refresh
            </button>
          </div>
          <div className="balance-display">
            <span className="balance-label">SOL Balance (Devnet)</span>
            <span className="balance-amount">{balance.toFixed(4)} SOL</span>
          </div>
          {solPrice && (
            <div style={{ color: '#9333ea', fontSize: 14, marginBottom: 8 }}>
              ≈ {(balance * solPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} USD
            </div>
          )}
          {!solPrice && (
            <div style={{ color: '#555', fontSize: 12 }}>Fetching USD price…</div>
          )}
          <div className="wallet-address-info">
            <span>Wallet: {maskWalletAddress(publicKey?.toBase58())}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{missions.length}</div>
            <div className="stat-label">Total Missions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{activeMissions.length}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{completedMissions.length}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{balance.toFixed(3)}</div>
            <div className="stat-label">SOL Balance{solPrice ? ` ≈ ${(balance * solPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}` : ''}</div>
          </div>
        </div>
      </div>

      {/* Create Mission Button */}
      <div style={{ margin: '30px 0' }}>
        <button
          className="primary-btn large"
          onClick={() => setShowCreateMissionModal(true)}
        >
          ✈️ Create New Mission
        </button>
      </div>

      {/* ── Active Contracts Section ────────────────────────────────────────── */}
      {activeContracts.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2 className="section-title">🤝 Active Contracts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeContracts.map(contract => (
              <div key={contract.id} style={{
                background: '#111', border: '1px solid #222', borderRadius: 20,
                padding: 24,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>{contract.title}</div>
                    <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                      Operator: <span style={{ color: '#9333ea' }}>
                        {contract.operator_name || 'Operator'}{contract.operator_username ? ` (@${contract.operator_username})` : ''}
                      </span>
                      {contract.region && <> · 📍 {contract.region}</>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 16 }}>
                      {contract.amount_sol} SOL{solPrice ? ` ≈ ${(contract.amount_sol * solPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}` : ''}
                    </div>
                    <div style={{ color: '#555', fontSize: 12 }}>In Escrow</div>
                  </div>
                </div>

                {/* Progress slider */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#888', fontSize: 13 }}>Mission Progress</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>{contract.progress || 0}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={contract.progress || 0}
                      onChange={e => updateContractProgress(contract.id, e.target.value)}
                      style={{ flex: 1, accentColor: '#9333ea', cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ height: 6, background: '#222', borderRadius: 3, marginTop: 8 }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${contract.progress || 0}%`,
                      background: (contract.progress || 0) >= 100
                        ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                        : 'linear-gradient(90deg,#9333ea,#a855f7)',
                      transition: 'width .3s ease',
                    }} />
                  </div>
                </div>

                {(contract.progress || 0) >= 100 ? (
                  <button
                    onClick={() => openRatingModal(contract)}
                    style={{
                      width: '100%', padding: '12px 0',
                      background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                      border: 'none', borderRadius: 12, color: 'white',
                      fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    }}
                  >
                    ✓ Complete & Rate Operator
                  </button>
                ) : (
                  <div style={{ color: '#555', fontSize: 12, textAlign: 'center', paddingTop: 4 }}>
                    Drag slider to 100% to complete this contract
                  </div>
                )}

                <button
                  onClick={() => setDisputeFor(contract.id)}
                  style={{
                    width: '100%', padding: '8px 0', marginTop: 8,
                    background: 'transparent',
                    border: '1px solid #4a1d1d', borderRadius: 12, color: '#fca5a5',
                    fontWeight: 500, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  ⚠ Raise dispute
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Missions Section */}
      <div className="missions-section">
        <h2 className="section-title">Active Missions</h2>
        {activeMissions.length > 0 ? (
          <div className="missions-grid">
            {activeMissions.map(mission => (
              <div key={mission.id} className="mission-card">
                <div className="mission-header">
                  <h3>{mission.title}</h3>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <MissionStatePill state={mission.status} size="sm" />
                    <RiskBadge missionId={mission.id} compact />
                  </div>
                </div>
                <div className="mission-type">{mission.missionType}</div>
                <div className="mission-details">
                  <div className="detail-item">
                    <span className="detail-label">📍 Region</span>
                    <span className="detail-value">{mission.region}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">💰 Reward</span>
                    <span className="detail-value">{mission.reward} SOL{mission.escrow_tx && <a href={`https://explorer.solana.com/tx/${mission.escrow_tx}?cluster=devnet`} target="_blank" rel="noopener noreferrer" style={{marginLeft:6,fontSize:10,color:'#9333ea'}}>🔗 Escrow tx</a>}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">📋 Requirements</span>
                    <span className="detail-value">
                      {mission.requirements?.minFlightHours}h min •
                      {mission.requirements?.droneType}
                    </span>
                  </div>
                </div>
                <div className="mission-actions">
                  <button className="action-btn" onClick={() => fetchApplicants(mission)}>View Applicants</button>
                  <button className="action-btn primary" onClick={() => setShowCreateMissionModal(true)}>+ New Mission</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No Active Missions</h3>
            <p>Create your first mission to get started</p>
          </div>
        )}
      </div>
    </>
  );
}
