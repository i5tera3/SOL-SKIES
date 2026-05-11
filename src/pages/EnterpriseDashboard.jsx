import { API_BASE } from '../lib/api';
// src/pages/EnterpriseDashboard.jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useSession } from '../Context/sessionContext'; // FIX: correct path + filename
import logo from '../assets/AdobSOL.png'; // FIX: file is at src/pages/ not src/pages/enterprise/
import AddressAutocomplete from '../components/AddressAutocomplete';
import DisputeModal from '../components/DisputeModal';
// Phase 6 — tabs decomposed.
import DashboardTab from './enterprise/tabs/DashboardTab';
import MissionsTab from './enterprise/tabs/MissionsTab';
import HistoryTab from './enterprise/tabs/HistoryTab';
import FindOperatorsTab from './enterprise/tabs/FindOperatorsTab';

// Devnet escrow address — fetched lazily from /api/escrow/info so the frontend
// stays in sync if the server's keypair is regenerated. Cached for the page life.
let _escrowAddressCache = null;
async function fetchEscrowAddress() {
  if (_escrowAddressCache) return _escrowAddressCache;
  const r = await fetch(`${API_BASE}/api/escrow/info`);
  if (!r.ok) throw new Error('Failed to fetch escrow address');
  const { address } = await r.json();
  _escrowAddressCache = address;
  return address;
}

const ENTERPRISE_STYLES = `
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

    /* Sidebar Styles */
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

    .nav-divider {
      height: 1px;
      background: #222;
      margin: 12px 0;
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

    .nav-icon {
      font-size: 20px;
      width: 24px;
      text-align: center;
    }

    .wallet-info-sidebar {
      margin-top: auto;
      padding: 20px 16px;
      background: #1a1a1a;
      border-radius: 12px;
      font-size: 14px;
      border: 1px solid #333;
    }

    .wallet-connected-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      color: #22c55e;
    }

    .dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
    }

    .wallet-address-small {
      font-family: monospace;
      color: #888;
      word-break: break-all;
      font-size: 12px;
      background: #222;
      padding: 8px;
      border-radius: 6px;
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

    /* Wallet Section */
    .wallet-section {
      margin-bottom: 30px;
    }

    .wallet-card-large {
      background: #111111;
      border-radius: 24px;
      padding: 30px;
      border: 1px solid #222;
      box-shadow: 0 10px 30px rgba(147, 51, 234, 0.1);
    }

    .wallet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .wallet-header h3 {
      color: white;
      font-size: 20px;
    }

    .balance-display {
      margin-bottom: 15px;
    }

    .balance-label {
      color: #888;
      font-size: 14px;
      display: block;
      margin-bottom: 5px;
    }

    .balance-amount {
      font-size: 48px;
      font-weight: 700;
      color: white;
      background: linear-gradient(135deg, #fff, #e9d5ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .wallet-address-info {
      color: #666;
      font-size: 14px;
      padding-top: 15px;
      border-top: 1px solid #222;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-top: 20px;
    }

    .stat-card {
      background: #111111;
      border-radius: 16px;
      padding: 20px;
      border: 1px solid #222;
      text-align: center;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: white;
      margin-bottom: 5px;
    }

    .stat-label {
      color: #888;
      font-size: 14px;
    }

    .primary-btn {
      background: #9333ea;
      color: white;
      border: none;
      border-radius: 40px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .primary-btn:hover {
      background: #a855f7;
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(147, 51, 234, 0.3);
    }

    .primary-btn.small {
      padding: 8px 16px;
      font-size: 13px;
    }

    .primary-btn.large {
      padding: 16px 32px;
      font-size: 16px;
      width: 100%;
    }

    .secondary-btn {
      background: transparent;
      color: #888;
      border: 1px solid #333;
      border-radius: 40px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .secondary-btn:hover {
      background: #1a1a1a;
      border-color: #9333ea;
      color: white;
    }

    .section-title {
      font-size: 20px;
      color: white;
      margin-bottom: 20px;
    }

    .missions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }

    .mission-card {
      background: #111111;
      border-radius: 20px;
      padding: 20px;
      border: 1px solid #222;
      transition: all 0.2s ease;
    }

    .mission-card:hover {
      transform: translateY(-2px);
      border-color: #9333ea;
      box-shadow: 0 10px 30px rgba(147, 51, 234, 0.2);
    }

    .mission-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .mission-header h3 {
      color: white;
      font-size: 18px;
    }

    .mission-status {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .mission-type {
      color: #9333ea;
      font-size: 14px;
      margin-bottom: 15px;
    }

    .mission-details {
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
      font-size: 12px;
      margin-bottom: 3px;
    }

    .detail-value {
      color: white;
      font-weight: 500;
    }

    .mission-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }

    .action-btn {
      flex: 1;
      padding: 10px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      background: #222;
      border-color: #9333ea;
    }

    .action-btn.primary {
      background: #9333ea;
      border: none;
    }

    .empty-state {
      background: #111111;
      border-radius: 20px;
      padding: 60px;
      text-align: center;
      border: 1px solid #222;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }

    .empty-state h3 {
      color: white;
      margin-bottom: 10px;
    }

    .empty-state p {
      color: #888;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: #111111;
      border-radius: 24px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      border: 1px solid #333;
    }

    .modal-content.large {
      max-width: 800px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    .modal-content.large .modal-body {
      overflow-y: auto;
      flex: 1;
      margin-bottom: 0;
      padding-bottom: 10px;
    }

    .modal-content.large .modal-footer {
      flex-shrink: 0;
      padding-top: 16px;
      border-top: 1px solid #222;
      margin-top: 8px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .modal-header h2 {
      color: white;
      font-size: 24px;
    }

    .close-btn {
      background: none;
      border: none;
      color: #666;
      font-size: 20px;
      cursor: pointer;
    }

    .close-btn:hover {
      color: white;
    }

    .modal-body {
      margin-bottom: 30px;
    }

    .modal-description {
      color: #888;
      margin-bottom: 20px;
    }

    .suggested-amounts {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }

    .suggested-amounts button {
      flex: 1;
      padding: 10px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      color: #888;
      cursor: pointer;
    }

    .suggested-amounts button:hover {
      border-color: #9333ea;
      color: white;
    }

    .modal-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .form-group {
      margin-bottom: 15px;
    }

    .form-group.full-width {
      grid-column: span 2;
    }

    .form-group label {
      display: block;
      color: #ccc;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 12px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      color: white;
      font-size: 14px;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #9333ea;
    }

    .helper-text {
      color: #666;
      font-size: 12px;
      margin-top: 5px;
    }

    .requirements-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ccc;
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: #9333ea;
    }

    .certifications-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 10px;
    }

    .filters-bar {
      display: flex;
      gap: 15px;
      margin-bottom: 25px;
    }

    .search-input {
      flex: 2;
      padding: 12px 16px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      color: white;
    }

    .filter-select {
      flex: 1;
      padding: 12px 16px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      color: white;
    }

    @media (max-width: 1024px) {
      .sidebar {
        width: 240px;
      }
      .main-content {
        margin-left: 240px;
      }
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .sidebar {
        display: none;
      }
      .main-content {
        margin-left: 0;
      }
    }
  `;

