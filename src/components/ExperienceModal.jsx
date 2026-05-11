// src/components/ExperienceModal.jsx
// Form for adding a single work-history entry. Optional photo upload + company
// autocomplete (suggests enterprises that exist on the platform; free text
// also accepted for off-platform employers).

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE, apiFetch } from '../lib/api';

const INDUSTRIES = [
  '', 'energy', 'oil_gas', 'construction', 'mapping', 'agriculture',
  'logistics', 'public_safety', 'defense', 'media', 'inspection', 'research', 'other',
];

export default function ExperienceModal({ operatorId, onClose, onSaved }) {
  const [form, setForm] = useState({
    company: '', role: '', region: '',
    industry: '', start_date: '', end_date: '',
    description: '', drone_models: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Enterprise autocomplete — pulled once on mount so the input is snappy.
  const [enterprises, setEnterprises] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/search/enterprises`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => setEnterprises(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);

  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const onPickImage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', imageFile);
      fd.append('type', 'experience');
      const r = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error('Image upload failed');
      const d = await r.json();
      return d.url;
    } finally {
      setImageUploading(false);
    }
  };

  const submit = async () => {
    if (!form.company.trim() || !form.role.trim()) {
      toast.error('Company and role are required');
      return;
    }
    setSubmitting(true);
    try {
      // Upload photo first (if any) so the saved row has the URL.
      let image_url = null;
      if (imageFile) image_url = await uploadImage();

      // If the typed company matches an existing enterprise, link by id.
      const lc = form.company.trim().toLowerCase();
      const matchedEnterprise = enterprises.find(e =>
        (e.company_name || '').toLowerCase() === lc
      );

      const body = {
        company: form.company.trim(),
        role: form.role.trim(),
        region: form.region.trim() || null,
        industry: form.industry || null,
        start_date: form.start_date.trim() || null,
        end_date: form.end_date.trim() || null,
        description: form.description.trim() || null,
        drone_models: form.drone_models.split(',').map(s => s.trim()).filter(Boolean),
        image_url,
        enterprise_id: matchedEnterprise?.id || null,
      };
      const saved = await apiFetch(`/api/operators/${operatorId}/experiences`, {
        method: 'POST', body: JSON.stringify(body),
      });
      if (onSaved) onSaved(saved);
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { color: '#888', fontSize: 12, marginBottom: 4, display: 'block' };
  const inputStyle = {
    width: '100%', background: '#1a1a1a', border: '1px solid #333',
    borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d0d', border: '1px solid #333',
          borderRadius: 16, padding: 24, maxWidth: 600, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ color: 'white', fontSize: 18 }}>Add work experience</h2>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#888',
            fontSize: 22, cursor: 'pointer',
          }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>
              Company *
              <span style={{ color: '#666', fontSize: 11, marginLeft: 6 }}>
                (suggestions from registered enterprises — or type your own)
              </span>
            </label>
            <input
              style={inputStyle}
              value={form.company}
              onChange={set('company')}
              placeholder="e.g. Skybuild Energy"
              list="experience-companies"
              autoComplete="off"
            />
            <datalist id="experience-companies">
              {enterprises.map(e => (
                <option key={e.id} value={e.company_name}>
                  {e.industry ? `${e.industry} · ${e.operating_regions || ''}` : ''}
                </option>
              ))}
            </datalist>
          </div>

          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Role *</label>
            <input style={inputStyle} value={form.role} onChange={set('role')}
              placeholder="e.g. Senior Inspection Pilot" />
          </div>

          <div>
            <label style={labelStyle}>Region</label>
            <input style={inputStyle} value={form.region} onChange={set('region')}
              placeholder="e.g. Germany" />
          </div>
          <div>
            <label style={labelStyle}>Industry</label>
            <select style={inputStyle} value={form.industry} onChange={set('industry')}>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i || '— select —'}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Start (YYYY-MM)</label>
            <input style={inputStyle} value={form.start_date} onChange={set('start_date')}
              placeholder="2021-03" />
          </div>
          <div>
            <label style={labelStyle}>End (YYYY-MM, blank if current)</label>
            <input style={inputStyle} value={form.end_date} onChange={set('end_date')}
              placeholder="2023-08 or leave blank" />
          </div>

          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Drone models (comma-separated)</label>
            <input style={inputStyle} value={form.drone_models} onChange={set('drone_models')}
              placeholder="DJI Matrice 350 RTK, Autel EVO Max 4T" />
          </div>

          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90, fontFamily: 'inherit' }}
              value={form.description} onChange={set('description')}
              placeholder="What did you fly, where, for whom? What was the scale?"
            />
          </div>

          {/* Photo upload (optional) */}
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Photo (optional) — proof shot, drone in action, project site, etc.</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickImage}
              style={{ display: 'none' }}
            />
            {imagePreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imagePreview} alt="preview" style={{
                  maxWidth: 280, maxHeight: 180,
                  borderRadius: 10, border: '1px solid #333',
                }} />
                <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.7)', color: 'white',
                    border: 'none', borderRadius: '50%', width: 24, height: 24,
                    cursor: 'pointer', fontSize: 14,
                  }}>×</button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'transparent', border: '1px dashed #444',
                  borderRadius: 10, padding: '14px 18px', color: '#888',
                  cursor: 'pointer', fontSize: 13, width: '100%',
                }}>
                📷 Click to choose a photo (max 5 MB)
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} disabled={submitting || imageUploading} style={{
            flex: 1, background: 'transparent', border: '1px solid #333',
            borderRadius: 10, padding: '12px 0', color: '#aaa',
            cursor: (submitting || imageUploading) ? 'wait' : 'pointer', fontSize: 14,
          }}>Cancel</button>
          <button onClick={submit} disabled={submitting || imageUploading} style={{
            flex: 2, background: '#9333ea', border: 'none',
            borderRadius: 10, padding: '12px 0', color: 'white',
            cursor: (submitting || imageUploading) ? 'wait' : 'pointer', fontSize: 14, fontWeight: 600,
          }}>
            {imageUploading ? 'Uploading photo…' : submitting ? 'Saving…' : 'Save experience'}
          </button>
        </div>
      </div>
    </div>
  );
}
