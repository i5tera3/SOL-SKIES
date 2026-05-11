import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../Context/sessionContext';
import WeatherWidget from '../components/WeatherWidget';
import MapView from '../components/MapView';
import MissionStatePill from '../components/MissionStatePill';
import RiskBadge from '../components/RiskBadge';
import EligibilityBadge from '../components/EligibilityBadge';
import SlotGrid from '../components/SlotGrid';
import AuditTimeline from '../components/AuditTimeline';
import AirspaceBadge from '../components/AirspaceBadge';
import { API_BASE } from '../lib/api';

export default function MissionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const [mission, setMission] = useState(null);
  const [enterprise, setEnterprise] = useState(null);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Mission ID not provided');
      setLoading(false);
      return;
    }

    // Fetch mission
    fetch(`${API_BASE}/api/missions/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError('Mission not found');
        } else {
          setMission(data);
          // Fetch enterprise profile
          return fetch(`${API_BASE}/api/enterprises/${data.enterprise_id}`);
        }
      })
      .then(r => r?.json())
      .then(data => {
        if (data && !data.error) {
          setEnterprise(data);
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load mission details');
        setLoading(false);
      });
  }, [id]);

  // Check if already applied
  useEffect(() => {
    if (!user || user.role !== 'operator' || !id) return;
    fetch(`${API_BASE}/api/operators/${user.id}/applications`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setApplied(data.some(app => app.mission_id === id));
        }
      })
      .catch(() => {});
  }, [user, id]);

  const handleApply = async () => {
    if (!user || user.role !== 'operator') {
      navigate('/');
      return;
    }

    setApplying(true);
    try {
      const response = await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission_id: id,
          operator_id: user.id,
          operator_name: user.fullName,
          operator_username: user.username
        })
      });
      const data = await response.json();
      if (!data.error) {
        setApplied(true);
        alert('Application submitted successfully!');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Failed to submit application');
    } finally {
      setApplying(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Mission link copied to clipboard!');
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff'
      }}>
        Loading mission details...
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ marginBottom: '20px' }}>Mission Not Found</h1>
          <p>{error}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: '20px',
              padding: '10px 24px',
              background: '#9333ea',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          marginBottom: '30px'
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px' }}>
              {mission.title}
            </h1>
            <p style={{ color: '#888', fontSize: '16px' }}>
              {mission.description}
            </p>
          </div>
          <button
            onClick={handleShare}
            style={{
              padding: '10px 16px',
              background: '#222',
              border: '1px solid #333',
              color: '#888',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Share
          </button>
        </div>

        {/* Main Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '30px',
          marginBottom: '40px'
        }}>
          {/* Left: Details & Map */}
          <div>
            {/* Info Cards */}
            <div style={{
              background: '#111',
              border: '1px solid #222',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px'
              }}>
                <div>
                  <p style={{ color: '#888', fontSize: '13px', marginBottom: '6px' }}>
                    Budget
                  </p>
                  <p style={{ fontSize: '24px', fontWeight: '700' }}>
                    💰 {mission.reward || mission.budget_usdc || 0} SOL
                  </p>
                </div>
                <div>
                  <p style={{ color: '#888', fontSize: '13px', marginBottom: '6px' }}>
                    Status
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <MissionStatePill state={mission.status || 'open'} />
                    <RiskBadge missionId={mission.id} compact />
                    {user?.role === 'operator' && (
                      <EligibilityBadge missionId={mission.id} compact />
                    )}
                  </div>
                </div>
                {mission.start_date && mission.end_date && (
                  <>
                    <div>
                      <p style={{ color: '#888', fontSize: '13px', marginBottom: '6px' }}>
                        Start Date
                      </p>
                      <p style={{ fontSize: '16px', fontWeight: '500' }}>
                        {mission.start_date}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: '#888', fontSize: '13px', marginBottom: '6px' }}>
                        End Date
                      </p>
                      <p style={{ fontSize: '16px', fontWeight: '500' }}>
                        {mission.end_date}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Multi-operator slot grid (only renders when mission has slots) */}
            <SlotGrid missionId={mission.id} currentUser={user} />

            {/* Airspace authorization (LAANC mock) */}
            {mission.latitude && mission.longitude && (
              <div style={{ marginBottom: '20px', marginTop: '20px' }}>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                  🛡 Airspace authorization
                </p>
                <AirspaceBadge lat={mission.latitude} lng={mission.longitude} />
              </div>
            )}

            {/* Map */}
            {mission.latitude && mission.longitude && (
              <div style={{ marginBottom: '20px', marginTop: '20px' }}>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                  📍 Location
                </p>
                <MapView lat={mission.latitude} lng={mission.longitude} height={300} />
              </div>
            )}

            {/* Audit timeline */}
            <div style={{ marginTop: '20px' }}>
              <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                📜 Activity timeline
              </p>
              <div style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: '16px',
                padding: '20px',
              }}>
                <AuditTimeline entityType="mission" entityId={mission.id} />
              </div>
            </div>

            {/* Weather */}
            {mission.latitude && mission.longitude && (
              <div>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                  🌤️ Forecast
                </p>
                <WeatherWidget
                  lat={mission.latitude}
                  lng={mission.longitude}
                  startDate={mission.start_date}
                  endDate={mission.end_date}
                />
              </div>
            )}
          </div>

          {/* Right: Enterprise & Apply */}
          <div>
            {/* Enterprise Card */}
            {enterprise && (
              <div
                onClick={() => {
                  const slug = enterprise.company_slug || enterprise.company_name?.toLowerCase().replace(/\s+/g, '-') || '';
                  navigate(`/enterprise/${slug}`);
                }}
                style={{
                  background: '#111',
                  border: '1px solid #222',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#9333ea';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(147,51,234,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#222';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#fff',
                  marginBottom: '12px'
                }}>
                  {enterprise.company_name?.charAt(0).toUpperCase()}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                  {enterprise.company_name}
                </h3>
                <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                  {enterprise.industry || 'Enterprise'}
                </p>
                {enterprise.business_verified && (
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    background: '#22c55e20',
                    color: '#22c55e',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    ✅ Verified
                  </span>
                )}
              </div>
            )}

            {/* Apply Button */}
            {user && user.role === 'operator' && (
              <button
                onClick={handleApply}
                disabled={applied || applying}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: applied ? '#333' : '#9333ea',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  cursor: applied ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '16px',
                  marginBottom: '12px',
                  opacity: applied ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {applying ? 'Applying...' : applied ? 'Already Applied' : 'Apply Now'}
              </button>
            )}

            {!user && (
              <button
                onClick={() => navigate('/')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: '#9333ea',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '16px',
                  marginBottom: '12px'
                }}
              >
                Log In to Apply
              </button>
            )}

            {user && user.role !== 'operator' && (
              <div style={{
                padding: '16px',
                background: '#333',
                borderRadius: '8px',
                color: '#aaa',
                fontSize: '14px',
                marginBottom: '12px'
              }}>
                Only operators can apply to missions
              </div>
            )}

            {/* Requirements */}
            {mission.requirements && Object.keys(mission.requirements).length > 0 && (
              <div style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: '16px',
                padding: '24px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
                  Requirements
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {mission.requirements.certifications && (
                    <div>
                      <p style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                        Certifications
                      </p>
                      {mission.requirements.certifications.map((cert, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            background: '#9333ea20',
                            color: '#c084fc',
                            borderRadius: '4px',
                            fontSize: '12px',
                            marginRight: '8px',
                            marginBottom: '4px'
                          }}
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
