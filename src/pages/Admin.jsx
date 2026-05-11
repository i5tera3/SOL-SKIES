// src/pages/Admin.jsx
// No auth required — dev/testing tool
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/AdobSOL.png';
import DemoResetButton from '../components/DemoResetButton';
import { API_BASE } from '../lib/api';

function Admin() {
  const navigate = useNavigate();
  const [operators, setOperators] = useState([]);
  const [enterprises, setEnterprises] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('operators');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [opRes, entRes, dbRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/operators`),
        fetch(`${API_BASE}/api/admin/enterprises`),
        fetch(`${API_BASE}/api/debug/db`)
      ]);
      setOperators(await opRes.json());
      setEnterprises(await entRes.json());
      const dbData = await dbRes.json();
      setMissions(dbData.missions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const clearLocalSession = () => {
    localStorage.removeItem('solskies_session');
    localStorage.removeItem('solskies_user');
    flash('✅ Local session cleared — you are now logged out.');
  };

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const deleteOperator = async (id, name) => {
    try {
      await fetch(`${API_BASE}/api/operators/${id}`, { method: 'DELETE' });
      setOperators(prev => prev.filter(o => o.id !== id));
      flash(`✅ Deleted operator: ${name}`);
    } catch { flash('❌ Failed to delete operator'); }
    setConfirmDelete(null);
  };

  const deleteEnterprise = async (wallet, name) => {
    try {
      await fetch(`${API_BASE}/api/admin/enterprises/${wallet}`, { method: 'DELETE' });
      setEnterprises(prev => prev.filter(e => e.wallet_address !== wallet));
      flash(`✅ Deleted enterprise: ${name}`);
    } catch { flash('❌ Failed to delete enterprise'); }
    setConfirmDelete(null);
  };

  const clearAll = async () => {
    try {
      await fetch(`${API_BASE}/api/admin/clear-all`, { method: 'POST' });
      clearLocalSession();
      setOperators([]); setEnterprises([]); setMissions([]);
      flash('✅ All data cleared.');
    } catch { flash('❌ Failed to clear data'); }
    setConfirmDelete(null);
  };

  const styles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; font-family: 'Inter', sans-serif; color: white; }
    .admin-page { min-height: 100vh; background: #0a0a0a; padding: 30px; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 30px; }
    .header img { width: 40px; filter: brightness(0) invert(1); }
    .header h1 { font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #fff, #e9d5ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .header-right { margin-left: auto; display: flex; gap: 10px; align-items: center; }
    .flash { background: #22c55e15; border: 1px solid #22c55e; color: #22c55e; padding: 10px 16px; border-radius: 10px; font-size: 14px; margin-bottom: 20px; }
    .tabs { display: flex; gap: 6px; margin-bottom: 24px; }
    .tab { padding: 9px 20px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #333; background: #111; color: #888; transition: all .2s; }
    .tab.active { background: #9333ea20; border-color: #9333ea; color: #9333ea; }
    .card { background: #111; border: 1px solid #222; border-radius: 16px; overflow: hidden; margin-bottom: 12px; }
    .card-row { display: flex; align-items: center; padding: 16px 20px; gap: 16px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #9333ea, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: white; flex-shrink: 0; }
    .card-info { flex: 1; }
    .card-name { color: white; font-weight: 600; font-size: 15px; margin-bottom: 2px; }
    .card-sub { color: #666; font-size: 13px; font-family: monospace; }
    .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: #9333ea20; color: #9333ea; border: 1px solid #9333ea30; margin-right: 6px; }
    .del-btn { background: #ef444415; border: 1px solid #ef444440; color: #ef4444; border-radius: 8px; padding: 7px 14px; font-size: 13px; cursor: pointer; transition: all .2s; white-space: nowrap; }
    .del-btn:hover { background: #ef444425; border-color: #ef4444; }
    .btn { padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all .2s; }
    .btn-purple { background: #9333ea; color: white; }
    .btn-purple:hover { background: #a855f7; }
    .btn-red { background: #ef444420; color: #ef4444; border: 1px solid #ef444440; }
    .btn-red:hover { background: #ef444430; }
    .btn-gray { background: #1a1a1a; color: #888; border: 1px solid #333; }
    .btn-gray:hover { background: #222; color: white; }
    .empty { padding: 50px; text-align: center; color: #555; font-size: 15px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #111; border: 1px solid #333; border-radius: 20px; padding: 30px; max-width: 380px; width: 90%; text-align: center; }
    .modal h3 { color: white; margin-bottom: 10px; }
    .modal p { color: #888; font-size: 14px; margin-bottom: 24px; }
    .modal-btns { display: flex; gap: 10px; justify-content: center; }
    .section-label { color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding: 0 4px; }
    .danger-zone { background: #ef444408; border: 1px solid #ef444420; border-radius: 16px; padding: 20px; margin-top: 20px; }
    .danger-zone h3 { color: #ef4444; margin-bottom: 8px; font-size: 16px; }
    .danger-zone p { color: #888; font-size: 13px; margin-bottom: 16px; }
    .session-box { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
    .session-box span { color: #888; font-size: 13px; }
    .session-val { color: white; font-family: monospace; font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `;

  const session = (() => {
    try { return JSON.parse(localStorage.getItem('solskies_session')); } catch { return null; }
  })();

  return (
    <>
      <style>{styles}</style>
      <div className="admin-page">
        <div className="header">
          <img src={logo} alt="Sol Skies" />
          <h1>Sol Skies — Dev Panel</h1>
          <div className="header-right">
            <Link to="/" className="btn btn-gray">← Home</Link>
            <button className="btn btn-purple" onClick={fetchAll}>↻ Refresh</button>
          </div>
        </div>

        {message && <div className="flash">{message}</div>}

        {/* One-click demo seed (Phase 4) */}
        <div style={{ marginBottom: '24px' }}>
          <DemoResetButton onComplete={fetchAll} />
        </div>

        {/* Current session info */}
        <div className="section-label">Current Session</div>
        <div className="session-box">
          <span>Logged in as</span>
          <span className="session-val">
            {session ? `${session.user?.role} — ${session.user?.fullName || session.user?.companyName || 'unknown'}` : 'No active session'}
          </span>
          {session && <button className="del-btn" onClick={clearLocalSession}>Clear Session</button>}
        </div>

        {/* Tabs */}
        <div className="tabs">
          <div className={`tab ${activeTab === 'operators' ? 'active' : ''}`} onClick={() => setActiveTab('operators')}>
            Operators ({operators.length})
          </div>
          <div className={`tab ${activeTab === 'enterprises' ? 'active' : ''}`} onClick={() => setActiveTab('enterprises')}>
            Enterprises ({enterprises.length})
          </div>
          <div className={`tab ${activeTab === 'missions' ? 'active' : ''}`} onClick={() => setActiveTab('missions')}>
            Missions ({missions.length})
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <>
            {activeTab === 'operators' && (
              operators.length === 0 ? <div className="empty">No operators registered yet.</div> :
              operators.map(op => (
                <div className="card" key={op.id}>
                  <div className="card-row">
                    <div className="avatar">{op.full_name?.[0] || 'O'}</div>
                    <div className="card-info">
                      <div className="card-name">{op.full_name} <span style={{ color: '#888', fontWeight: 400 }}>@{op.username}</span></div>
                      <div className="card-sub">{op.wallet_address}</div>
                      <div style={{ marginTop: 6 }}>
                        {op.region && <span className="badge">{op.region}</span>}
                        {op.drone_model && <span className="badge">{op.drone_model}</span>}
                        {op.experience && <span className="badge">{op.experience}</span>}
                      </div>
                    </div>
                    <button className="del-btn" onClick={() => setConfirmDelete({ type: 'operator', id: op.id, name: op.full_name })}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}

            {activeTab === 'enterprises' && (
              enterprises.length === 0 ? <div className="empty">No enterprises registered yet.</div> :
              enterprises.map(ent => (
                <div className="card" key={ent.id}>
                  <div className="card-row">
                    <div className="avatar">🏢</div>
                    <div className="card-info">
                      <div className="card-name">{ent.company_name}</div>
                      <div className="card-sub">{ent.wallet_address}</div>
                      <div style={{ marginTop: 6 }}>
                        {ent.industry && <span className="badge">{ent.industry}</span>}
                        {ent.operating_regions && <span className="badge">{ent.operating_regions}</span>}
                        <span className="badge" style={{ color: '#22c55e', borderColor: '#22c55e30', background: '#22c55e10' }}>
                          {ent.usdc_balance || 0} USDC
                        </span>
                      </div>
                    </div>
                    <button className="del-btn" onClick={() => setConfirmDelete({ type: 'enterprise', wallet: ent.wallet_address, name: ent.company_name })}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}

            {activeTab === 'missions' && (
              missions.length === 0 ? <div className="empty">No missions created yet.</div> :
              missions.map(m => (
                <div className="card" key={m.id}>
                  <div className="card-row">
                    <div className="avatar">✈️</div>
                    <div className="card-info">
                      <div className="card-name">{m.title}</div>
                      <div className="card-sub">{m.region} · {m.reward} USDC · {m.status}</div>
                    </div>
                    <span className="badge" style={{
                      color: m.status === 'open' ? '#22c55e' : '#f59e0b',
                      background: m.status === 'open' ? '#22c55e10' : '#f59e0b10',
                      borderColor: m.status === 'open' ? '#22c55e30' : '#f59e0b30'
                    }}>{m.status}</span>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Danger zone */}
        <div className="danger-zone">
          <h3>⚠ Danger Zone</h3>
          <p>These actions are permanent and cannot be undone. Use for testing only.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-red" onClick={() => setConfirmDelete({ type: 'all' })}>
              🗑 Clear All Data
            </button>
            <button className="btn btn-gray" onClick={clearLocalSession}>
              🔓 Clear My Session (Logout)
            </button>
          </div>
        </div>

        {/* Confirm modal */}
        {confirmDelete && (
          <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>Are you sure?</h3>
              <p>
                {confirmDelete.type === 'all'
                  ? 'This will delete ALL operators, enterprises, missions, contracts, and messages.'
                  : `Delete ${confirmDelete.type}: "${confirmDelete.name}"? This cannot be undone.`}
              </p>
              <div className="modal-btns">
                <button className="btn btn-gray" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button className="btn btn-red" onClick={() => {
                  if (confirmDelete.type === 'all') clearAll();
                  else if (confirmDelete.type === 'operator') deleteOperator(confirmDelete.id, confirmDelete.name);
                  else deleteEnterprise(confirmDelete.wallet, confirmDelete.name);
                }}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Admin;