function EnterpriseDashboard() {
  const navigate = useNavigate();
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction, disconnect } = useWallet();
  const { user: sessionUser, isAuthenticated, logout } = useSession();
  
  const [enterpriseData, setEnterpriseData] = useState(null);
  const [balance, setBalance] = useState(0);       // SOL balance (live from devnet)
  const [solPrice, setSolPrice] = useState(null);  // USD price of 1 SOL
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Honor a `?tab=` query so other pages (e.g. ContactOperatorButton's redirect
  // from a public operator profile) can jump directly into the right tab.
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t && ['dashboard', 'missions', 'history', 'find', 'chat', 'settings'].includes(t)) return t;
    } catch {}
    return 'dashboard';
  });
  const [showCreateMissionModal, setShowCreateMissionModal] = useState(false);

  // Fetch live SOL/USD price from CoinGecko (free, no key)
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      .then(r => r.json())
      .then(d => setSolPrice(d?.solana?.usd || null))
      .catch(() => {});
  }, []);

  // Fetch live devnet wallet balance whenever wallet connects
  useEffect(() => {
    if (!publicKey || !connection) return;
    let cancelled = false;
    connection.getBalance(publicKey).then(lamports => {
      if (!cancelled) setBalance(lamports / 1e9);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [publicKey, connection]);

  // Helper: format SOL + USD equivalent
  const formatSolUsd = (sol) => {
    const usd = solPrice ? (sol * solPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) : null;
    return usd ? `${sol.toFixed(4)} SOL ≈ ${usd}` : `${sol.toFixed(4)} SOL`;
  };
  // FIX: isWalletReady removed — was causing stuck loading screen.
  // ProtectedRoute guarantees auth before this component even mounts.

  // Active contracts state (for progress control + rating)
  const [activeContracts, setActiveContracts] = useState([]);
  // Rating modal state
  const [ratingModal, setRatingModal] = useState(null); // { contract }
  const [disputeFor, setDisputeFor] = useState(null);    // contract id, opens DisputeModal
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Applicants modal state
  const [selectedMissionApplicants, setSelectedMissionApplicants] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatContact, setChatContact] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatContracts, setChatContracts] = useState([]);
  const chatEndRef = useRef(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // Escrow state
  const [escrowTx, setEscrowTx] = useState(null);
  const [escrowPending, setEscrowPending] = useState(false);

  // Subtask builder state
  const [subtasks, setSubtasks] = useState([
    { id: 1, name: 'Task 1', description: '', sol_reward: '' }
  ]);

  // Helper: add a subtask row
  const addSubtask = () => setSubtasks(prev => [
    ...prev,
    { id: Date.now(), name: `Task ${prev.length + 1}`, description: '', sol_reward: '' }
  ]);
  const removeSubtask = (id) => setSubtasks(prev => prev.filter(s => s.id !== id));
  const updateSubtask = (id, field, value) =>
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

  // Total reward = sum of subtask rewards
  const subtaskTotal = subtasks.reduce((sum, s) => sum + (parseFloat(s.sol_reward) || 0), 0);

  // New Mission Form State
  const [newMission, setNewMission] = useState({
    title: '',
    missionType: 'inspection',
    region: '',
    address: '',
    latitude: '',
    longitude: '',
    description: '',
    reward: '',
    operators_needed: 1,
    requirements: {
      licenseRequired: true,
      minFlightHours: 50,
      droneType: 'any',
      certificationsRequired: [],
      insuranceRequired: true
    }
  });

  // Mission types
  const missionTypes = [
    { value: 'inspection', label: 'Infrastructure Inspection' },
    { value: 'mapping', label: 'Aerial Mapping' },
    { value: 'surveillance', label: 'Security Surveillance' },
    { value: 'delivery', label: 'Package Delivery' },
    { value: 'agriculture', label: 'Agriculture Analysis' },
    { value: 'emergency', label: 'Emergency Response' },
    { value: 'thermal', label: 'Thermal Imaging' },
    { value: 'photography', label: 'Photography/Video' }
  ];

  // Drone types
  const droneTypes = [
    { value: 'any', label: 'Any Drone' },
    { value: 'short_range', label: 'Short Range (< 5km)' },
    { value: 'medium_range', label: 'Medium Range (5-15km)' },
    { value: 'long_range', label: 'Long Range (> 15km)' },
    { value: 'thermal', label: 'Thermal Capable' },
    { value: 'mapping', label: 'Mapping/GIS Capable' }
  ];

  // Certifications
  const certifications = [
    { value: 'faas', label: 'FAA Part 107 (US)' },
    { value: 'easa', label: 'EASA (Europe)' },
    { value: 'caa', label: 'CAA (UK)' },
    { value: 'night_flight', label: 'Night Flight Certified' },
    { value: 'bylos', label: 'BVLOS Certified' },
    { value: 'thermal', label: 'Thermal Certification' }
  ];

  // Countries list for region dropdown
  const countries = [
    "United States", "Canada", "Mexico", "United Kingdom", "Germany", "France", 
    "Spain", "Italy", "Netherlands", "Belgium", "Switzerland", "Austria", 
    "Sweden", "Norway", "Denmark", "Finland", "Ireland", "Portugal", "Greece",
    "Poland", "Czech Republic", "Hungary", "Australia", "New Zealand", 
    "Japan", "South Korea", "China", "India", "Singapore", "Malaysia", 
    "Thailand", "Vietnam", "Indonesia", "Philippines", "South Africa", 
    "Nigeria", "Kenya", "Egypt", "Morocco", "UAE", "Saudi Arabia", "Israel",
    "Turkey", "Brazil", "Argentina", "Chile", "Colombia", "Peru", "Venezuela"
  ].sort();

  // FIX: Removed redundant auth-guard useEffect that called navigate('/login').
  // ProtectedRoute already blocks unauthenticated access. The internal guard
  // competed with logout()'s window.location.replace(), causing freeze/loops.

  // Fetch enterprise data on mount (ProtectedRoute guarantees isAuthenticated=true here)
  useEffect(() => {
    if (!sessionUser?.id) return;
    let isMounted = true;
    // FIX: Removed 100ms artificial delay — no reason to wait
    fetchEnterpriseData(sessionUser.id, isMounted);
    fetchActiveContracts(sessionUser.id, isMounted);
    return () => { isMounted = false; };
  // sessionUser.id is stable (comes from localStorage); no deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.id]);

  const fetchEnterpriseData = async (userId, isMounted = true) => {
    if (isMounted) setLoading(true);
    try {
      // Parallelize both requests — no need to wait for enterprise before fetching missions
      const [enterpriseResponse, missionsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/enterprises/${userId}`),
        fetch(`${API_BASE}/api/missions?enterprise_id=${userId}`)
      ]);

      if (!isMounted) return;

      if (enterpriseResponse.ok) {
        const data = await enterpriseResponse.json();
        if (isMounted) {
          setEnterpriseData(data);
          // balance is set from live wallet, not DB
        }
      } else if (enterpriseResponse.status === 404) {
        // Enterprise not in DB — stale session, force re-signup
        logout(); // logout() handles redirect via window.location.replace('/?loggedOut=1')
        return;
      }

      if (missionsResponse.ok) {
        const data = await missionsResponse.json();
        if (isMounted) setMissions(data || []);
      }
    } catch (error) {
      console.error('Error fetching enterprise data:', error);
      if (isMounted) setError('Failed to load dashboard data');
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  // Fetch active contracts for this enterprise (progress control + rating)
  const fetchActiveContracts = async (userId, isMounted = true) => {
    try {
      const res = await fetch(`${API_BASE}/api/contracts?enterprise_id=${userId}&status=active`);
      if (!isMounted) return;
      if (res.ok) {
        const data = await res.json();
        if (isMounted) setActiveContracts(data || []);
      }
    } catch (err) {
      console.error('fetchActiveContracts:', err);
    }
  };

  // Update contract progress (enterprise side — tracks operator progress)
  const updateContractProgress = async (contractId, progress) => {
    try {
      await fetch(`${API_BASE}/api/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: parseInt(progress) })
      });
      setActiveContracts(prev => prev.map(c =>
        c.id === contractId ? { ...c, progress: parseInt(progress) } : c
      ));
    } catch (err) {
      console.error('updateContractProgress:', err);
    }
  };

  // Open rating modal
  const openRatingModal = (contract) => {
    setRatingModal(contract);
    setRatingStars(5);
    setRatingComment('');
  };

  // Submit rating + complete contract + release escrow payment to operator
  const submitRating = async () => {
    if (!ratingModal) return;
    setRatingSubmitting(true);
    try {
      // 1. Mark contract complete + save rating
      const res = await fetch(`${API_BASE}/api/contracts/${ratingModal.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: ratingStars, comment: ratingComment })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to complete: ${err.error || 'Server error'}`);
        return;
      }

      // 2. Release escrow payment to operator on devnet
      let payoutMsg = '';
      try {
        const payRes = await fetch(`${API_BASE}/api/contracts/${ratingModal.id}/release-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (payRes.ok) {
          const payData = await payRes.json();
          payoutMsg = `\n💸 ${payData.paid_sol} SOL sent to operator on devnet.\nTx: https://explorer.solana.com/tx/${payData.signature}?cluster=devnet`;
        }
      } catch (payErr) {
        console.warn('Payout request failed (non-fatal):', payErr.message);
        payoutMsg = '\n⚠️ On-chain payout failed — check escrow balance.';
      }

      setActiveContracts(prev => prev.filter(c => c.id !== ratingModal.id));
      if (sessionUser?.id) fetchEnterpriseData(sessionUser.id);
      setRatingModal(null);
      alert(`✅ Contract completed! Operator rated ${ratingStars} ★${payoutMsg}`);
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  // Refresh live wallet SOL balance (called after successful escrow deposit)
  const refreshWalletBalance = async () => {
    if (!publicKey || !connection) return;
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / 1e9);
    } catch (_) {}
  };

  // Handle certification checkbox changes
  const handleCertificationChange = (certValue) => {
    setNewMission(prev => {
      const current = prev.requirements.certificationsRequired;
      const updated = current.includes(certValue)
        ? current.filter(c => c !== certValue)
        : [...current, certValue];
      
      return {
        ...prev,
        requirements: {
          ...prev.requirements,
          certificationsRequired: updated
        }
      };
    });
  };

  // Create new mission — with real devnet on-chain SOL escrow deposit
  const handleCreateMission = async () => {
    if (!newMission.title || !newMission.region) {
      alert('Please fill in all required fields (title + region)');
      return;
    }

    // Validate subtasks — must have at least one with a name and reward
    const validSubtasks = subtasks.filter(s => s.name.trim() && parseFloat(s.sol_reward) > 0);
    if (validSubtasks.length === 0) {
      alert('Please define at least one subtask with a name and SOL reward');
      return;
    }

    const rewardSol = parseFloat(subtaskTotal.toFixed(6));
    if (isNaN(rewardSol) || rewardSol <= 0) {
      alert('Total subtask rewards must be greater than 0 SOL');
      return;
    }

    if (!connected || !publicKey) {
      alert('Please connect your Solana wallet first');
      return;
    }

    setEscrowPending(true);
    let createdMission = null;

    try {
      // ── Step 1: Create mission in DB (get an ID) ───────────────────────────
      const missionData = {
        ...newMission,
        enterprise_id: sessionUser?.id,
        enterprise_name: enterpriseData?.company_name,
        reward: rewardSol,
        status: 'open',
        created_at: Date.now(),
        escrow_status: 'pending',
        operators_needed: parseInt(newMission.operators_needed) || validSubtasks.length,
        subtasks: validSubtasks.map((s, i) => ({
          id: `sub_${Date.now()}_${i}`,
          name: s.name.trim(),
          description: s.description.trim(),
          sol_reward: parseFloat(s.sol_reward),
          status: 'open',
          claimed_by: null,
          claimed_by_name: null,
          claimed_at: null,
        })),
      };

      const missionRes = await fetch(`${API_BASE}/api/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(missionData),
      });

      if (!missionRes.ok) {
        // Surface the server's real error so future bugs are diagnosable in one shot.
        let detail = 'Server rejected the request';
        try {
          const err = await missionRes.json();
          detail = err.message || err.error || detail;
          if (err.field) detail = `${err.field}: ${err.message || detail}`;
        } catch {}
        throw new Error(detail);
      }
      createdMission = await missionRes.json();

      // ── Step 2: Build SOL transfer to escrow ──────────────────────────────
      const lamports = Math.round(rewardSol * LAMPORTS_PER_SOL);
      const escrowPubkey = new PublicKey(await fetchEscrowAddress());

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: escrowPubkey,
          lamports,
        })
      );

      // ── Step 3: Ask wallet to sign & send ─────────────────────────────────
      const signature = await sendTransaction(tx, connection);

      // ── Step 4: Wait for confirmation ─────────────────────────────────────
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      // ── Step 5: Verify deposit server-side, stamp mission ─────────────────
      const verifyRes = await fetch(`${API_BASE}/api/escrow/verify-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txSignature: signature,
          fromWallet: publicKey.toBase58(),
          missionId: createdMission.id,
          expectedSol: rewardSol,
        }),
      });

      setEscrowTx(signature);

      if (verifyRes.ok) {
        createdMission = (await verifyRes.json()).mission || createdMission;
      }

      // ── Update UI ─────────────────────────────────────────────────────────
      setMissions(prev => [createdMission, ...prev]);
      refreshWalletBalance(); // pull fresh devnet balance after SOL left wallet
      setShowCreateMissionModal(false);

      setNewMission({
        title: '', missionType: 'inspection', region: '',
        address: '', latitude: '', longitude: '',
        description: '', reward: '', operators_needed: 1,
        requirements: {
          licenseRequired: true, minFlightHours: 50, droneType: 'any',
          certificationsRequired: [], insuranceRequired: true
        }
      });
      setSubtasks([{ id: 1, name: 'Task 1', description: '', sol_reward: '' }]);

      alert(
        `✅ Mission created & ${rewardSol} SOL locked in escrow!\n` +
        `Tx: ${signature.slice(0, 12)}…\n` +
        `View: https://explorer.solana.com/tx/${signature}?cluster=devnet`
      );

    } catch (error) {
      console.error('Create mission error:', error);
      // If mission was created but tx failed, delete orphaned mission
      if (createdMission?.id) {
        try {
          await fetch(`${API_BASE}/api/missions/${createdMission.id}`, { method: 'DELETE' }).catch(() => {});
        } catch (_) {}
      }
      if (error.name === 'WalletSignTransactionError' || error.message?.includes('User rejected')) {
        alert('Transaction cancelled — mission was not created.');
      } else if (
        error.message?.includes('insufficient') ||
        error.message?.includes('0x1') ||
        error.message?.includes('funds') ||
        error.message?.includes('lamports')
      ) {
        alert(
          '❌ Insufficient devnet SOL in your wallet.\n\n' +
          'This is a devnet transaction — you need free devnet SOL:\n\n' +
          '1. Go to https://faucet.solana.com\n' +
          '2. Paste your wallet address\n' +
          '3. Select Devnet → Request 5 SOL\n\n' +
          'Or in Phantom: Settings → Developer Settings → Switch to Devnet → Airdrop.'
        );
      } else {
        alert(`Failed to create mission: ${error.message}`);
      }
    } finally {
      setEscrowPending(false);
    }
  };

  // ── Chat sidebar feed ──────────────────────────────────────────────────────
  // Two parallel message systems exist in this codebase:
  //   1. Legacy per-contract messages       — /api/messages keyed by contract_id
  //   2. Phase-2 conversation threads       — /api/conversations[/<id>/messages]
  // The "Message" button on operator profile creates a Phase-2 conversation
  // (which can exist BEFORE any contract). To make the sidebar show both,
  // fetch both feeds and stamp each row with a `kind` so handlers route correctly.
  const fetchChatFeed = async () => {
    if (!sessionUser?.id) return;
    try {
      const [contractsRes, convsRes] = await Promise.all([
        fetch(`${API_BASE}/api/contracts?enterprise_id=${sessionUser.id}`),
        fetch(`${API_BASE}/api/conversations?user_id=${sessionUser.id}&role=enterprise`),
      ]);
      const contracts = contractsRes.ok ? await contractsRes.json() : [];
      const convs     = convsRes.ok     ? await convsRes.json()     : [];

      // Conversations linked to contracts dedupe against the contracts list.
      const convContractIds = new Set(convs.map(c => c.contract_id).filter(Boolean));
      const contractRows = (Array.isArray(contracts) ? contracts : [])
        .filter(c => !convContractIds.has(c.id))
        .map(c => ({
          id: c.id, kind: 'contract',
          title: c.title || 'Contract',
          subtitle: c.operator_username ? `@${c.operator_username}` : (c.operator_id?.slice(0,8) + '…'),
          operator_id: c.operator_id,
          last_message_time: c.created_at,
        }));
      const convRows = (Array.isArray(convs) ? convs : []).map(c => ({
        id: c.id, kind: 'conversation',
        title: c.other_name || 'Operator',
        subtitle: c.last_message ? c.last_message.slice(0, 40) : 'New conversation',
        operator_id: c.operator_id,
        contract_id: c.contract_id,
        last_message_time: c.last_message_time || c.created_at,
        unread_count: c.unread_count || 0,
      }));

      // Newest activity first.
      const merged = [...convRows, ...contractRows]
        .sort((a, b) => (b.last_message_time || 0) - (a.last_message_time || 0));
      setChatContracts(merged);
    } catch (err) { console.error('fetchChatFeed:', err); }
  };
  // Keep the old name as an alias so the existing effect/callers don't break.
  const fetchChatContracts = fetchChatFeed;

  // Normalize a server message row (legacy or Phase-2) into one shape the
  // render code can use unconditionally.
  const normalizeMessage = (m, kind) => ({
    id: m.id,
    body: m.text ?? m.content ?? '',
    sender_kind: (m.sender_type || m.sender_role) === 'enterprise' ? 'mine' : 'theirs',
    timestamp: m.timestamp,
  });

  const loadChatMessages = async (item) => {
    setChatContact(item);
    try {
      const url = item.kind === 'conversation'
        ? `${API_BASE}/api/conversations/${item.id}/messages`
        : `${API_BASE}/api/messages/${item.id}`;
      const res = await fetch(url);
      const data = await res.json();
      setChatMessages((data || []).map(m => normalizeMessage(m, item.kind)));
    } catch (err) { console.error('loadChatMessages:', err); }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !chatContact) return;
    const text = chatInput;
    setChatInput('');
    try {
      let res;
      if (chatContact.kind === 'conversation') {
        res = await fetch(`${API_BASE}/api/conversations/${chatContact.id}/messages`, {
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
            contract_id: chatContact.id,
            sender_type: 'enterprise',
            sender_id: sessionUser?.id,
            text,
          }),
        });
      }
      if (res.ok) {
        const msg = await res.json();
        setChatMessages(prev => [...prev, normalizeMessage(msg, chatContact.kind)]);
      }
    } catch (err) { console.error('sendChatMessage:', err); }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Fetch chat contracts when switching to chat tab
  useEffect(() => {
    if (activeTab !== 'chat') return;
    let isMounted = true;
    fetchChatContracts().catch(() => {});
    return () => { isMounted = false; };
  }, [activeTab]);

  const fetchApplicants = async (mission) => {
    setSelectedMissionApplicants(mission);
    setLoadingApplicants(true);
    try {
      const res = await fetch(`${API_BASE}/api/missions/${mission.id}/applications`);
      const data = await res.json();
      setApplicants(data || []);
    } catch (err) {
      console.error('Error fetching applicants:', err);
      setApplicants([]);
    } finally {
      setLoadingApplicants(false);
    }
  };

  const approveApplicant = async (applicationId) => {
    try {
      await fetch(`${API_BASE}/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      // Refresh applicants list
      setApplicants(prev => prev.map(a => a.id === applicationId ? { ...a, status: 'approved' } : a));
    } catch (err) {
      alert('Failed to approve. Please try again.');
    }
  };

  const rejectApplicant = async (applicationId) => {
    try {
      await fetch(`${API_BASE}/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      setApplicants(prev => prev.map(a => a.id === applicationId ? { ...a, status: 'rejected' } : a));
    } catch (err) {
      alert('Failed to reject. Please try again.');
    }
  };

  const handleLogout = async () => {
    // logout() in sessionContext now handles EVERYTHING:
    //   1. Clears localStorage
    //   2. Attempts wallet disconnect (window.solana)
    //   3. window.location.replace('/?loggedOut=1')  ← prevents auto-reconnect loop
    // We also attempt the adapter-level disconnect here as a belt-and-suspenders.
    try { await disconnect(); } catch (_) {}
    logout();
    // No navigate() here — logout() does a hard redirect that beats any navigate()
  };

  const maskWalletAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'open': return '#22c55e';
      case 'assigned': return '#3b82f6';
      case 'completed': return '#8b5cf6';
      case 'expired': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Filter missions by status
  const activeMissions = missions.filter(m => m.status === 'open' || m.status === 'assigned');
  const completedMissions = missions.filter(m => m.status === 'completed' || m.status === 'expired');

  // FIX: removed !isWalletReady from gate — it was causing permanent stuck loading screen.
  // Only gate on actual data loading now.
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

  if (error) {
    return (
      <div style={{ 
        background: '#0a0a0a', 
        minHeight: '100vh', 
        color: '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px'
      }}>
        {error}
      </div>
    );
  }

  // Phase 6 — single ctx bag passed to each tab. Each tab destructures only
  // what it actually uses; the parent stays the source of truth.
  const tabCtx = {
    // DashboardTab
    balance, refreshWalletBalance, solPrice,
    publicKey, maskWalletAddress,
    missions, activeMissions, completedMissions,
    setShowCreateMissionModal,
    activeContracts, updateContractProgress,
    openRatingModal, setDisputeFor,
    fetchApplicants,
    // MissionsTab + HistoryTab use subsets of the above (missions, completedMissions)
  };

  return (
    <>
      <style>{ENTERPRISE_STYLES}</style>
      <div className="dashboard-page">
        {/* Sidebar */}
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
              className={`nav-item ${activeTab === 'missions' ? 'active' : ''}`}
              onClick={() => setActiveTab('missions')}
            >
              <span className="nav-icon">📋</span>
              <span>All Missions</span>
            </div>
            <div 
              className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <span className="nav-icon">📜</span>
              <span>History</span>
            </div>
            <div className={`nav-item ${activeTab === 'find' ? 'active' : ''}`} onClick={() => setActiveTab('find')}>
              <span className="nav-icon">🔎</span>
              <span>Find Operators</span>
            </div>
            <div className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
              <span className="nav-icon">💬</span>
              <span>Messages</span>
            </div>
            <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <span className="nav-icon">⚙️</span>
              <span>Settings</span>
            </div>

            <div className="nav-divider" style={{ margin: '12px 0' }} />

            <div className="nav-item" onClick={handleLogout}>
              <span className="nav-icon">🚪</span>
              <span>Logout</span>
            </div>
          </div>

          <div className="wallet-info-sidebar">
            <div className="wallet-connected-indicator">
              <span className="dot"></span>
              <span>Wallet Connected</span>
            </div>
            <div className="wallet-address-small">
              {maskWalletAddress(publicKey?.toBase58())}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          <div className="content-header">
            <h1>
              {activeTab === 'dashboard' && 'Enterprise Dashboard'}
              {activeTab === 'missions' && 'All Missions'}
              {activeTab === 'history' && 'Mission History'}
              {activeTab === 'find' && '🔎 Find Operators'}
              {activeTab === 'chat' && 'Messages'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <div className="header-actions">
              <button className="notification-btn">🔔</button>
            </div>
          </div>

          {activeTab === 'dashboard' && <DashboardTab ctx={tabCtx} />}
          {activeTab === 'missions'  && <MissionsTab  ctx={tabCtx} />}
          {activeTab === 'history'   && <HistoryTab   ctx={tabCtx} />}
          {activeTab === 'find'      && <FindOperatorsTab />}
          {activeTab === 'chat' && (
            <div style={{ display: 'flex', height: 'calc(100vh - 140px)', background: '#111', border: '1px solid #222', borderRadius: 20, overflow: 'hidden' }}>
              {/* Left: contract/operator list */}
              <div style={{ width: 280, borderRight: '1px solid #222', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', color: 'white', fontWeight: 600 }}>
                  Conversations ({chatContracts.length})
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {chatContracts.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#555', fontSize: 14 }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
                      No active contracts yet.<br />Approve an operator to start chatting.
                    </div>
                  ) : chatContracts.map(c => (
                    <div key={`${c.kind}-${c.id}`}
                      onClick={() => loadChatMessages(c)}
                      style={{
                        padding: '14px 18px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer',
                        background: chatContact?.id === c.id ? '#1a1a1a' : 'transparent',
                        transition: 'background .15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                      onMouseLeave={e => { if (chatContact?.id !== c.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{c.title || 'Contract'}</div>
                        {c.unread_count > 0 && (
                          <span style={{
                            background: '#9333ea', color: 'white',
                            borderRadius: '50%', minWidth: 18, height: 18,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, padding: '0 6px',
                          }}>{c.unread_count}</span>
                        )}
                      </div>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        {c.kind === 'conversation' ? '💬' : '📜'} {c.subtitle}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Right: chat area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {chatContact ? (
                  <>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#9333ea,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>O</div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{chatContact.title}</div>
                        <div style={{ color: '#22c55e', fontSize: 12 }}>● Active contract</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {chatMessages.length === 0 && (
                        <div style={{ color: '#555', textAlign: 'center', marginTop: 40, fontSize: 14 }}>No messages yet. Say hello!</div>
                      )}
                      {chatMessages.map(msg => {
                        const isMine = msg.sender_kind === 'mine';
                        return (
                          <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                              maxWidth: '70%', padding: '10px 14px',
                              background: isMine ? '#9333ea' : '#1a1a1a',
                              border: isMine ? 'none' : '1px solid #333',
                              borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              color: 'white'
                            }}>
                              <div style={{ fontSize: 14, marginBottom: 4 }}>{msg.body}</div>
                              <div style={{ fontSize: 11, opacity: 0.6 }}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                    <div style={{ padding: '14px 20px', borderTop: '1px solid #222', display: 'flex', gap: 10 }}>
                      <input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                        placeholder="Type a message…"
                        style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 30, padding: '10px 18px', color: 'white', fontSize: 14, outline: 'none' }}
                      />
                      <button onClick={sendChatMessage} style={{ background: '#9333ea', border: 'none', borderRadius: '50%', width: 42, height: 42, color: 'white', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>➤</button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 15 }}>
                    Select a contract to start messaging
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 20, padding: 30, marginBottom: 20 }}>
                <h3 style={{ color: 'white', marginBottom: 20 }}>Company Details</h3>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>Company</div>
                <div style={{ color: 'white', marginBottom: 16 }}>{enterpriseData?.company_name || '—'}</div>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>Contact</div>
                <div style={{ color: 'white', marginBottom: 16 }}>{enterpriseData?.contact_name || '—'}</div>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>Email</div>
                <div style={{ color: 'white', marginBottom: 16 }}>{enterpriseData?.contact_email || '—'}</div>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>Industry</div>
                <div style={{ color: 'white', marginBottom: 16 }}>{enterpriseData?.industry || '—'}</div>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>Wallet</div>
                <div style={{ fontFamily: 'monospace', color: '#22c55e', fontSize: 13, wordBreak: 'break-all' }}>{publicKey?.toBase58() || '—'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {/* Create Mission Modal — inline JSX (not a sub-component) so inputs keep focus on each keystroke */}
      {showCreateMissionModal && (
        <div className="modal-overlay" onClick={() => setShowCreateMissionModal(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Mission</h2>
              <button className="close-btn" onClick={() => setShowCreateMissionModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Mission Title *</label>
                  <input
                    type="text"
                    value={newMission.title}
                    onChange={(e) => setNewMission({...newMission, title: e.target.value})}
                    placeholder="e.g. Pipeline Inspection - North District"
                  />
                </div>

                <div className="form-group">
                  <label>Mission Type *</label>
                  <select
                    value={newMission.missionType}
                    onChange={(e) => setNewMission({...newMission, missionType: e.target.value})}
                  >
                    {missionTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Region *</label>
                  <select
                    value={newMission.region}
                    onChange={(e) => setNewMission({...newMission, region: e.target.value})}
                  >
                    <option value="">Select region</option>
                    {countries.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>

                {/* Address / location */}
                <div className="form-group full-width">
                  <label>Mission Location</label>
                  <AddressAutocomplete
                    value={newMission.address}
                    onChange={({ address, lat, lng }) => setNewMission(prev => ({
                      ...prev, address, latitude: lat, longitude: lng
                    }))}
                    placeholder="Search city, address, or landmark…"
                  />
                  {newMission.latitude && newMission.longitude && (
                    <div style={{ fontSize: 12, color: '#9333ea', marginTop: 6 }}>
                      📍 {parseFloat(newMission.latitude).toFixed(5)}, {parseFloat(newMission.longitude).toFixed(5)}
                    </div>
                  )}
                </div>

                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={newMission.description}
                    onChange={(e) => setNewMission({...newMission, description: e.target.value})}
                    placeholder="Describe the mission requirements, objectives, and any special instructions..."
                    rows="3"
                  />
                </div>

                {/* Operators needed */}
                <div className="form-group">
                  <label>Operators Needed</label>
                  <input
                    type="number"
                    min="1" max="20"
                    value={newMission.operators_needed}
                    onChange={(e) => {
                      const n = Math.max(1, parseInt(e.target.value) || 1);
                      setNewMission(prev => ({ ...prev, operators_needed: n }));
                      // Auto-grow subtask list to match
                      setSubtasks(prev => {
                        if (n > prev.length) {
                          const extras = Array.from({ length: n - prev.length }, (_, i) => ({
                            id: Date.now() + i,
                            name: `Task ${prev.length + i + 1}`,
                            description: '',
                            sol_reward: ''
                          }));
                          return [...prev, ...extras];
                        }
                        return prev.slice(0, n);
                      });
                    }}
                  />
                  <div className="helper-text">Each operator gets one subtask below</div>
                </div>
              </div>

              {/* ── Subtask / Pay Split Builder ─────────────────────────────── */}
              <div style={{ margin: '20px 0', background: '#0d0d1a', border: '1px solid #9333ea33', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ color: '#c084fc', fontSize: 16, margin: 0 }}>
                    📋 Subtasks & Pay Split
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: subtaskTotal > 0 ? '#22c55e' : '#888' }}>
                      Total: <strong>{subtaskTotal.toFixed(4)} SOL</strong>
                    </span>
                    <button
                      type="button"
                      onClick={addSubtask}
                      style={{ background: '#9333ea', border: 'none', color: 'white', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
                    >
                      + Add Task
                    </button>
                  </div>
                </div>
                <p style={{ color: '#666', fontSize: 12, marginBottom: 14 }}>
                  Each subtask is claimable by exactly one operator. Once claimed, it's locked — other operators can't take it.
                </p>

                {subtasks.map((sub, idx) => (
                  <div key={sub.id} style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ flex: '2 1 180px' }}>
                        <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Task Name</div>
                        <input
                          type="text"
                          value={sub.name}
                          onChange={e => updateSubtask(sub.id, 'name', e.target.value)}
                          placeholder={`e.g. Zone ${idx + 1} Inspection`}
                          style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 13 }}
                        />
                      </div>
                      <div style={{ flex: '3 1 220px' }}>
                        <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Description</div>
                        <input
                          type="text"
                          value={sub.description}
                          onChange={e => updateSubtask(sub.id, 'description', e.target.value)}
                          placeholder="What does this subtask cover?"
                          style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 13 }}
                        />
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>SOL Reward</div>
                        <input
                          type="number"
                          min="0" step="0.001"
                          value={sub.sol_reward}
                          onChange={e => updateSubtask(sub.id, 'sol_reward', e.target.value)}
                          placeholder="0.05"
                          style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: '#22c55e', fontSize: 13 }}
                        />
                      </div>
                      {subtasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSubtask(sub.id)}
                          style={{ alignSelf: 'flex-end', marginBottom: 2, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, padding: '4px 6px' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ margin: '20px 0 15px', color: '#ccc' }}>Operator Requirements</h3>

              <div className="requirements-grid">
                <div className="requirement-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newMission.requirements.licenseRequired}
                      onChange={(e) => setNewMission({
                        ...newMission,
                        requirements: {...newMission.requirements, licenseRequired: e.target.checked}
                      })}
                    />
                    License Required
                  </label>
                </div>

                <div className="requirement-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newMission.requirements.insuranceRequired}
                      onChange={(e) => setNewMission({
                        ...newMission,
                        requirements: {...newMission.requirements, insuranceRequired: e.target.checked}
                      })}
                    />
                    Insurance Required
                  </label>
                </div>

                <div className="form-group">
                  <label>Minimum Flight Hours</label>
                  <input
                    type="number"
                    value={newMission.requirements.minFlightHours}
                    onChange={(e) => setNewMission({
                      ...newMission,
                      requirements: {...newMission.requirements, minFlightHours: parseInt(e.target.value) || 0}
                    })}
                    placeholder="e.g. 50"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Required Drone Type</label>
                  <select
                    value={newMission.requirements.droneType}
                    onChange={(e) => setNewMission({
                      ...newMission,
                      requirements: {...newMission.requirements, droneType: e.target.value}
                    })}
                  >
                    {droneTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Required Certifications</label>
                  <div className="certifications-grid">
                    {certifications.map(cert => (
                      <label key={cert.value} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newMission.requirements.certificationsRequired.includes(cert.value)}
                          onChange={() => handleCertificationChange(cert.value)}
                        />
                        {cert.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {/* Escrow info banner */}
              {subtaskTotal > 0 && (
                <div style={{
                  background: 'rgba(147,51,234,0.12)', border: '1px solid #9333ea33',
                  borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#c084fc',
                  marginRight: 'auto', maxWidth: 360
                }}>
                  🔐 <strong>{subtaskTotal.toFixed(4)} SOL</strong> across {subtasks.filter(s=>parseFloat(s.sol_reward)>0).length} subtask(s) locked in escrow.
                  Each operator is paid their subtask amount on completion.
                </div>
              )}
              <button className="secondary-btn" onClick={() => setShowCreateMissionModal(false)} disabled={escrowPending}>Cancel</button>
              <button
                className="primary-btn"
                onClick={handleCreateMission}
                disabled={escrowPending}
                style={escrowPending ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
              >
                {escrowPending ? '⏳ Signing transaction…' : '✈️ Create Mission & Lock SOL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Applicants Modal */}
      {selectedMissionApplicants && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: 20
        }} onClick={() => setSelectedMissionApplicants(null)}>
          <div style={{
            background: '#111', border: '1px solid #333', borderRadius: 24,
            padding: 32, maxWidth: 660, width: '100%', maxHeight: '80vh',
            overflowY: 'auto', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedMissionApplicants(null)} style={{
              position: 'absolute', top: 16, right: 20, background: 'none',
              border: 'none', color: '#666', fontSize: 22, cursor: 'pointer'
            }}>✕</button>
            <h2 style={{ color: 'white', marginBottom: 4, fontSize: 20 }}>Applicants</h2>
            <div style={{ color: '#9333ea', marginBottom: 24, fontSize: 14 }}>{selectedMissionApplicants.title}</div>
            {loadingApplicants ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>Loading applicants...</div>
            ) : applicants.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                No applications yet for this mission.
              </div>
            ) : (
              applicants.map(app => (
                <div key={app.id} style={{
                  background: '#1a1a1a', border: '1px solid #333', borderRadius: 16,
                  padding: 20, marginBottom: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>{app.operator_name || 'Operator'}</div>
                      <div style={{ color: '#888', fontSize: 13 }}>@{app.operator_username || '—'}</div>
                    </div>
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: app.status === 'approved' ? '#22c55e20' : app.status === 'rejected' ? '#ef444420' : '#f59e0b20',
                      color: app.status === 'approved' ? '#22c55e' : app.status === 'rejected' ? '#ef4444' : '#f59e0b',
                      border: `1px solid ${app.status === 'approved' ? '#22c55e30' : app.status === 'rejected' ? '#ef444430' : '#f59e0b30'}`
                    }}>
                      {app.status || 'pending'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      ['Region', app.operator_region || '—'],
                      ['Experience', app.operator_experience || '—'],
                      ['Rating', app.operator_rating ? `★ ${app.operator_rating}` : '—'],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: 10 }}>
                        <div style={{ color: '#888', fontSize: 11, marginBottom: 3 }}>{label}</div>
                        <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {app.operator_drone_model && (
                    <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>🚁 {app.operator_drone_model}</div>
                  )}
                  {app.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => approveApplicant(app.id)} style={{
                        flex: 1, background: '#22c55e15', border: '1px solid #22c55e',
                        borderRadius: 10, padding: '10px 0', color: '#22c55e',
                        fontWeight: 600, cursor: 'pointer', fontSize: 14
                      }}>✓ Approve</button>
                      <button onClick={() => rejectApplicant(app.id)} style={{
                        flex: 1, background: '#ef444415', border: '1px solid #ef4444',
                        borderRadius: 10, padding: '10px 0', color: '#ef4444',
                        fontWeight: 600, cursor: 'pointer', fontSize: 14
                      }}>✕ Reject</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Rating Modal ───────────────────────────────────────────────────── */}
      {ratingModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 20
        }} onClick={() => !ratingSubmitting && setRatingModal(null)}>
          <div style={{
            background: '#111', border: '1px solid #333', borderRadius: 24,
            padding: 36, maxWidth: 480, width: '100%'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: '#9333ea', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>COMPLETE CONTRACT</div>
              <h2 style={{ color: 'white', fontSize: 20, marginBottom: 4 }}>{ratingModal.title}</h2>
              <div style={{ color: '#888', fontSize: 14 }}>
                Operator: {ratingModal.operator_name || 'Operator'}
                {ratingModal.operator_username && ` (@${ratingModal.operator_username})`}
              </div>
            </div>

            {/* Star selector */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: '#ccc', fontSize: 14, marginBottom: 12 }}>Rate the operator's performance</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star}
                    onClick={() => setRatingStars(star)}
                    style={{
                      fontSize: 32, background: 'none', border: 'none',
                      cursor: 'pointer', transition: 'transform .15s',
                      color: star <= ratingStars ? '#f59e0b' : '#333',
                      transform: star <= ratingStars ? 'scale(1.15)' : 'scale(1)'
                    }}
                  >★</button>
                ))}
              </div>
              <div style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
                {['', 'Poor', 'Below average', 'Good', 'Very good', 'Excellent'][ratingStars]}
              </div>
            </div>

            {/* Comment */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ color: '#ccc', fontSize: 14, marginBottom: 8 }}>Comment (optional)</div>
              <textarea
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                placeholder="Describe the operator's work quality, professionalism, timeliness..."
                rows={3}
                style={{
                  width: '100%', background: '#1a1a1a', border: '1px solid #333',
                  borderRadius: 12, padding: '12px 14px', color: 'white',
                  fontSize: 14, resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Payment summary */}
            <div style={{
              background: '#1a1a1a', border: '1px solid #22c55e30',
              borderRadius: 12, padding: 16, marginBottom: 24
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Escrow Release</div>
                  <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 18 }}>
                    {ratingModal.amount_sol} SOL{solPrice ? ` ≈ ${(ratingModal.amount_sol * solPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}` : ''} → Operator
                  </div>
                </div>
                <div style={{ fontSize: 28 }}>🔒→💸</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setRatingModal(null)}
                disabled={ratingSubmitting}
                style={{
                  flex: 1, padding: '13px 0', background: 'transparent',
                  border: '1px solid #333', borderRadius: 12, color: '#888',
                  cursor: 'pointer', fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitRating}
                disabled={ratingSubmitting}
                style={{
                  flex: 2, padding: '13px 0',
                  background: ratingSubmitting ? '#333' : 'linear-gradient(135deg,#9333ea,#a855f7)',
                  border: 'none', borderRadius: 12, color: 'white',
                  cursor: ratingSubmitting ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 15
                }}
              >
                {ratingSubmitting ? 'Processing...' : '✓ Complete & Release Payment'}
              </button>
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
            // Refresh contracts so any status change is visible.
            if (sessionUser?.id) {
              fetch(`${API_BASE}/api/contracts?enterprise_id=${sessionUser.id}&status=active`)
                .then(r => r.json())
                .then(data => Array.isArray(data) && setActiveContracts(data))
                .catch(() => {});
            }
          }}
        />
      )}
    </>
  );
}

export default EnterpriseDashboard;