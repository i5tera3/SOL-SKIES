// src/components/BioEditor.jsx
// Inline bio/description editor for owner-only view of profile pages.
// Click "Edit" → textarea → Save (PATCH settings endpoint) → display.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';

export default function BioEditor({ kind, ownerId, initialBio, onSaved }) {
  // `kind` is 'operator' or 'enterprise' — picks which settings endpoint to hit.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBio || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const path = `/api/settings/${kind}/${ownerId}`;
      const res = await apiFetch(path, {
        method: 'PATCH',
        body: JSON.stringify({ bio: draft.trim() || null }),
      });
      toast.success('Bio updated');
      setEditing(false);
      if (onSaved) onSaved(res?.user || { bio: draft });
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'transparent', border: '1px solid #333',
            color: '#aaa', borderRadius: 8, padding: '4px 10px',
            cursor: 'pointer', fontSize: 11, flexShrink: 0,
          }}>
          ✏️ Edit bio
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: '#0d0d0d', border: '1px solid #333',
      borderRadius: 12, padding: 14,
    }}>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        maxLength={2000}
        placeholder={kind === 'operator'
          ? 'Tell enterprises what you fly, where you operate, and what makes you reliable.'
          : 'Describe your business — industries, regions, what kind of drone work you commission.'}
        autoFocus
        style={{
          width: '100%', minHeight: 100,
          background: '#1a1a1a', border: '1px solid #333',
          borderRadius: 8, padding: 10, color: 'white',
          fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ color: '#666', fontSize: 11 }}>{draft.length}/2000</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setEditing(false); setDraft(initialBio || ''); }}
            disabled={saving}
            style={{
              background: 'transparent', border: '1px solid #333',
              color: '#aaa', borderRadius: 8, padding: '6px 14px',
              cursor: saving ? 'wait' : 'pointer', fontSize: 12,
            }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{
              background: '#9333ea', border: 'none', color: 'white',
              borderRadius: 8, padding: '6px 18px',
              cursor: saving ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600,
            }}>
            {saving ? 'Saving…' : 'Save bio'}
          </button>
        </div>
      </div>
    </div>
  );
}
