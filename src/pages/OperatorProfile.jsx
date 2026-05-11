import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../Context/sessionContext';
import ReputationCard from '../components/ReputationCard';
import ExperienceTimeline from '../components/ExperienceTimeline';
import ContactOperatorButton from '../components/ContactOperatorButton';
import BioEditor from '../components/BioEditor';
import { API_BASE } from '../lib/api';

export default function OperatorProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const [operator, setOperator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!username) {
      setError('Username not provided');
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/profiles/operator/username/${username}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError('Operator not found');
        } else {
          setOperator(data);
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load operator profile');
        setLoading(false);
      });
  }, [username]);

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

  if (error || !operator) {
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

  const initials = operator.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'OP';

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
            {/* Avatar */}
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #9333ea, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              fontWeight: '700',
              color: '#fff',
              border: '2px solid #9333ea',
              flexShrink: 0
            }}>
              {initials}
            </div>

            {/* Name & Info */}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>
                {operator.full_name}
              </h1>
              <p style={{ color: '#888', fontSize: '16px', marginBottom: '12px' }}>
                @{operator.username}
              </p>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {operator.license_status === 'verified' && (
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
                    ✅ License Verified
                  </span>
                )}
                {operator.license_status === 'pending' && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#f59e0b20',
                    border: '1px solid #f59e0b40',
                    borderRadius: '6px',
                    color: '#f59e0b',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    ⏳ Verification Pending
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {/* In-app chat — only renders when the viewer is an enterprise */}
                <ContactOperatorButton
                  operatorId={operator.id}
                  operatorName={operator.full_name}
                />
                <button
                  onClick={() => {
                    const subject = `Contact with ${operator.full_name}`;
                    const body = `Hi ${operator.full_name},\n\nI'm interested in your services. Please get back to me at your earliest convenience.\n\nThanks`;
                    window.location.href = `mailto:${operator.email || 'support@solskies.com'}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1px solid #333',
                    color: '#aaa',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                  }}
                >
                  ✉️ Email
                </button>
              </div>
            </div>

            {/* Rating */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#fbbf24'
              }}>
                ⭐ {operator.rating ? operator.rating.toFixed(1) : 'N/A'}
              </div>
              <p style={{ color: '#888', fontSize: '13px', marginTop: '8px' }}>
                Rating
              </p>
            </div>
          </div>

          {/* Bio */}
          {operator.bio ? (
            <div style={{
              padding: '16px',
              background: '#1a1a1a',
              borderRadius: '8px',
              color: '#aaa',
              borderLeft: '3px solid #9333ea',
              marginBottom: 10,
            }}>
              {operator.bio}
            </div>
          ) : (user?.role === 'operator' && user?.id === operator.id) ? (
            <div style={{ color: '#666', fontSize: 13, marginBottom: 10, fontStyle: 'italic' }}>
              No bio yet — enterprises judge profiles partly on this. Add a short one ↓
            </div>
          ) : null}

          {/* Owner-only inline bio editor */}
          {user?.role === 'operator' && user?.id === operator.id && (
            <BioEditor
              kind="operator"
              ownerId={operator.id}
              initialBio={operator.bio}
              onSaved={(updated) => setOperator(prev => ({ ...prev, bio: updated.bio }))}
            />
          )}
        </div>

        {/* Reputation breakdown — Phase 4 */}
        <div style={{ marginBottom: '40px' }}>
          <ReputationCard operatorId={operator.id} />
        </div>

        {/* Work history — "LinkedIn for drones" timeline */}
        <div style={{ marginBottom: '40px' }}>
          <ExperienceTimeline
            operatorId={operator.id}
            canEdit={user?.role === 'operator' && user?.id === operator.id}
          />
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {[
            { label: 'Total Missions', value: operator.total_missions || 0, icon: '🎯' },
            { label: 'Completed', value: operator.completed_missions || 0, icon: '✅' },
            { label: 'Total Earned', value: `${(operator.total_earned || 0).toFixed(2)} SOL`, icon: '💰' },
            { label: 'Flight Hours', value: operator.flight_hours || 0, icon: '✈️' }
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

        {/* Certifications */}
        {operator.certifications && operator.certifications.length > 0 && (
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '40px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
              Certifications
            </h2>
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {operator.certifications.map((cert, i) => (
                <span
                  key={i}
                  style={{
                    padding: '8px 16px',
                    background: '#9333ea20',
                    border: '1px solid #9333ea40',
                    borderRadius: '20px',
                    color: '#c084fc',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Drone Fleet */}
        {operator.drone_fleet && operator.drone_fleet.length > 0 && (
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '40px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
              Drone Fleet
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              {operator.drone_fleet.map((drone, i) => (
                <div
                  key={i}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚁</div>
                  <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                    {drone.model || 'Drone'}
                  </div>
                  {drone.specs && (
                    <p style={{ color: '#888', fontSize: '12px' }}>
                      {drone.specs}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Area */}
        {operator.region && (
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '40px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
              Service Area
            </h2>
            <p style={{ color: '#aaa', fontSize: '16px' }}>
              📍 {operator.region}
            </p>
          </div>
        )}

        {/* Member Since */}
        <div style={{
          background: '#111',
          border: '1px solid #222',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
          color: '#888'
        }}>
          <p>
            Member since {formatDate(operator.member_since)}
          </p>
        </div>
      </div>
    </div>
  );
}
