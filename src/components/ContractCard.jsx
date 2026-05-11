import { API_BASE } from '../lib/api';
import { useState, useEffect } from 'react';

export default function ContractCard({
  mission,
  operatorData,
  onApply,
  onViewDetails,
  onViewEnterprise,
  isApplied,
  isApplying
}) {
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  useEffect(() => {
    if (!mission.latitude || !mission.longitude) return;
    setLoadingWeather(true);
    fetch(`${API_BASE}/api/weather?lat=${mission.latitude}&lng=${mission.longitude}`)
      .then(r => r.json())
      .then(data => {
        const today = data.daily?.[0];
        setWeather(today);
        setLoadingWeather(false);
      })
      .catch(() => setLoadingWeather(false));
  }, [mission.latitude, mission.longitude]);

  const checkQualifications = () => {
    if (!mission.requirements || !operatorData) return null;
    const required = mission.requirements.certifications || [];
    if (required.length === 0) return 'qualified';

    const operatorCerts = operatorData.certifications || [];
    const missing = required.filter(cert => !operatorCerts.includes(cert));
    if (missing.length === 0) return 'qualified';
    return missing;
  };

  const qualifications = checkQualifications();
  const isQualified = qualifications === 'qualified' || qualifications === null;

  const flyableEmoji = weather?.flyable === 'good' ? '☀️' : weather?.flyable === 'caution' ? '⚠️' : '🚫';
  const flyableColor = weather?.flyable === 'good' ? '#22c55e' : weather?.flyable === 'caution' ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      background: '#111',
      border: '1px solid #222',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#333';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(147,51,234,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#222';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      }}
    >
      {/* Header: Company + Rating */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '24px' }}>🏗️</span>
          <div>
            <div style={{
              fontSize: '14px',
              color: '#9333ea',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
              onClick={() => onViewEnterprise && onViewEnterprise(mission.enterprise_id)}
            >
              {mission.enterprise_name || 'Enterprise'}
            </div>
          </div>
        </div>
        {mission.rating && (
          <div style={{
            fontSize: '14px',
            color: '#fbbf24',
            fontWeight: '600'
          }}>
            ⭐ {mission.rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Title */}
      <div style={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#fff',
        marginBottom: '12px',
        cursor: 'pointer'
      }}
        onClick={() => onViewDetails && onViewDetails(mission.id)}
      >
        {mission.title}
      </div>

      {/* Location + Dates */}
      <div style={{
        display: 'flex',
        gap: '20px',
        fontSize: '13px',
        color: '#888',
        marginBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <span>📍 {mission.region || 'Unknown location'}</span>
        {mission.start_date && mission.end_date && (
          <span>📅 {mission.start_date} - {mission.end_date}</span>
        )}
      </div>

      {/* Weather badge */}
      {weather && (
        <div style={{
          fontSize: '13px',
          color: '#fff',
          marginBottom: '12px',
          padding: '8px 12px',
          background: flyableColor + '15',
          border: `1px solid ${flyableColor}40`,
          borderRadius: '6px',
          width: 'fit-content'
        }}>
          {flyableEmoji} {weather.temp_c}°C, {weather.wind_kmh} km/h wind
        </div>
      )}

      {/* Budget + Qualification */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingTop: '12px',
        borderTop: '1px solid #222'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#fff'
        }}>
          💰 {mission.reward || mission.budget_usdc || 0} SOL
        </div>
        <div style={{
          fontSize: '13px',
          color: isQualified ? '#22c55e' : '#ef4444',
          fontWeight: '600'
        }}>
          {isQualified ? '✅ You qualify' : `⚠️ Missing: ${qualifications?.join(', ')}`}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px'
      }}>
        <button
          onClick={() => onViewDetails && onViewDetails(mission.id)}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid #333',
            color: '#888',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#9333ea';
            e.currentTarget.style.color = '#9333ea';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#333';
            e.currentTarget.style.color = '#888';
          }}
        >
          View Details
        </button>
        <button
          onClick={() => onApply && onApply(mission.id)}
          disabled={isApplied || isApplying || !isQualified}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: isApplied || !isQualified ? '#333' : '#9333ea',
            border: 'none',
            color: '#fff',
            borderRadius: '8px',
            cursor: isApplied || !isQualified ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            opacity: isApplied || !isQualified ? 0.5 : 1,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!isApplied && !isApplying && isQualified) {
              e.currentTarget.style.background = '#a855f7';
            }
          }}
          onMouseLeave={(e) => {
            if (!isApplied && !isApplying && isQualified) {
              e.currentTarget.style.background = '#9333ea';
            }
          }}
        >
          {isApplying ? 'Applying...' : isApplied ? 'Already Applied' : 'Apply Now'}
        </button>
      </div>
    </div>
  );
}
