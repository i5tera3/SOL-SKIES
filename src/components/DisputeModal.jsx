// src/components/DisputeModal.jsx
// Raise-dispute form for active contracts.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';

export default function DisputeModal({ contractId, onClose, onSubmitted }) {
  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const evidence = evidenceUrl.trim()
        ? [{ url: evidenceUrl.trim(), type: 'link', note: 'Submitted with dispute' }]
        : [];
      const result = await apiFetch(`/api/contracts/${contractId}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim(), evidence }),
      });
      toast.success('Dispute raised — admin queue notified');
      if (onSubmitted) onSubmitted(result.dispute);
      if (onClose) onClose();
    } catch (e) {
      setError(e.message || 'Failed to raise dispute');
      toast.error(e.message || 'Failed to raise dispute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: '#111',
        border: '1px solid #333',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>
          Raise a dispute
        </h2>
        <p style={{ color: '#9ca3af', margin: '0 0 24px 0', fontSize: '13px', lineHeight: 1.5 }}>
          Disputes pause the contract and route to admin review. Stake handling is determined by the verdict (released, slashed, or split).
        </p>

        <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '6px' }}>
          What happened?
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Be specific — admins decide based on this and the evidence below."
          rows={5}
          style={{
            width: '100%',
            background: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '8px',
            color: 'white',
            padding: '12px',
            fontSize: '13px',
            fontFamily: 'inherit',
            resize: 'vertical',
            marginBottom: '16px',
          }}
        />

        <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '6px' }}>
          Evidence URL (optional — flight log, photo, doc)
        </label>
        <input
          type="text"
          value={evidenceUrl}
          onChange={e => setEvidenceUrl(e.target.value)}
          placeholder="https://…"
          style={{
            width: '100%',
            background: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '8px',
            color: 'white',
            padding: '12px',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        />

        {error && (
          <div style={{
            background: '#4a1d1d',
            color: '#fca5a5',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '12px',
            marginBottom: '16px',
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting} style={{
            background: 'transparent',
            color: '#9ca3af',
            border: '1px solid #333',
            borderRadius: '999px',
            padding: '10px 20px',
            fontSize: '13px',
            cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '999px',
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}>
            {submitting ? 'Submitting…' : 'Raise dispute'}
          </button>
        </div>
      </div>
    </div>
  );
}
