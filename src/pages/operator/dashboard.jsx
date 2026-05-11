// src/pages/operator/dashboard.jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../Context/sessionContext';
import logo from '../../assets/AdobSOL.png';
import DisputeModal from '../../components/DisputeModal';
import { API_BASE } from '../../lib/api';

// Phase 6 — tabs decomposed into route-modules. Parent stays the source of
// truth for state; each tab takes a `ctx` prop with the slice it needs.
import DashboardTab from './tabs/DashboardTab';
import ContractsTab from './tabs/ContractsTab';
import WeatherTab from './tabs/WeatherTab';
import ContactTab from './tabs/ContactTab';

const DASHBOARD_STYLES = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background-color: #0a0a0a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    }

    .dashboard-page {
      display: flex;
      min-height: 100vh;
      background-color: #0a0a0a;
    }

    .sidebar {
      width: 280px;
      background: #111111;
      border-right: 1px solid #222;
      padding: 30px 20px;
      display: flex;
      flex-direction: column;
      position: fixed;
      height: 100vh;
      overflow-y: auto;
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 40px;
      padding: 0 10px;
    }

    .sidebar-logo img {
      width: 40px;
      height: 40px;
      filter: brightness(0) invert(1);
    }

    .sidebar-logo span {
      font-size: 20px;
      font-weight: 600;
      color: white;
      background: linear-gradient(135deg, #fff, #e9d5ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .sidebar-nav {
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 12px;
      color: #888;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      font-size: 15px;
    }

    .nav-item:hover {
      background: #1a1a1a;
      color: white;
    }

    .nav-item.active {
      background: #9333ea20;
      color: #9333ea;
      border-left: 3px solid #9333ea;
    }

    .nav-item.danger {
      color: #ef4444;
    }

    .nav-item.danger:hover {
      background: #ef444410;
      color: #ef4444;
    }

    .nav-divider {
      height: 1px;
      background: #222;
      margin: 12px 0;
    }

    .nav-icon {
      font-size: 20px;
      width: 24px;
      text-align: center;
    }

    /* FIX #1: Wallet info sidebar — no empty bar when publicKey is null */
    .wallet-info-sidebar {
      margin-top: 20px;
      padding: 16px;
      background: #1a1a1a;
      border-radius: 12px;
      font-size: 14px;
      border: 1px solid #333;
    }

    .wallet-connected-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #22c55e;
    }

    .dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .wallet-address-small {
      font-family: monospace;
      color: #888;
      word-break: break-all;
      font-size: 12px;
      background: #222;
      padding: 8px;
      border-radius: 6px;
      margin-top: 10px;
    }

    .main-content {
      flex: 1;
      margin-left: 280px;
      padding: 30px;
      background-color: #0a0a0a;
    }

    .content-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    .content-header h1 {
      font-size: 28px;
      background: linear-gradient(135deg, #fff, #e9d5ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-actions {
      display: flex;
      gap: 15px;
    }

    .notification-btn {
      background: #111;
      border: 1px solid #333;
      width: 45px;
      height: 45px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 20px;
      color: white;
    }

    .notification-btn:hover {
      background: #1a1a1a;
      border-color: #9333ea;
    }

    .profile-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
      margin-bottom: 30px;
    }

    .card {
      background: #111111;
      border-radius: 24px;
      padding: 25px;
      border: 1px solid #222;
      box-shadow: 0 10px 30px rgba(147, 51, 234, 0.1);
    }

    .profile-header {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      position: relative;
    }

    .profile-image-container {
      position: relative;
      width: 80px;
      height: 80px;
      flex-shrink: 0;
    }

    .profile-image {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #9333ea, #a855f7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      color: white;
      font-weight: 600;
      border: 2px solid #9333ea;
    }

    .profile-image-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #9333ea;
    }

    .profile-upload-label {
      position: absolute;
      bottom: 0;
      right: 0;
      background: #9333ea;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      border: 2px solid #111;
    }

    .profile-upload-label:hover {
      background: #a855f7;
    }

    .profile-info h2 {
      font-size: 22px;
      color: white;
      margin-bottom: 5px;
    }

    .profile-info .username {
      color: #888;
      font-size: 14px;
      margin-bottom: 10px;
    }

    .rating-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #854d0e20;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      color: #fbbf24;
      border: 1px solid #fbbf2430;
    }

    .feedback-section {
      margin: 20px 0;
    }

    .feedback-label {
      display: flex;
      justify-content: space-between;
      color: #888;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .progress-bar {
      height: 8px;
      background: #222;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 5px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #4ade80);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .feedback-percentage {
      color: #22c55e;
      font-weight: 600;
      font-size: 18px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 20px;
    }

    .stat-item {
      text-align: center;
      padding: 15px;
      background: #1a1a1a;
      border-radius: 16px;
      border: 1px solid #333;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: white;
    }

    .stat-label {
      font-size: 12px;
      color: #888;
      margin-top: 5px;
    }

    .drone-image {
      width: 100%;
      height: 160px;
      border-radius: 16px;
      overflow: hidden;
      margin: 15px 0;
      background: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #888;
      border: 1px solid #333;
    }

    .drone-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .drone-specs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }

    .spec-item {
      padding: 12px;
      background: #1a1a1a;
      border-radius: 12px;
      border: 1px solid #333;
    }

    .spec-label {
      font-size: 12px;
      color: #888;
      margin-bottom: 5px;
    }

    .spec-value {
      font-size: 16px;
      font-weight: 600;
      color: white;
    }

    .verify-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #22c55e;
      font-size: 14px;
      margin-top: 15px;
      padding: 10px;
      background: #22c55e10;
      border-radius: 8px;
      border: 1px solid #22c55e30;
    }

    .section-title {
      font-size: 20px;
      color: white;
      margin-bottom: 20px;
    }

    .contracts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }

    .contract-card {
      background: #111111;
      border-radius: 20px;
      padding: 20px;
      border: 1px solid #222;
      transition: all 0.2s ease;
    }

    .contract-card:hover {
      transform: translateY(-2px);
      border-color: #9333ea;
      box-shadow: 0 10px 30px rgba(147, 51, 234, 0.2);
    }

    .contract-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .contract-client {
      font-weight: 600;
      color: white;
      font-size: 16px;
    }

    .contract-status {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .contract-mission {
      font-size: 18px;
      color: #e9d5ff;
      margin-bottom: 10px;
    }

    .contract-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 15px 0;
    }

    .detail-item {
      font-size: 14px;
    }

    .detail-label {
      color: #888;
      margin-bottom: 3px;
      font-size: 12px;
    }

    .detail-value {
      font-weight: 600;
      color: white;
    }

    .contract-progress {
      margin-top: 15px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #888;
      margin-bottom: 5px;
    }

    .contract-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    .action-btn {
      flex: 1;
      padding: 10px;
      border: 1px solid #333;
      background: #1a1a1a;
      border-radius: 10px;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
    }

    .action-btn:hover {
      background: #222;
      border-color: #9333ea;
    }

    .action-btn.primary {
      background: #9333ea;
      color: white;
      border: none;
    }

    .action-btn.primary:hover {
      background: #a855f7;
    }

    .contact-section {
      background: #111111;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid #222;
    }

    .filters-section {
      margin-bottom: 20px;
    }

    @media (max-width: 1024px) {
      .sidebar { width: 240px; }
      .main-content { margin-left: 240px; }
      .profile-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main-content { margin-left: 0; }
    }
  `;

function OperatorDashboard() {
  const navigate = useNavigate();
  const { user: sessionUser, isAuthenticated, logout } = useSession();
  const connected = true;
  const publicKey = sessionUser?.walletAddress ? { toBase58: () => sessionUser.walletAddress } : null;
  const [userData, setUserData] = useState(null);
  const [operatorData, setOperatorData] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [disputeFor, setDisputeFor] = useState(null); // contract id, opens DisputeModal
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Chat states
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  // FIX: isWalletReady removed — was creating stuck loading gate. ProtectedRoute handles auth.

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  // Contract detail modal state
  const [selectedContractDetail, setSelectedContractDetail] = useState(null);

  // Available missions state
  const [availableMissions, setAvailableMissions] = useState([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [appliedMissionIds, setAppliedMissionIds] = useState(new Set());
  const [applyingId, setApplyingId] = useState(null);

  // Auth guard removed — ProtectedRoute handles this.
  // Internal guard caused freeze: logout set isAuthenticated=false → guard fired
  // navigate('/') → handleLogout also fired window.location.replace → loop → freeze.

  // Dashboard init — fetch by session ID directly, no wallet detection needed
  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.id) return;
    let isMounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/operators/${sessionUser.id}/dashboard`);
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          setOperatorData(data);
          setContracts(data.contracts || []);
          setFilteredContracts(data.contracts || []);
          setUserData(data);
        } else if (res.status === 404) {
          logout(); window.location.href = '/signup';
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err) {
        if (isMounted) setError('Failed to load dashboard data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => { isMounted = false; };
  }, [isAuthenticated, sessionUser?.id]); // re-run if auth or user changes

  // Load messages from API whenever selected contact changes. Routes by `kind`:
  // 'conversation' → Phase-2 thread endpoint; otherwise → legacy contract feed.
  useEffect(() => {
    if (!selectedContact) return;
    let isMounted = true;

    const url = selectedContact.kind === 'conversation' && selectedContact.conversation_id
      ? `${API_BASE}/api/conversations/${selectedContact.conversation_id}/messages`
      : `${API_BASE}/api/messages/${selectedContact.contract_id || selectedContact.id}`;

    fetch(url)
      .then(r => r.json())
      .then(msgs => {
        if (!isMounted) return;
        const mapped = (msgs || []).map(m => ({
          id: m.id,
          contactId: selectedContact.id,
          // Either schema delivers a role identifier and a body field — normalize.
          sender: (m.sender_type || m.sender_role) === 'operator' ? 'operator' : 'enterprise',
          text: m.text ?? m.content ?? '',
          timestamp: new Date(m.timestamp).toISOString(),
          read: !!m.read,
        }));
        setMessages(mapped);
      })
      .catch(err => { if (isMounted) console.error('Load messages error:', err); });
    return () => { isMounted = false; };
  }, [selectedContact]);

  // Auto-scroll chat to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch missions when switching to contracts tab
  useEffect(() => {
    if (activeTab === 'contracts') fetchMissions();
  }, [activeTab]);

  // Apply filters whenever contracts, searchTerm, statusFilter, or regionFilter change
  useEffect(() => {
    let filtered = [...contracts];

    if (searchTerm) {
      filtered = filtered.filter(contract =>
        contract.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.region?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(contract => contract.status === statusFilter);
    }

    if (regionFilter !== 'all') {
      filtered = filtered.filter(contract => contract.region === regionFilter);
    }

    setFilteredContracts(filtered);
  }, [contracts, searchTerm, statusFilter, regionFilter]);

  const fetchOperatorDataById = async (userId) => {
    setLoading(true);
    try {
      const dashboardResponse = await fetch(`${API_BASE}/api/operators/${userId}/dashboard`);
      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        setOperatorData(data);
        setContracts(data.contracts || []);
        setFilteredContracts(data.contracts || []);
        setUserData(data);
      } else if (dashboardResponse.status === 404) {
        // Operator ID in session doesn't exist in DB (e.g. DB was cleared)
        logout(); window.location.href = '/signup';
        return;
      } else {
        throw new Error(`Server error ${dashboardResponse.status}`);
      }
    } catch (error) {
      console.error('Error loading operator data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOperatorDataByWallet = async () => {
    setLoading(true);
    try {
      // Belt-and-suspenders: if publicKey is still null, fall back to session ID lookup
      if (!publicKey) {
        if (sessionUser?.id) {
          await fetchOperatorDataById(sessionUser.id);
          return;
        }
        throw new Error('No wallet address or user ID in session');
      }

      const walletResponse = await fetch(`${API_BASE}/api/operators/wallet/${publicKey.toBase58()}`);

      if (!walletResponse.ok) {
        if (walletResponse.status === 404) {
          // Wallet not in DB — try by session ID first
          if (sessionUser?.id) {
            await fetchOperatorDataById(sessionUser.id);
            return;
          }
          // No record at all — clear stale session and send to signup
          logout(); window.location.href = '/signup';
          return;
        }
        throw new Error(`Server error ${walletResponse.status} fetching operator`);
      }

      const operator = await walletResponse.json();
      setUserData(operator);

      // Dashboard endpoint returns operator + contracts in one call
      const dashboardResponse = await fetch(`${API_BASE}/api/operators/${operator.id}/dashboard`);
      if (!dashboardResponse.ok) throw new Error(`Dashboard fetch failed: ${dashboardResponse.status}`);
      const data = await dashboardResponse.json();

      setOperatorData(data);
      setContracts(data.contracts || []);
      setFilteredContracts(data.contracts || []);
    } catch (error) {
      console.error('Error fetching operator data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const calculatePositiveFeedback = () => {
    if (!contracts || contracts.length === 0) return 0;
    const completedContracts = contracts.filter(c => c.status === 'completed');
    if (completedContracts.length === 0) return 0;
    const totalRating = completedContracts.reduce((sum, contract) => sum + (contract.rating || 5), 0);
    const averageRating = totalRating / completedContracts.length;
    return Math.round((averageRating / 5) * 100);
  };

  const handleLogout = () => {
    // logout() in sessionContext handles EVERYTHING:
    //   1. Clears localStorage (session + user)
    //   2. Attempts window.solana.disconnect()
    //   3. window.location.replace('/?loggedOut=1')  ← kills auto-reconnect loop
    // FIX: removed the broken `disconnect()` call (was undefined — not imported from useWallet)
    // FIX: removed localStorage.setItem('justLoggedOut') — URL param ?loggedOut=1 is used instead
    // FIX: removed navigate('/') after logout() — hard redirect beats navigate() and
    //      calling both caused a racing freeze in the previous version.
    logout();
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    const available = operatorData?.total_earned || 0;
    if (amount > available) {
      alert(`Cannot withdraw ${amount} USDC — you only have ${available.toFixed(2)} USDC available`);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/operators/${operatorData.id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (res.ok) {
        setOperatorData(prev => ({ ...prev, total_earned: data.operator.total_earned }));
        setWithdrawAmount('');
        setShowWithdrawModal(false);
        alert(`✅ Successfully withdrew ${amount} USDC to your wallet.`);
      } else {
        alert(`Withdraw failed: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      alert('Network error. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      fetch(`${API_BASE}/api/operators/${userData?.id}`, { method: 'DELETE' })
        .then(() => {
          logout();
        })
        .catch(err => {
          console.error('Delete error:', err);
          alert('Failed to delete account. Please try again.');
        });
    }
  };

  // FIX #3: Profile image upload now saves URL back to the database
  const handleProfileImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'profile');

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();

      // Save the new URL back to the database so it persists on refresh
      await fetch(`${API_BASE}/api/operators/${operatorData?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_image: data.url })
      });

      setOperatorData(prev => ({ ...prev, profile_image: data.url }));
      alert('Profile image updated!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Fetch open missions for the operator to browse
  const fetchMissions = async () => {
    setMissionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/missions?status=open`);
      const data = await res.json();
      setAvailableMissions(data || []);
      // Also fetch which ones this operator already applied to
      if (operatorData?.id) {
        const appRes = await fetch(`${API_BASE}/api/operators/${operatorData.id}/applications`);
        const apps = await appRes.json();
        setAppliedMissionIds(new Set((apps || []).map(a => a.mission_id)));
      }
    } catch (err) {
      console.error('Fetch missions error:', err);
    } finally {
      setMissionsLoading(false);
    }
  };

  const applyToMission = async (mission) => {
    if (!operatorData?.id) return;
    setApplyingId(mission.id);
    try {
      const res = await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission_id: mission.id,
          operator_id: operatorData.id,
          operator_name: operatorData.full_name,
          operator_username: operatorData.username
        })
      });
      if (res.ok || res.status === 409) {
        setAppliedMissionIds(prev => new Set([...prev, mission.id]));
      }
    } catch (err) {
      console.error('Apply error:', err);
    } finally {
      setApplyingId(null);
    }
  };

  // Update contract progress and refresh dashboard
  const updateContractProgress = async (contractId, progress, markComplete = false) => {
    try {
      const updates = { progress: parseInt(progress) };
      if (markComplete) updates.status = 'completed';
      await fetch(`${API_BASE}/api/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      // Refresh dashboard data
      if (sessionUser?.id) await fetchOperatorDataById(sessionUser.id);
      else await fetchOperatorDataByWallet();
    } catch (err) {
      console.error('Update contract error:', err);
      alert('Failed to update. Please try again.');
    }
  };

  const handleMessageChange = (e) => {
    setNewMessage(e.target.value);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;
    const text = newMessage;
    setNewMessage('');
    try {
      let res;
      if (selectedContact.kind === 'conversation' && selectedContact.conversation_id) {
        res = await fetch(`${API_BASE}/api/conversations/${selectedContact.conversation_id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        });
      } else {
        // Legacy contract flow
        res = await fetch(`${API_BASE}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_id: selectedContact.contract_id || selectedContact.id,
            sender_type: 'operator',
            sender_id: userData?.id || operatorData?.id,
            text,
          }),
        });
      }
      if (res.ok) {
        const message = await res.json();
        const mapped = {
          id: message.id,
          contactId: selectedContact.id,
          sender: 'operator',
          text: message.text ?? message.content ?? text,
          timestamp: new Date(message.timestamp || Date.now()).toISOString(),
          read: false,
        };
        setMessages(prev => [...prev, mapped]);
      }
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  // Phase-2 conversation threads (created e.g. when an enterprise clicks
  // "Message" on this operator's public profile, BEFORE any contract exists).
  // Fetched on mount + tab switch.
  const [conversations, setConversations] = useState([]);
  useEffect(() => {
    if (!operatorData?.id) return;
    const load = () => {
      fetch(`${API_BASE}/api/conversations?user_id=${operatorData.id}&role=operator`)
        .then(r => r.ok ? r.json() : [])
        .then(rows => setConversations(Array.isArray(rows) ? rows : []))
        .catch(() => {});
    };
    load();
    // Re-fetch whenever the operator opens the Messages tab.
    if (activeTab === 'contact') load();
  }, [operatorData?.id, activeTab]);

  const getContactsFromContracts = () => {
    const uniqueContacts = {};

    contracts.forEach(contract => {
      if (contract.client_name && !uniqueContacts[contract.client_name]) {
        const contactMessages = messages.filter(m =>
          m.contactId === contract.enterprise_id || m.contactId === contract.client_name
        );
        const lastMessage = contactMessages.length > 0
          ? contactMessages[contactMessages.length - 1].text
          : contract.status === 'active'
            ? 'Contract in progress'
            : 'Contract completed';
        const unreadCount = contactMessages.filter(m => !m.read && m.sender !== 'operator').length;

        uniqueContacts[contract.client_name] = {
          id: contract.enterprise_id || contract.client_name,
          contract_id: contract.id,
          kind: 'contract',
          name: contract.client_name,
          type: 'enterprise',
          lastMessage,
          lastMessageTime: contract.updated_at || contract.created_at,
          unread: unreadCount,
          avatar: contract.industry === 'construction' ? '🏗️'
            : contract.industry === 'agriculture' ? '🌾' : '🏢',
        };
      }
    });

    // Add Phase-2 conversation threads. If a conversation is tied to a contract
    // we already have in the list, dedupe by upgrading that row's kind.
    conversations.forEach(conv => {
      const matchKey = Object.keys(uniqueContacts).find(k =>
        uniqueContacts[k].contract_id === conv.contract_id
        || uniqueContacts[k].id === conv.enterprise_id
      );
      if (matchKey) {
        // Existing contract row — upgrade it to a conversation so messages
        // load from the Phase-2 endpoint instead of the legacy one.
        uniqueContacts[matchKey].kind = 'conversation';
        uniqueContacts[matchKey].conversation_id = conv.id;
        uniqueContacts[matchKey].lastMessage = conv.last_message || uniqueContacts[matchKey].lastMessage;
        uniqueContacts[matchKey].lastMessageTime = conv.last_message_time || uniqueContacts[matchKey].lastMessageTime;
        uniqueContacts[matchKey].unread = conv.unread_count || 0;
      } else {
        // Standalone conversation — no contract yet.
        const key = `conv-${conv.id}`;
        uniqueContacts[key] = {
          id: conv.enterprise_id,
          conversation_id: conv.id,
          kind: 'conversation',
          name: conv.other_name || 'Enterprise',
          type: 'enterprise',
          lastMessage: conv.last_message || 'New conversation',
          lastMessageTime: conv.last_message_time || conv.created_at,
          unread: conv.unread_count || 0,
          avatar: '🏢',
        };
      }
    });

    return Object.values(uniqueContacts)
      .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
  };

  const contacts = getContactsFromContracts();

  const getMessagesForContact = (contactId) => {
    return messages.filter(m => m.contactId === contactId).map(m => ({
      ...m,
      isOperator: m.sender === 'operator'
    }));
  };

  const uniqueRegions = [...new Set(contracts.map(c => c.region).filter(Boolean))];

  if (loading) {
    return (
      <div style={{
        background: '#0a0a0a',
        minHeight: '100vh',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px'
      }}>
        Loading dashboard...
      </div>
    );
  }

  // Unauthenticated — ProtectedRoute handles redirect, this is a safety net
  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div style={{
        background: '#0a0a0a', minHeight: '100vh', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 20, padding: 40, textAlign: 'center'
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ color: '#ef4444', fontSize: 20, fontWeight: 600 }}>{error}</div>
        <div style={{ color: '#666', fontSize: 14, maxWidth: 400 }}>
          This usually means your operator account wasn't found in the database.
          Try signing up again, or check that the server is running on port 3001.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button onClick={() => { setError(''); setLoading(true); fetchOperatorDataByWallet(); }}
            style={{ background: '#9333ea', border: 'none', color: 'white', padding: '12px 24px', borderRadius: 30, cursor: 'pointer', fontWeight: 600 }}>
            ↻ Retry
          </button>
          <button onClick={() => { logout(); window.location.href = '/signup'; }}
            style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888', padding: '12px 24px', borderRadius: 30, cursor: 'pointer' }}>
            Sign up again
          </button>
          <button onClick={() => { logout(); }}
            style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888', padding: '12px 24px', borderRadius: 30, cursor: 'pointer' }}>
            Go home
          </button>
        </div>
      </div>
    );
  }

  const maskWalletAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'completed': return '#3b82f6';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const positiveFeedback = calculatePositiveFeedback();

  // Single bag of state + handlers passed to each tab. Verbose, but explicit
  // and trivial to reason about — every tab only destructures what it uses.
  const tabCtx = {
    // Dashboard tab
    contracts, operatorData, positiveFeedback,
    handleProfileImageUpload, uploadingImage,
    setShowWithdrawModal, getStatusColor,
    setSelectedContractDetail, updateContractProgress,
    setDisputeFor, fetchMissions,
    // Contracts tab
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    regionFilter, setRegionFilter,
    uniqueRegions, filteredContracts,
    missionsLoading, availableMissions, setAvailableMissions,
    appliedMissionIds, applyingId, applyToMission,
    // Contact tab
    contacts, selectedContact, setSelectedContact,
    getMessagesForContact, messagesEndRef,
    newMessage, handleMessageChange, sendMessage,
  };

  return (
    <>
      <style>{DASHBOARD_STYLES}</style>
      <div className="dashboard-page">
        <div className="sidebar">
          <div className="sidebar-logo">
            <img src={logo} alt="Sol Skies" />
            <span>Sol Skies</span>
          </div>

          <div className="sidebar-nav">
            <div
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="nav-icon">📊</span>
              <span>Dashboard</span>
            </div>
            <div
              className={`nav-item ${activeTab === 'contracts' ? 'active' : ''}`}
              onClick={() => setActiveTab('contracts')}
            >
              <span className="nav-icon">📝</span>
              <span>Contracts</span>
            </div>
            <div
              className={`nav-item ${activeTab === 'contact' ? 'active' : ''}`}
              onClick={() => setActiveTab('contact')}
            >
              <span className="nav-icon">📞</span>
              <span>Contact</span>
            </div>
            <div className={`nav-item ${activeTab === 'weather' ? 'active' : ''}`} onClick={() => setActiveTab('weather')}>
              <span className="nav-icon">🌤️</span>
              <span>Weather</span>
            </div>
            <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <span className="nav-icon">⚙️</span>
              <span>Settings</span>
            </div>

            {/* FIX #2: Home, Logout, and Delete Account buttons */}
            <div className="nav-divider" />

            <div className="nav-item" onClick={() => { window.location.href = '/'; }}>
              <span className="nav-icon">🏠</span>
              <span>Home</span>
            </div>

            <div className="nav-item" onClick={handleLogout}>
              <span className="nav-icon">🚪</span>
              <span>Logout</span>
            </div>

            <div className="nav-item danger" onClick={handleDeleteAccount}>
              <span className="nav-icon">🗑️</span>
              <span>Delete Account</span>
            </div>
          </div>

          {/* FIX #1: Only render wallet address div when publicKey actually exists */}
          <div className="wallet-info-sidebar">
            <div className="wallet-connected-indicator">
              <span className="dot"></span>
              <span>{connected ? 'Wallet Connected' : 'Session Active'}</span>
            </div>
            {publicKey && (
              <div className="wallet-address-small">
                {maskWalletAddress(publicKey.toBase58())}
              </div>
            )}
          </div>
        </div>

        <div className="main-content">
          <div className="content-header">
            <h1>
              {activeTab === 'dashboard' && 'Operator Dashboard'}
              {activeTab === 'contracts' && 'Contracts & Missions'}
              {activeTab === 'contact' && 'Messages'}
              {activeTab === 'weather' && '🌤️ Weather & Hazards'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <div className="header-actions">
              <button className="notification-btn">🔔</button>
            </div>
          </div>

          {activeTab === 'dashboard' && <DashboardTab ctx={tabCtx} />}
          {activeTab === 'contracts' && <ContractsTab ctx={tabCtx} />}
          {activeTab === 'contact'   && <ContactTab   ctx={tabCtx} />}
          {activeTab === 'weather'   && <WeatherTab   operatorData={operatorData} />}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 20, padding: 30, marginBottom: 20 }}>
                <h3 style={{ color: 'white', marginBottom: 20 }}>Account</h3>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 8 }}>Wallet Address</div>
                <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '10px 16px', fontFamily: 'monospace', color: '#22c55e', fontSize: 13, wordBreak: 'break-all', marginBottom: 20 }}>
                  {publicKey?.toBase58() || 'Not connected'}
                </div>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 8 }}>Name</div>
                <div style={{ color: 'white', marginBottom: 20 }}>{operatorData?.full_name || '—'}</div>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 8 }}>Username</div>
                <div style={{ color: 'white', marginBottom: 20 }}>@{operatorData?.username || '—'}</div>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 8 }}>Region</div>
                <div style={{ color: 'white', marginBottom: 20 }}>{operatorData?.region || '—'}</div>
              </div>
              <div style={{ background: '#111', border: '1px solid #ef444430', borderRadius: 20, padding: 30 }}>
                <h3 style={{ color: '#ef4444', marginBottom: 10 }}>Danger Zone</h3>
                <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Deleting your account is permanent and cannot be undone.</p>
                <button
                  onClick={handleDeleteAccount}
                  style={{ background: '#ef444415', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontSize: 14 }}
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Contract Detail Modal */}
      {selectedContractDetail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000
        }} onClick={() => setSelectedContractDetail(null)}>
          <div style={{
            background: '#111', border: '1px solid #333', borderRadius: 24,
            padding: 36, maxWidth: 520, width: '90%', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedContractDetail(null)} style={{
              position: 'absolute', top: 16, right: 20, background: 'none',
              border: 'none', color: '#666', fontSize: 22, cursor: 'pointer'
            }}>✕</button>
            <h2 style={{ color: 'white', marginBottom: 6, fontSize: 22 }}>{selectedContractDetail.title}</h2>
            <div style={{ color: '#9333ea', marginBottom: 20, fontSize: 14 }}>{selectedContractDetail.client_name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[
                ['Status', selectedContractDetail.status],
                ['Region', selectedContractDetail.region || 'N/A'],
                ['Value', `${selectedContractDetail.amount_sol || 0} SOL`],
                ['Progress', `${selectedContractDetail.progress || 0}%`],
                ['Date', selectedContractDetail.created_at ? new Date(selectedContractDetail.created_at).toLocaleDateString() : 'N/A'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 14 }}>
                  <div style={{ color: '#888', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                  <div style={{ color: 'white', fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
            {selectedContractDetail.description && (
              <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>DESCRIPTION</div>
                <div style={{ color: '#ccc', lineHeight: 1.6 }}>{selectedContractDetail.description}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              {selectedContractDetail.status === 'active' && (
                <button onClick={() => {
                  const p = prompt(`Update progress (current: ${selectedContractDetail.progress || 0}%):`, selectedContractDetail.progress || 0);
                  if (p !== null && !isNaN(parseInt(p))) {
                    const val = Math.min(100, Math.max(0, parseInt(p)));
                    updateContractProgress(selectedContractDetail.id, val, val === 100);
                    setSelectedContractDetail(prev => ({ ...prev, progress: val, status: val === 100 ? 'completed' : 'active' }));
                  }
                }} style={{ flex: 1, background: '#9333ea', border: 'none', borderRadius: 12, padding: '12px 0', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  Update Progress
                </button>
              )}
              <button onClick={() => {
                setActiveTab('contact');
                setSelectedContractDetail(null);
              }} style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: '12px 0', color: 'white', cursor: 'pointer', fontSize: 14 }}>
                Open Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Withdraw Modal ──────────────────────────────────────────────────── */}
      {showWithdrawModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 20
        }} onClick={() => setShowWithdrawModal(false)}>
          <div style={{
            background: '#111', border: '1px solid #333', borderRadius: 24,
            padding: 36, maxWidth: 420, width: '100%'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ color: 'white', fontSize: 20 }}>💸 Withdraw Earnings</h2>
              <button onClick={() => setShowWithdrawModal(false)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Available Balance</div>
              <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 24 }}>
                {(operatorData?.total_earned || 0).toFixed(2)} USDC
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: '#ccc', fontSize: 14, marginBottom: 8 }}>Amount to withdraw</div>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
                min="0.01"
                step="0.01"
                max={operatorData?.total_earned || 0}
                style={{
                  width: '100%', padding: '12px 14px',
                  background: '#1a1a1a', border: '1px solid #333',
                  borderRadius: 10, color: 'white', fontSize: 16,
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct}
                    onClick={() => setWithdrawAmount(((operatorData?.total_earned || 0) * pct / 100).toFixed(2))}
                    style={{
                      flex: 1, padding: '6px 0', background: '#1a1a1a',
                      border: '1px solid #333', borderRadius: 8,
                      color: '#888', fontSize: 12, cursor: 'pointer'
                    }}
                  >{pct}%</button>
                ))}
              </div>
            </div>

            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 12, marginBottom: 20, fontSize: 13, color: '#888' }}>
              💡 Funds will be sent to wallet: <span style={{ color: '#9333ea', fontFamily: 'monospace' }}>
                {sessionUser?.walletAddress
                  ? `${sessionUser.walletAddress.slice(0,4)}...${sessionUser.walletAddress.slice(-4)}`
                  : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowWithdrawModal(false)} style={{
                flex: 1, padding: '13px 0', background: 'transparent',
                border: '1px solid #333', borderRadius: 12, color: '#888', cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={handleWithdraw} style={{
                flex: 2, padding: '13px 0',
                background: 'linear-gradient(135deg,#9333ea,#a855f7)',
                border: 'none', borderRadius: 12, color: 'white',
                fontWeight: 700, fontSize: 15, cursor: 'pointer'
              }}>Withdraw</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute modal — Phase 4B */}
      {disputeFor && (
        <DisputeModal
          contractId={disputeFor}
          onClose={() => setDisputeFor(null)}
          onSubmitted={() => {
            // Refresh contracts so any status change is reflected.
            if (operatorData?.id) {
              fetch(`${API_BASE}/api/contracts?operator_id=${operatorData.id}`)
                .then(r => r.json())
                .then(data => Array.isArray(data) && setContracts(data))
                .catch(() => {});
            }
          }}
        />
      )}
    </>
  );
}

export default OperatorDashboard;
