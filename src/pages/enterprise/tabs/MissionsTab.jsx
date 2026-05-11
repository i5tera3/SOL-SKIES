// src/pages/enterprise/tabs/MissionsTab.jsx
// All missions (active + open + completed) with state pills and risk badges.

import { useNavigate } from 'react-router-dom';
import MissionStatePill from '../../../components/MissionStatePill';
import RiskBadge from '../../../components/RiskBadge';

export default function MissionsTab({ ctx }) {
  const { missions } = ctx;
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="section-title">All Missions</h2>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="🔍 Search missions..."
          className="search-input"
        />
        <select className="filter-select">
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="completed">Completed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {missions.length > 0 ? (
        <div className="missions-grid">
          {missions.map(mission => (
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
                  <span className="detail-label">📅 Created</span>
                  <span className="detail-value">
                    {new Date(mission.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="mission-actions">
                <button className="action-btn" onClick={() => navigate(`/missions/${mission.id}`)}>View Details</button>
                {mission.status === 'open' && (
                  <button className="action-btn primary" onClick={() => navigate(`/missions/${mission.id}`)}>Edit</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No Missions Yet</h3>
          <p>Create your first mission to get started</p>
        </div>
      )}
    </div>
  );
}
