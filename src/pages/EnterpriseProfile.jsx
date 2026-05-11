import { API_BASE } from '../lib/api';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../Context/sessionContext';
import BioEditor from '../components/BioEditor';

export default function EnterpriseProfile() {
  const { companySlug } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const [enterprise, setEnterprise] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!companySlug) {
      setError('Company slug not provided');
      setLoading(false);
      return;
    }

    // Fetch enterprise profile
    fetch(`${API_BASE}/api/profiles/enterprise/name/${companySlug}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError('Enterprise not found');
        } else {
          setEnterprise(data);
          // Fetch missions for this enterprise
          return fetch(`${API_BASE}/api/missions?enterprise_id=${data.id}&status=open`);
        }
      })
      .then(r => r?.json())
      .then(data => {
        if (data && !data.error) {
          setMissions(data);
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load enterprise profile');
        setLoading(false);
      });
  }, [companySlug]);

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
        Loading profile...
      </div>
    );
  }

  if (error || !enterprise) {
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
          <h1 style={{ marginBottom: '20px' }}>Profile Not Found</h1>
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

  const initials = enterprise.company_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'EN';

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          background: '#111',
          border: '1px solid #222',
          borderRadius: '16px',
          padding: '40px',
          marginBottom: '40px'
        }}>
          <div style={{
            display: 'flex',
            gap: '30px',
            alignItems: 'start',
            marginBottom: '30px'
          }}>
            {/* Logo */}
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              fontWeight: '700',
              color: '#fff',
              border: '2px solid #a855f7',
              flexShrink: 0
            }}>
              {initials}
            </div>

            {/* Name & Info */}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>
                {enterprise.company_name}
              </h1>
              {enterprise.industry && (
                <p style={{ color: '#888', fontSize: '16px', marginBottom: '12px' }}>
                  {enterprise.industry}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {enterprise.business_verified && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#22c55e20',
                    border: '1px solid #22c55e40',
                    borderRadius: '6px',
                    color: '#22c55e',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    ✅ Verified Business
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  const subject = `Contact with ${enterprise.company_name}`;
                  const body = `Hi ${enterprise.company_name} team,\n\nI'm interested in working with your organization. Please get back to me at your earliest convenience.\n\nThanks`;
                  window.location.href = `mailto:${enterprise.email || 'support@solskies.com'}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
                style={{
                  padding: '10px 20px',
                  background: '#9333ea',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#a855f7';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#9333ea';
                }}
              >
                ✉️ Contact
              </button>
            </div>

            {/* Member Since */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#9333ea',
                marginBottom: '8px'
              }}>
                {formatDate(enterprise.created_at)}
              </div>
              <p style={{ color: '#888', fontSize: '13px' }}>
                Member Since
              </p>
            </div>
          </div>

          {/* Bio */}
          {enterprise.bio ? (
            <div style={{
              padding: '16px',
              background: '#1a1a1a',
              borderRadius: '8px',
              color: '#aaa',
              borderLeft: '3px solid #9333ea',
              marginBottom: '16px'
            }}>
              {enterprise.bio}
            </div>
          ) : (user?.role === 'enterprise' && user?.id === enterprise.id) ? (
            <div style={{ color: '#666', fontSize: 13, marginBottom: 10, fontStyle: 'italic' }}>
              No bio yet — operators evaluate enterprises partly on this. Add a short one ↓
            </div>
          ) : null}

          {/* Owner-only inline bio editor */}
          {user?.role === 'enterprise' && user?.id === enterprise.id && (
            <div style={{ marginBottom: 16 }}>
              <BioEditor
                kind="enterprise"
                ownerId={enterprise.id}
                initialBio={enterprise.bio}
                onSaved={(updated) => setEnterprise(prev => ({ ...prev, bio: updated.bio }))}
              />
            </div>
          )}

          {/* Description */}
          {enterprise.description && (
            <div style={{
              padding: '16px',
              background: '#1a1a1a',
              borderRadius: '8px',
              color: '#aaa'
            }}>
              {enterprise.description}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {[
            { label: 'Missions Posted', value: enterprise.total_missions_posted || 0, icon: '📋' },
            { label: 'Completed', value: enterprise.total_missions_completed || 0, icon: '✅' },
            { label: 'Operating Regions', value: enterprise.operating_regions || 'N/A', icon: '🌍' }
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                {stat.icon}
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                {stat.value}
              </div>
              <div style={{ color: '#888', fontSize: '13px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Website */}
        {enterprise.website && (
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '40px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>
              Website
            </h2>
            <a
              href={enterprise.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#9333ea',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              {enterprise.website}
            </a>
          </div>
        )}

        {/* Active Missions */}
        {missions.length > 0 && (
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
              Active Missions ({missions.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {missions.map((mission) => (
                <div
                  key={mission.id}
                  onClick={() => window.location.href = `/missions/${mission.id}`}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#9333ea';
                    e.currentTarget.style.background = '#222';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.background = '#1a1a1a';
                  }}
                >
                  <h3 style={{ fontWeight: '600', marginBottom: '8px' }}>
                    {mission.title}
                  </h3>
                  <p style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                    {mission.description?.substring(0, 100)}...
                  </p>
                  <div style={{
                    display: 'flex',
                    gap: '20px',
                    fontSize: '13px',
                    color: '#aaa'
                  }}>
                    <span>📍 {mission.region}</span>
                    <span>💰 {mission.reward} SOL</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {missions.length === 0 && (
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            color: '#888'
          }}>
            <p>No active missions at this time</p>
          </div>
        )}
      </div>
    </div>
  );
}
