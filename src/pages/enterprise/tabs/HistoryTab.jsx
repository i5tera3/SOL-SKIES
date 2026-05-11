// src/pages/enterprise/tabs/HistoryTab.jsx
// Completed mission archive.

import { useNavigate } from 'react-router-dom';
import MissionStatePill from '../../../components/MissionStatePill';

export default function HistoryTab({ ctx }) {
  const { completedMissions } = ctx;
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="section-title">Mission History</h2>
      {completedMissions.length > 0 ? (
        <div className="missions-grid">
          {completedMissions.map(mission => (
            <div key={mission.id} className="mission-card completed">
              <div className="mission-header">
                <h3>{mission.title}</h3>
                <MissionStatePill state={mission.status} size="sm" />
              </div>
              <div className="mission-type">{mission.missionType}</div>
              <div className="mission-details">
                <div className="detail-item">
                  <span className="detail-label">👤 Operator</span>
                  <span className="detail-value">{mission.operator_name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">💰 Paid</span>
                  <span className="detail-value">{mission.reward} SOL{mission.escrow_tx && <a href={`https://explorer.solana.com/tx/${mission.escrow_tx}?cluster=devnet`} target="_blank" rel="noopener noreferrer" style={{marginLeft:6,fontSize:10,color:'#9333ea'}}>🔗 Escrow tx</a>}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">📅 Completed</span>
                  <span className="detail-value">
                    {new Date(mission.completed_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="mission-actions">
                <button className="action-btn" onClick={() => navigate(`/missions/${mission.id}`)}>View Report</button>
                {mission.operator_username && (
                  <button className="action-btn" onClick={() => navigate(`/operator/${mission.operator_username}`)}>View Operator</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📜</div>
          <h3>No Mission History</h3>
          <p>Completed missions will appear here</p>
        </div>
      )}
    </div>
  );
}
