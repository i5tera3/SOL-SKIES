// src/components/ContactOperatorButton.jsx
// "💬 Message" button on an operator's public profile. Only meaningful when
// an authenticated enterprise is viewing — for anyone else, button is hidden.
//
// On click: creates (or reuses) a conversation between this enterprise and
// the operator, sends the first message inline, then routes the enterprise
// to their dashboard's Messages tab.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useSession } from '../Context/sessionContext';

export default function ContactOperatorButton({ operatorId, operatorName }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Only enterprises see this entry point. Operators talking to other operators
  // isn't a use case yet, and an unauth'd viewer has no JWT to create a convo.
  if (!user || user.role !== 'enterprise' || !operatorId) return null;

  const send = async () => {
    if (!text.trim()) {
      toast.error('Type a message first');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Get-or-create the conversation. The server idempotently returns the
      //    existing one if these two parties already have a thread.
      const conv = await apiFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          operator_id: operatorId,
          enterprise_id: user.id,
        }),
      });
      // 2. Post the first message.
      await apiFetch(`/api/conversations/${conv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text.trim() }),
      });
      toast.success(`Message sent to ${operatorName || 'operator'}`);
      setOpen(false);
      setText('');
      // 3. Route the enterprise into their dashboard so they can keep the convo going.
      //    EnterpriseDashboard reads ?tab=chat to switch the active tab on mount.
      navigate('/enterprise/dashboard?tab=chat');
    } catch (e) {
      toast.error(e.message || 'Send failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: '#9333ea', color: 'white',
          border: 'none', borderRadius: 10,
          padding: '10px 20px', fontWeight: 600, fontSize: 14,
          cursor: 'pointer', display: 'inline-flex',
          alignItems: 'center', gap: 8,
        }}
      >
        💬 Message
      </button>

      {open && (
        <div
          onClick={() => !submitting && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0d0d0d', border: '1px solid #333',
              borderRadius: 16, padding: 24, maxWidth: 520, width: '100%',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ color: 'white', fontSize: 18 }}>
                Message {operatorName || 'operator'}
              </h2>
              <button onClick={() => !submitting && setOpen(false)} style={{
                background: 'transparent', border: 'none', color: '#888',
                fontSize: 22, cursor: submitting ? 'wait' : 'pointer',
              }}>×</button>
            </div>

            <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
              Starts a thread you can continue from the Messages tab in your dashboard.
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Hi — interested in a job we're posting on a wind farm in northern Germany next month…"
              autoFocus
              style={{
                width: '100%', minHeight: 120,
                background: '#1a1a1a', border: '1px solid #333',
                borderRadius: 10, padding: 12, color: 'white',
                fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => !submitting && setOpen(false)} disabled={submitting} style={{
                flex: 1, background: 'transparent', border: '1px solid #333',
                color: '#aaa', borderRadius: 10, padding: '10px 0',
                fontSize: 14, cursor: submitting ? 'wait' : 'pointer',
              }}>Cancel</button>
              <button onClick={send} disabled={submitting} style={{
                flex: 2, background: '#9333ea', border: 'none',
                color: 'white', borderRadius: 10, padding: '10px 0',
                fontSize: 14, fontWeight: 600,
                cursor: submitting ? 'wait' : 'pointer',
              }}>
                {submitting ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
