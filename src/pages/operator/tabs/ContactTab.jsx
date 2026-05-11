// src/pages/operator/tabs/ContactTab.jsx
// Threaded messaging with enterprise contacts (one conversation per contract).

export default function ContactTab({ ctx }) {
  const {
    contacts,
    selectedContact,
    setSelectedContact,
    getMessagesForContact,
    messagesEndRef,
    newMessage,
    handleMessageChange,
    sendMessage,
  } = ctx;

  return (
    <div className="contact-section" style={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
      {/* Contacts List */}
      <div style={{ width: '300px', borderRight: '1px solid #333', overflowY: 'auto' }}>
        <h3 style={{ padding: '20px', color: 'white', borderBottom: '1px solid #333' }}>
          Conversations ({contacts.length})
        </h3>
        {contacts.length > 0 ? (
          contacts.map(contact => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              style={{
                padding: '15px 20px',
                borderBottom: '1px solid #222',
                cursor: 'pointer',
                background: selectedContact?.id === contact.id ? '#1a1a1a' : 'transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={(e) => {
                if (selectedContact?.id !== contact.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '32px' }}>{contact.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'white', fontWeight: 600 }}>{contact.name}</span>
                    <span style={{ color: '#666', fontSize: '12px' }}>
                      {new Date(contact.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '14px' }}>
                      {contact.lastMessage.length > 30
                        ? contact.lastMessage.substring(0, 30) + '...'
                        : contact.lastMessage}
                    </span>
                    {contact.unread > 0 && (
                      <span style={{
                        background: '#9333ea', color: 'white',
                        borderRadius: '50%', width: '20px', height: '20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px',
                      }}>
                        {contact.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', lineHeight: 1.8 }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>💬</div>
            No conversations yet.<br />
            Contacts appear automatically once you have active contracts.
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedContact ? (
          <>
            <div style={{
              padding: '20px', borderBottom: '1px solid #333',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{ fontSize: '32px' }}>{selectedContact.avatar}</div>
              <div>
                <h3 style={{ color: 'white', marginBottom: '4px' }}>{selectedContact.name}</h3>
                <span style={{ color: '#22c55e', fontSize: '12px' }}>● Online</span>
              </div>
            </div>

            <div style={{
              flex: 1, padding: '20px', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: '15px',
            }}>
              {getMessagesForContact(selectedContact.id).map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.isOperator ? 'flex-end' : 'flex-start',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    background: msg.isOperator ? '#9333ea' : '#1a1a1a',
                    color: 'white',
                    padding: '10px 15px',
                    borderRadius: msg.isOperator ? '15px 15px 5px 15px' : '15px 15px 15px 5px',
                    border: msg.isOperator ? 'none' : '1px solid #333',
                  }}>
                    <p style={{ marginBottom: '5px' }}>{msg.text}</p>
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div style={{
              padding: '20px', borderTop: '1px solid #333',
              display: 'flex', gap: '10px',
            }}>
              <input
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                style={{
                  flex: 1, background: '#1a1a1a',
                  border: '1px solid #333', borderRadius: '30px',
                  padding: '12px 20px', color: 'white',
                  fontSize: '14px', outline: 'none',
                }}
              />
              <button
                onClick={sendMessage}
                style={{
                  background: '#9333ea', color: 'white', border: 'none',
                  borderRadius: '50%', width: '45px', height: '45px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '20px', transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#a855f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#9333ea'}
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#666', fontSize: '18px',
          }}>
            Select a contact to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
