// src/components/MissionStatePill.jsx
// Color-coded chip for mission lifecycle state. Mirror of server/missionFSM.mjs.

const STATE_STYLES = {
  draft:            { bg: '#1f2937', fg: '#9ca3af', label: 'Draft' },
  funded:           { bg: '#1e3a5f', fg: '#93c5fd', label: 'Funded' },
  open:             { bg: '#0d3a26', fg: '#6ee7b7', label: 'Open' },
  partially_filled: { bg: '#3a2d0d', fg: '#fcd34d', label: 'Partially filled' },
  fully_staffed:    { bg: '#0e2c4a', fg: '#7dd3fc', label: 'Fully staffed' },
  active:           { bg: '#1a3d0e', fg: '#86efac', label: 'Active' },
  submitted:        { bg: '#3b1f4a', fg: '#d8b4fe', label: 'Submitted' },
  completed:        { bg: '#0a3d1a', fg: '#34d399', label: 'Completed' },
  disputed:         { bg: '#4a1d1d', fg: '#fca5a5', label: 'Disputed' },
  cancelled:        { bg: '#2a1a1a', fg: '#9ca3af', label: 'Cancelled' },
  // Legacy values from existing data
  assigned:         { bg: '#0e2c4a', fg: '#7dd3fc', label: 'Assigned' },
};

export default function MissionStatePill({ state, size = 'md' }) {
  const s = STATE_STYLES[state] || { bg: '#1f2937', fg: '#9ca3af', label: state || 'Unknown' };
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? '11px' : '12px';
  return (
    <span style={{
      background: s.bg,
      color: s.fg,
      padding,
      borderRadius: '999px',
      fontSize,
      fontWeight: 600,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      display: 'inline-block',
      border: `1px solid ${s.fg}33`,
    }}>
      {s.label}
    </span>
  );
}
