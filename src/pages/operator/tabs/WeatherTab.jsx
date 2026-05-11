// src/pages/operator/tabs/WeatherTab.jsx
// Weather + NASA EONET hazard awareness panel for operators.
// Self-contained — only needs operatorData (currently unused, kept for future location auto-fill).

import { useState } from 'react';
import { API_BASE } from '../../../lib/api';

const ICONS = { Clear:'☀️', Clouds:'🌤️', Rain:'🌧️', Drizzle:'🌦️', Wind:'💨', Snow:'❄️', Thunderstorm:'⛈️', Mist:'🌫️' };
const EONET_ICONS = {
  'Wildfires': '🔥', 'Severe Storms': '⛈️', 'Floods': '🌊',
  'Earthquakes': '🌍', 'Volcanoes': '🌋', 'Landslides': '⛰️',
  'Sea and Lake Ice': '🧊', 'Drought': '☀️', 'Dust and Haze': '💨',
  'Snow': '❄️', 'Temperature Extremes': '🌡️', 'Manmade': '🏭',
};
const flyableColors = { good: '#22c55e', caution: '#f59e0b', unsafe: '#ef4444' };
const flyableLabels = { good: '✅ Good to fly', caution: '⚠️ Fly with caution', unsafe: '🚫 Unsafe to fly' };

