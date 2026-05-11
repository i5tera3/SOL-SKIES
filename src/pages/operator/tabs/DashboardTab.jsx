// src/pages/operator/tabs/DashboardTab.jsx
// Operator dashboard "overview" tab — profile card, earnings card, drone card,
// and active contracts grid.
//
// Receives `ctx` (the parent's relevant state + handlers) rather than 11
// individual props. The parent stays the source of truth; this is a pure
// render component.

export default function DashboardTab({ ctx }) {
  const {
    contracts,
    operatorData,
    positiveFeedback,
    handleProfileImageUpload,
    uploadingImage,
    setShowWithdrawModal,
    getStatusColor,
    setSelectedContractDetail,
    updateContractProgress,
    setDisputeFor,
    fetchMissions,
  } = ctx;

  const activeContracts = contracts.filter(c => c.status === 'active' || c.status === 'open');

  return (
    <>
      <div className="profile-grid">
        <div className="card">
          <div className="profile-header">
            <div className="profile-image-container">
              {operatorData?.profile_image ? (
                <img
                  src={operatorData.profile_image}
                  alt="Profile"
                  className="profile-image-img"
                />
              ) : (
                <div className="profile-image">
                  {operatorData?.full_name?.charAt(0) || 'U'}
                </div>
              )}
              <label htmlFor="profile-upload" className="profile-upload-label">
                📷
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageUpload}
                  style={{ display: 'none' }}
                  disabled={uploadingImage}
                />
              </label>
            </div>
            <div className="profile-info">
              <h2>{operatorData?.full_name || 'Operator'}</h2>
              <div className="username">@{operatorData?.username || 'username'}</div>
              <div className="rating-badge">
                <span>★</span> {operatorData?.rating != null ? operatorData.rating.toFixed(1) : 'No ratings yet'} ({operatorData?.completed_missions || 0} missions)
              </div>
            </div>
          </div>

          <div className="feedback-section">
            <div className="feedback-label">
              <span>Positive Feedback</span>
              <span className="feedback-percentage">{positiveFeedback}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${positiveFeedback}%` }}></div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{operatorData?.completed_missions || 0}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{(operatorData?.total_missions - operatorData?.completed_missions) || 0}</div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{operatorData?.member_since ? new Date(operatorData.member_since).getFullYear() : '2025'}</div>
              <div className="stat-label">Member Since</div>
            </div>
          </div>
        </div>

        {/* ── Earnings Card ─────────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ color: 'white', fontSize: 18 }}>💰 Earnings</h2>
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!operatorData?.total_earned || operatorData.total_earned <= 0}
              style={{
                background: operatorData?.total_earned > 0 ? '#9333ea' : '#222',
                border: 'none', borderRadius: 20, padding: '8px 18px',
                color: operatorData?.total_earned > 0 ? 'white' : '#555',
                fontSize: 13, fontWeight: 600,
                cursor: operatorData?.total_earned > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Withdraw
            </button>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, background: '#1a1a1a', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ color: '#22c55e', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                {(operatorData?.total_earned || 0).toFixed(2)} USDC
              </div>
              <div style={{ color: '#888', fontSize: 12 }}>Total Earned</div>
            </div>
            <div style={{ flex: 1, background: '#1a1a1a', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ color: '#a855f7', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                {operatorData?.completed_missions || 0}
              </div>
              <div style={{ color: '#888', fontSize: 12 }}>Paid Missions</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ color: 'white', marginBottom: '15px' }}>{operatorData?.drone_model || 'Drone Model'}</h2>
          <div className="drone-image">
            {operatorData?.drone_image ? (
              <img src={operatorData.drone_image} alt="Drone" />
            ) : (
              <span>📸 No drone image uploaded</span>
            )}
          </div>

          <div className="drone-specs">
            <div className="spec-item">
              <div className="spec-label">Flight Stack</div>
              <div className="spec-value">{operatorData?.flight_stack || 'ArduPilot'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Autopilot</div>
              <div className="spec-value">{operatorData?.autopilot_hardware || 'Pixhawk'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Vehicle Type</div>
              <div className="spec-value">{operatorData?.vehicle_type || 'Multicopter'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Firmware</div>
              <div className="spec-value">{operatorData?.firmware_version || '4.5.1'}</div>
            </div>
          </div>

          <div className="verify-badge">
            <span>✅</span> Verified on Solana
          </div>
        </div>
      </div>

      <div>
        <h2 className="section-title">Active Contracts</h2>
        {activeContracts.length > 0 ? (
          <div className="contracts-grid">
            {activeContracts.map(contract => (
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
                <div className="contract-progress">
                  <div className="progress-header">
                    <span>Progress</span>
                    <span>{contract.progress || 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${contract.progress || 0}%` }}></div>
                  </div>
                </div>
                <div className="contract-actions">
                  <button className="action-btn" onClick={() => setSelectedContractDetail(contract)}>View Details</button>
                  <button className="action-btn primary" onClick={() => {
                    const p = prompt(`Update progress for "${contract.title}" (current: ${contract.progress || 0}%):`, contract.progress || 0);
                    if (p !== null && !isNaN(parseInt(p))) {
                      const val = Math.min(100, Math.max(0, parseInt(p)));
                      updateContractProgress(contract.id, val, val === 100);
                    }
                  }}>Update Status</button>
                  <button
                    className="action-btn"
                    onClick={() => setDisputeFor(contract.id)}
                    style={{ borderColor: '#4a1d1d', color: '#fca5a5' }}
                  >⚠ Dispute</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: '#111111',
            borderRadius: '20px',
            padding: '60px',
            textAlign: 'center',
            border: '1px solid #222',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📭</div>
            <h3 style={{ color: 'white', marginBottom: '10px' }}>No Active Contracts</h3>
            <p style={{ color: '#888', fontSize: '16px', marginBottom: '20px' }}>
              You don't have any active contracts yet.<br />
              Apply to open missions to get started.
            </p>
            <button
              onClick={fetchMissions}
              style={{ background: '#9333ea', border: 'none', color: 'white', padding: '12px 28px', borderRadius: '30px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
            >
              Load Available Missions →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
