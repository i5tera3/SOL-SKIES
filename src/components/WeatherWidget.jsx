import { API_BASE } from '../lib/api';
import { useState, useEffect } from 'react';

const ICONS = {
  Clear: '☀️',
  Clouds: '🌤️',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Wind: '💨',
  Snow: '❄️',
  Thunderstorm: '⛈️'
};

const FLYABLE_COLOR = {
  good: '#22c55e',
  caution: '#f59e0b',
  unsafe: '#ef4444'
};

const FLYABLE_LABEL = {
  good: '✅ Flyable',
  caution: '⚠️ Caution',
  unsafe: '🚫 Unsafe'
};

export default function WeatherWidget({ lat, lng, startDate, endDate }) {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lat || !lng) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/weather?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(data => {
        setForecast(data.daily || []);
        setLoading(false);
      })
      .catch(e => {
        setError('Weather unavailable');
        setLoading(false);
      });
  }, [lat, lng]);

  if (!lat || !lng) {
    return (
      <div style={{
        padding: '20px',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333',
        color: '#888',
        textAlign: 'center',
        fontSize: '14px'
      }}>
        📍 No location set
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333',
        display: 'flex',
        gap: '10px',
        overflowX: 'auto'
      }}>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}</style>
        {[...Array(7)].map((_, i) => (
          <div key={i} style={{
            minWidth: '100px',
            height: '140px',
            background: '#222',
            borderRadius: '8px',
            animation: 'pulse 2s infinite'
          }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333',
        color: '#ef4444',
        textAlign: 'center',
        fontSize: '14px'
      }}>
        {error}
      </div>
    );
  }

  if (!forecast || forecast.length === 0) {
    return (
      <div style={{
        padding: '20px',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333',
        color: '#888',
        textAlign: 'center',
        fontSize: '14px'
      }}>
        📍 No forecast data available
      </div>
    );
  }

  const isInRange = (date) => {
    if (!startDate || !endDate) return false;
    return date >= startDate && date <= endDate;
  };

  return (
    <div style={{
      padding: '15px',
      background: '#1a1a1a',
      borderRadius: '12px',
      border: '1px solid #333',
      overflowX: 'auto',
      display: 'flex',
      gap: '12px',
      minHeight: '180px'
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .weather-cards {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          scroll-behavior: smooth;
        }
        .weather-cards::-webkit-scrollbar {
          height: 6px;
        }
        .weather-cards::-webkit-scrollbar-track {
          background: #222;
          border-radius: 3px;
        }
        .weather-cards::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 3px;
        }
        .weather-cards::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
      `}</style>
      {forecast.map((day, idx) => (
        <div
          key={idx}
          style={{
            minWidth: '110px',
            padding: '12px',
            background: '#111',
            borderRadius: '8px',
            border: `2px solid ${isInRange(day.date) ? '#9333ea' : FLYABLE_COLOR[day.flyable] || '#333'}`,
            textAlign: 'center',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: '12px',
            flexShrink: 0
          }}
        >
          <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>
            {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}
          </div>
          <div style={{ fontSize: '32px', margin: '4px 0' }}>
            {ICONS[day.condition] || '🌤️'}
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600' }}>
            {day.temp_c}°C
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', margin: '2px 0' }}>
            💨 {day.wind_kmh} km/h
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
            🌧️ {day.rain_mm} mm
          </div>
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            padding: '4px 6px',
            background: FLYABLE_COLOR[day.flyable] + '20',
            borderRadius: '4px',
            color: FLYABLE_COLOR[day.flyable],
            border: `1px solid ${FLYABLE_COLOR[day.flyable]}40`
          }}>
            {FLYABLE_LABEL[day.flyable]}
          </div>
        </div>
      ))}
    </div>
  );
}