export default function WeatherTab({ operatorData }) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [eonetEvents, setEonetEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [radiusKm, setRadiusKm] = useState(500);
  const [autoDetecting, setAutoDetecting] = useState(false);

  const fetchWeather = async (latitude, longitude) => {
    setLoading(true); setError('');
    try {
      const [curRes, foreRes, eoRes] = await Promise.all([
        fetch(`${API_BASE}/api/weather/current?lat=${latitude}&lng=${longitude}`),
        fetch(`${API_BASE}/api/weather?lat=${latitude}&lng=${longitude}`),
        fetch(`${API_BASE}/api/eonet?lat=${latitude}&lng=${longitude}&radius=${radiusKm}&days=14`),
      ]);
      if (curRes.ok) setCurrent(await curRes.json());
      if (foreRes.ok) { const d = await foreRes.json(); setForecast(d.daily || []); }
      if (eoRes.ok)   { const d = await eoRes.json();   setEonetEvents(d.events || []); }
    } catch (e) { setError('Failed to load weather. Is the server running?'); }
    finally { setLoading(false); }
  };

  const autoDetect = () => {
    setAutoDetecting(true);
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const la = pos.coords.latitude.toFixed(5);
        const lo = pos.coords.longitude.toFixed(5);
        setLat(la); setLng(lo);
        setLocationLabel('Your location');
        fetchWeather(la, lo);
        setAutoDetecting(false);
      },
      () => { setAutoDetecting(false); setError('Location access denied — enter coordinates manually.'); }
    );
  };

  const handleSearch = () => {
    if (!lat || !lng) { setError('Enter latitude and longitude first'); return; }
    fetchWeather(lat, lng);
  };

  const panelCard = (label, value, sub = '') => (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '14px 18px', flex: '1 1 130px' }}>
      <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'white', fontSize: 22, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 900, paddingBottom: 40 }}>
      {/* Location controls */}
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 140px' }}>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Latitude</div>
            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="e.g. 40.7128"
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 14 }} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Longitude</div>
            <input value={lng} onChange={e => setLng(e.target.value)} placeholder="e.g. -74.006"
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 14 }} />
          </div>
          <div style={{ flex: '0 1 110px' }}>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Hazard radius (km)</div>
            <input type="number" value={radiusKm} onChange={e => setRadiusKm(e.target.value)} min={50} max={2000}
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 14 }} />
          </div>
          <button onClick={handleSearch} style={{ background: '#9333ea', border: 'none', color: 'white', borderRadius: 10, padding: '10px 22px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            {loading ? '⏳' : '🔍 Check'}
          </button>
          <button onClick={autoDetect} disabled={autoDetecting} style={{ background: '#1a1a2a', border: '1px solid #9333ea', color: '#c084fc', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 13 }}>
            {autoDetecting ? '📡 Detecting…' : '📍 My Location'}
          </button>
        </div>
        {locationLabel && <div style={{ color: '#9333ea', fontSize: 12, marginTop: 8 }}>📌 {locationLabel}</div>}
        {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>

      {/* Current conditions */}
      {current && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 40 }}>{ICONS[current.condition] || '🌡️'}</span>
            <div>
              <div style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>{current.temp_c}°C</div>
              <div style={{ color: flyableColors[current.flyable] || '#888', fontWeight: 600, fontSize: 15 }}>{flyableLabels[current.flyable] || current.condition}</div>
            </div>
            <div style={{ marginLeft: 'auto', background: `${flyableColors[current.flyable]}20`, border: `1px solid ${flyableColors[current.flyable]}`, borderRadius: 10, padding: '6px 14px', color: flyableColors[current.flyable], fontSize: 13, fontWeight: 700 }}>
              {current.condition}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {panelCard('🌡️ Feels Like', `${current.feels_like_c}°C`)}
            {panelCard('💨 Wind', `${current.wind_kmh} km/h`, current.wind_direction)}
            {panelCard('💧 Humidity', `${current.humidity_pct}%`)}
            {panelCard('🔵 Pressure', `${current.pressure_hpa} hPa`)}
            {panelCard('👁️ Visibility', `${current.visibility_km} km`)}
          </div>
          {current.mock && <div style={{ color: '#666', fontSize: 11, marginTop: 8 }}>* Mock data — set WEATHER_API_KEY for live conditions</div>}
        </div>
      )}

      {/* 7-day forecast */}
      {forecast.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#ccc', marginBottom: 12, fontSize: 15 }}>📅 7-Day Forecast</h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {forecast.slice(0, 7).map((day, i) => {
              const c = flyableColors[day.flyable] || '#888';
              return (
                <div key={i} style={{ flex: '0 0 110px', background: '#111', border: `1px solid ${c}40`, borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>{new Date(day.date).toLocaleDateString('en',{weekday:'short', month:'short', day:'numeric'})}</div>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{ICONS[day.condition] || '🌡️'}</div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{day.temp_c}°C</div>
                  <div style={{ color: '#888', fontSize: 11, margin: '4px 0' }}>{day.wind_kmh} km/h</div>
                  <div style={{ color: c, fontSize: 10, fontWeight: 600, marginTop: 4 }}>{day.flyable?.toUpperCase()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NASA EONET hazard events */}
      <div>
        <h3 style={{ color: '#ccc', marginBottom: 4, fontSize: 15 }}>
          🛰️ NASA EONET — Active Natural Hazards
          {eonetEvents.length > 0 && <span style={{ color: '#ef4444', marginLeft: 8, fontSize: 13 }}>({eonetEvents.length} within {radiusKm} km)</span>}
        </h3>
        <p style={{ color: '#555', fontSize: 12, marginBottom: 12 }}>Data from NASA Earth Observatory Natural Event Tracker (EONET). Updated live.</p>

        {!lat && !lng && (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: 30 }}>
            Enter your location above and click Check to load hazard events.
          </div>
        )}

        {lat && lng && eonetEvents.length === 0 && !loading && (
          <div style={{ background: '#0d1a0d', border: '1px solid #22c55e30', borderRadius: 12, padding: '14px 18px', color: '#22c55e', fontSize: 14 }}>
            ✅ No active natural hazard events detected within {radiusKm} km of your location.
          </div>
        )}

        {eonetEvents.map(ev => (
          <div key={ev.id} style={{ background: '#1a0d0d', border: '1px solid #ef444430', borderRadius: 12, padding: '14px 18px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{EONET_ICONS[ev.category] || '⚠️'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{ev.title}</div>
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 2 }}>{ev.category}</div>
              {ev.date && <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>📅 {new Date(ev.date).toLocaleDateString()}</div>}
              {ev.lat && ev.lng && (
                <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                  📍 {parseFloat(ev.lat).toFixed(2)}, {parseFloat(ev.lng).toFixed(2)}
                  {ev.distance_km && <span style={{ marginLeft: 8, color: '#9333ea' }}>{ev.distance_km} km away</span>}
                </div>
              )}
              {ev.sources?.[0] && (
                <a href={ev.sources[0]} target="_blank" rel="noopener noreferrer" style={{ color: '#9333ea', fontSize: 11, marginTop: 4, display: 'inline-block' }}>
                  View source →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
