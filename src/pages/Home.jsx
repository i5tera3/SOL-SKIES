import { Link } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../Context/sessionContext';
import logo from "../assets/AdobSOL.png";
import constructionImg from "../assets/Construction.png";
import { API_BASE, signInWithWallet } from '../lib/api';

function Home() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, login, clearSession } = useSession();
  const { publicKey, connected, disconnect, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [walletNotFound, setWalletNotFound] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const hasChecked = useRef(false);

  // If the user just logged out, skip wallet auto-check entirely.
  // Without this, Home sees the wallet still connected → auto-logs the user back in.
  // FIX: must be React STATE, not a plain const.
  // window.history.replaceState() does NOT trigger a re-render, so a plain const
  // computed from window.location.search stays 'true' for the whole page load,
  // permanently blocking the wallet check for any wallet connected after logout.
  const [justLoggedOut, setJustLoggedOut] = useState(
    () => new URLSearchParams(window.location.search).get('loggedOut') === '1'
  );

  // ── STEP 1: If session already exists, redirect immediately ──────────────
  // FIX: Only auto-redirect on fresh/external loads, NOT when the user
  // intentionally navigated here from within the app (e.g. clicked "Home" in
  // the sidebar). We detect this via document.referrer — if the referrer's
  // host matches ours the user came from within the app and wants to browse.
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) return;
    try {
      const fromWithinApp =
        document.referrer &&
        new URL(document.referrer).host === window.location.host;
      if (fromWithinApp) return; // Let them browse the landing page
    } catch (_) {
      // URL parse failure — proceed with redirect
    }
    const path = user.role === 'operator' ? '/operator/dashboard' : '/enterprise/dashboard';
    navigate(path, { replace: true });
  }, [user, sessionLoading, navigate]);

  // ── SECURITY FIX: Wallet mismatch guard ──────────────────────────────────
  // If user is logged in but connected wallet doesn't match user's wallet,
  // clear the stale session and force re-authentication
  useEffect(() => {
    if (sessionLoading || !publicKey || !user) return;
    if (user.walletAddress && user.walletAddress !== publicKey.toBase58()) {
      clearSession();
      hasChecked.current = false;
    }
  }, [publicKey, user, sessionLoading, clearSession]);

  // ── STEP 2: Wallet connect → check DB → login ─────────────────────────────
  // Only runs when there is NO existing session (user is null after step 1).
  useEffect(() => {
    if (connected && publicKey && justLoggedOut) {
      // User deliberately connected a wallet after logout — clear the flag.
      // setJustLoggedOut(false) triggers a re-render so the wallet check effect
      // below re-evaluates with justLoggedOut=false and fires the API check.
      setJustLoggedOut(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('loggedOut');
      window.history.replaceState({}, '', url.toString());
    }
  }, [connected, publicKey, justLoggedOut]);

  useEffect(() => {
    if (sessionLoading) return;   // wait for context
    if (user) return;             // already logged in — step 1 handles redirect
    if (justLoggedOut) return;    // user just logged out — don't auto-login
    if (!connected || !publicKey || hasChecked.current) return;

    hasChecked.current = true;
    setIsChecking(true);
    setWalletNotFound(false);

    const checkWallet = async () => {
      try {
        // First a cheap public lookup — does this wallet have an account?
        const response = await fetch(
          `${API_BASE}/api/auth/wallet-check?wallet=${publicKey.toBase58()}`
        );
        const data = await response.json();

        if (!data.exists) {
          setWalletNotFound(true);
          return;
        }

        // Account exists — run the full challenge / sign / login flow so the
        // server actually verifies wallet ownership and issues a JWT.
        if (!signMessage) {
          console.warn('Wallet does not support signMessage — cannot auto-login');
          setWalletNotFound(false);
          return;
        }
        const result = await signInWithWallet(publicKey.toBase58(), signMessage);
        login(result.user, result.token);
        // Step-1 effect picks up the user state and routes to dashboard.
      } catch (error) {
        console.error('Wallet auto-login error:', error);
        // Reset so the user can retry by reconnecting.
        hasChecked.current = false;
      } finally {
        setIsChecking(false);
      }
    };

    checkWallet();
  }, [connected, publicKey, sessionLoading, user, login, navigate, signMessage]);

  // ── STEP 3: Reset on wallet disconnect ────────────────────────────────────
  useEffect(() => {
    if (!connected) {
      hasChecked.current = false;
      setWalletNotFound(false);
      setIsChecking(false);
    }
  }, [connected]);

  const openWalletModal = () => setVisible(true);

  const styles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      min-height: 100vh;
      background-color: #0a0a0a;
      position: relative;
      overflow-x: hidden;
      color: #fff;
      line-height: 1.6;
    }

    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: radial-gradient(circle at 20px 20px, #9333ea 1px, transparent 1px);
      background-size: 40px 40px;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
    }

    .curved-line-1, .curved-line-2, .curved-line-3 {
      position: fixed;
      z-index: 0;
      pointer-events: none;
    }

    .curved-line-1 {
      top: 10%;
      right: -10%;
      width: 600px;
      height: 600px;
      border-radius: 62% 38% 42% 58% / 41% 55% 45% 59%;
      background: linear-gradient(135deg, #c084fc20, #f9a8d420);
      opacity: 0.3;
      filter: blur(60px);
      transform: rotate(15deg);
    }

    .curved-line-2 {
      bottom: -20%;
      left: -5%;
      width: 700px;
      height: 700px;
      border-radius: 73% 27% 58% 42% / 33% 64% 36% 67%;
      background: linear-gradient(225deg, #a855f720, #ec489920);
      opacity: 0.3;
      filter: blur(70px);
      transform: rotate(-10deg);
    }

    .curved-line-3 {
      top: 40%;
      left: 20%;
      width: 400px;
      height: 400px;
      border-radius: 51% 49% 33% 67% / 56% 59% 41% 44%;
      background: linear-gradient(45deg, #d8b4fe20, #fbcfe820);
      opacity: 0.2;
      filter: blur(80px);
    }

    .content {
      position: relative;
      z-index: 1;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px 40px;
    }

    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 20px 0;
      margin-bottom: 40px;
    }

    .log {
      width: 150px;
      cursor: pointer;
    }

    .nav-links {
      display: flex;
      gap: 40px;
      margin-left: 60px;
    }

    .nav-links a {
      color: #fff;
      text-decoration: none;
      font-size: 15px;
      font-weight: 500;
      opacity: 0.7;
      transition: opacity 0.3s ease;
    }

    .nav-links a:hover {
      opacity: 1;
    }

    .wallet-connected-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.35);
      color: #22c55e;
      padding: 10px 18px;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(10px);
    }

    .wallet-connected-pill .dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 6px #22c55e;
    }

    .wallet-address-text {
      font-family: monospace;
      font-size: 13px;
      color: #22c55e;
    }

    .disconnect-btn {
      background: none;
      border: none;
      color: rgba(34, 197, 94, 0.5);
      cursor: pointer;
      font-size: 16px;
      padding: 0 0 0 4px;
      line-height: 1;
      transition: color 0.2s ease;
    }

    .disconnect-btn:hover {
      color: #ef4444;
    }

    .wallet-btn {
      background: rgba(147, 51, 234, 0.1);
      border: 1px solid rgba(147, 51, 234, 0.3);
      color: white;
      padding: 10px 24px;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
      min-width: 160px;
      justify-content: center;
    }

    .wallet-btn:hover:not(:disabled) {
      background: rgba(147, 51, 234, 0.2);
      border-color: rgba(147, 51, 234, 0.5);
      transform: translateY(-1px);
    }

    .wallet-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .dashboard-btn {
      background: rgba(147, 51, 234, 0.15);
      border: 1px solid rgba(147, 51, 234, 0.5);
      color: #c084fc;
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .dashboard-btn:hover {
      background: rgba(147, 51, 234, 0.25);
      color: white;
    }

    .plus-icon {
      font-size: 18px;
      font-weight: 400;
    }

    .hero {
      max-width: 900px;
      margin: 80px 0 40px;
    }

    .hero h1 {
      font-size: 64px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 30px;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #fff, #e9d5ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero p {
      font-size: 20px;
      color: #aaa;
      max-width: 600px;
      margin-bottom: 40px;
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      gap: 16px;
      margin-bottom: 60px;
    }

    .primary-btn {
      background: #9333ea;
      border: none;
      color: white;
      padding: 14px 32px;
      border-radius: 40px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 10px 30px rgba(147, 51, 234, 0.3);
      text-decoration: none;
      display: inline-block;
    }

    .primary-btn:hover {
      background: #a855f7;
      transform: translateY(-2px);
      box-shadow: 0 15px 40px rgba(147, 51, 234, 0.4);
    }

    .secondary-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      padding: 14px 32px;
      border-radius: 40px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .secondary-btn:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.3);
    }

    .trust-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 30px;
      padding: 30px 0;
      border-top: 1px solid rgba(255,255,255,0.1);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin: 40px 0 60px;
    }

    .trust-item {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #aaa;
      font-size: 15px;
      font-weight: 500;
    }

    .trust-item span {
      font-size: 20px;
    }

    .curve-divider {
      position: relative;
      z-index: 2;
      width: 100%;
      height: auto;
      margin: 40px 0 -1px;
      display: block;
      background-color: transparent;
    }

    .curve-divider svg {
      display: block;
      width: 100%;
      height: auto;
      background-color: transparent;
    }

    .white-section {
      background-color: white;
      position: relative;
      z-index: 1;
      padding: 100px 40px;
      color: #111;
    }

    .white-section .content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0;
    }

    .section-title {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 20px;
      color: #111;
      letter-spacing: -0.02em;
    }

    .section-subtitle {
      font-size: 18px;
      color: #666;
      max-width: 600px;
      margin-bottom: 60px;
    }

    .how-it-works {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      margin-bottom: 80px;
    }

    .step {
      padding: 30px;
      background: #f8f8f8;
      border-radius: 20px;
      transition: all 0.3s ease;
    }

    .step:hover {
      transform: translateY(-5px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.05);
    }

    .step-number {
      font-size: 14px;
      font-weight: 600;
      color: #9333ea;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }

    .step h4 {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #111;
    }

    .step p {
      color: #666;
      line-height: 1.6;
    }

    .use-cases {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 60px 0;
    }

    .use-case {
      padding: 20px;
      background: #f5f5f5;
      border-radius: 12px;
      font-weight: 500;
      color: #333;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .use-case span {
      font-size: 24px;
    }

    .operator-section {
      background: #f0f0f0;
      border-radius: 30px;
      padding: 60px;
      margin: 80px 0;
      display: flex;
      align-items: center;
      gap: 60px;
    }

    .operator-content {
      flex: 1;
    }

    .operator-content h3 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 20px;
      color: #111;
    }

    .operator-content p {
      color: #555;
      margin-bottom: 30px;
      font-size: 18px;
    }

    .operator-features {
      list-style: none;
    }

    .operator-features li {
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #333;
    }

    .operator-features li::before {
      content: "✓";
      color: #9333ea;
      font-weight: bold;
      font-size: 18px;
    }

    .operator-image {
      flex: 1;
      height: 300px;
      background-image: url('https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=600');
      background-size: cover;
      background-position: center;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    }

    .metrics {
      display: flex;
      justify-content: space-around;
      padding: 60px 0;
      border-top: 1px solid #eee;
      border-bottom: 1px solid #eee;
      margin: 60px 0;
    }

    .metric {
      text-align: center;
    }

    .metric-number {
      font-size: 42px;
      font-weight: 700;
      color: #9333ea;
      margin-bottom: 8px;
    }

    .metric-label {
      color: #666;
      font-size: 16px;
    }

    .arch-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      margin-top: 40px;
    }

    .arch-item {
      padding: 30px;
      background: #f8f8f8;
      border-radius: 20px;
    }

    .arch-item h5 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #111;
    }

    .arch-item p {
      color: #666;
      font-size: 15px;
      line-height: 1.6;
    }

    .roadmap {
      display: flex;
      justify-content: space-between;
      margin: 60px 0;
      padding: 40px 0;
      position: relative;
    }

    .roadmap::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, #9333ea, #ec4899);
      transform: translateY(-50%);
    }

    .milestone {
      position: relative;
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.05);
      text-align: center;
      min-width: 150px;
      z-index: 2;
    }

    .milestone .quarter {
      font-size: 14px;
      color: #9333ea;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .milestone .desc {
      font-size: 15px;
      font-weight: 500;
      color: #333;
    }

    .footer {
      background: #0a0a0a;
      color: white;
      padding: 60px 40px 30px;
    }

    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }

    .footer-col p {
      color: #888;
      font-size: 14px;
      line-height: 1.6;
      margin-top: 20px;
    }

    .footer-col h6 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
      color: white;
    }

    .footer-col a {
      display: block;
      color: #888;
      text-decoration: none;
      font-size: 14px;
      margin-bottom: 12px;
      transition: color 0.3s ease;
    }

    .footer-col a:hover {
      color: #9333ea;
    }

    .footer-bottom {
      max-width: 1200px;
      margin: 0 auto;
      padding-top: 30px;
      border-top: 1px solid #222;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #666;
      font-size: 14px;
    }

    .social-links {
      display: flex;
      gap: 20px;
    }

    .social-links a {
      color: #666;
      text-decoration: none;
      transition: color 0.3s ease;
    }

    .social-links a:hover {
      color: #9333ea;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-text {
      color: white;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 1px;
    }

    .parallax {
      flex: 1;
      height: 400px;
      background-size: cover;
      background-position: center;
      background-attachment: scroll;
      border-radius: 20px;
      box-shadow: 0 30px 60px rgba(147, 51, 234, 0.2);
      transition: all 0.3s ease;
    }

    .parallax:hover {
      transform: scale(1.02);
    }

    @media (max-width: 1024px) {
      .hero h1 { font-size: 48px; }
      .footer-content { grid-template-columns: 1fr 1fr 1fr; }
      .how-it-works, .use-cases, .arch-grid { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 768px) {
      .hero h1 { font-size: 36px; }
      .hero-actions { flex-direction: column; }
      .top-bar { flex-wrap: wrap; gap: 20px; }
      .nav-links { margin-left: 0; order: 3; width: 100%; justify-content: center; }
      .how-it-works, .use-cases, .arch-grid { grid-template-columns: 1fr; }
      .operator-section { flex-direction: column; padding: 40px; }
      .metrics { flex-wrap: wrap; gap: 30px; }
      .roadmap { flex-direction: column; gap: 20px; }
      .roadmap::before { display: none; }
      .footer-content { grid-template-columns: 1fr 1fr; }
    }
  `;

  // Show a minimal loading screen while session context initialises
  // (this is typically < 50ms — just localStorage read time)
  if (sessionLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 18
      }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <div className="curved-line-1" />
      <div className="curved-line-2" />
      <div className="curved-line-3" />

      <div className="content">
        {/* Top bar */}
        <div className="top-bar">
          <div className="logo-container">
            <Link to="/">
              <img src={logo} className="log" alt="Sol Skies Logo" />
            </Link>
            <span className="logo-text">SOL-SKIES</span>
          </div>

          <div className="nav-links">
            <span
              onClick={() => {
                if (isChecking) return; // wallet check in progress — wait
                if (!user) {
                  if (!connected) { alert('Please connect your wallet first.'); return; }
                  alert('No account found for this wallet. Please sign up below.');
                  return;
                }
                if (user.role !== 'enterprise') {
                  alert(`Your account is registered as "${user.role}". Only enterprise accounts can access this dashboard.`);
                  return;
                }
                navigate('/enterprise/dashboard');
              }}
              style={{ cursor: isChecking ? 'wait' : 'pointer', opacity: isChecking ? 0.5 : 1 }}
            >Enterprise</span>
            <span
              onClick={() => {
                if (isChecking) return; // wallet check in progress — wait
                if (!user) {
                  if (!connected) { alert('Please connect your wallet first.'); return; }
                  alert('No account found for this wallet. Please sign up below.');
                  return;
                }
                if (user.role !== 'operator') {
                  alert(`Your account is registered as "${user.role}". Only operator accounts can access this dashboard.`);
                  return;
                }
                navigate('/operator/dashboard');
              }}
              style={{ cursor: isChecking ? 'wait' : 'pointer', opacity: isChecking ? 0.5 : 1 }}
            >Operators</span>
            <Link to="/developers">Developers</Link>
            {/* FIX: Show "Dashboard" button for logged-in users instead of "Login" */}
            {user ? (
              <span
                onClick={() => navigate(user.role === 'operator' ? '/operator/dashboard' : '/enterprise/dashboard')}
                style={{ cursor: 'pointer', color: '#c084fc', fontWeight: 600 }}
              >
                Dashboard →
              </span>
            ) : (
              <Link to="/login">Login</Link>
            )}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {connected && publicKey && !justLoggedOut ? (
              <div className="wallet-connected-pill">
                <span className="dot" />
                <span className="wallet-address-text">
                  {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </span>
                <button
                  className="disconnect-btn"
                  title="Disconnect wallet"
                  onClick={() => disconnect()}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={openWalletModal}
                disabled={isChecking}
                className="wallet-btn"
              >
                <span className="plus-icon">{isChecking ? '⏳' : '🔌'}</span>
                {isChecking ? 'Checking...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>

        {/* Wallet not found banner */}
        {walletNotFound && (
          <div style={{
            background: '#f59e0b20',
            border: '1px solid #f59e0b',
            color: '#f59e0b',
            padding: '12px 20px',
            borderRadius: '10px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            🔔 Wallet connected but not registered. Please sign up below.
          </div>
        )}

        {/* Hero */}
        <div className="hero">
          <h1>
            On-chain drone operations
            <br />
            infrastructure for enterprises
          </h1>
          <p>
            Replace fragmented drone services with a decentralized network of
            verified operators. Smart contracts handle escrow, staking, and
            settlements—automatically.
          </p>
          <div className="hero-actions">
            <Link to="/signup?type=enterprise" className="primary-btn">
              I Need Drone Services
            </Link>
            <Link to="/signup?type=operator" className="secondary-btn">
              I Am a Drone Operator
            </Link>
          </div>
        </div>

        {/* Trust strip */}
        <div className="trust-strip">
          <div className="trust-item"><span>🔐</span> Auditable Smart Contracts</div>
          <div className="trust-item"><span>⚡</span> Sub-second Settlement</div>
          <div className="trust-item"><span>🌍</span> Global Operator Network</div>
          <div className="trust-item"><span>📡</span> Real-Time Mission Tracking</div>
        </div>
      </div>

      {/* Curve divider */}
      <div className="curve-divider">
        <svg width="100%" height={100} viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path
            d="M 0 100 C 200 0, 400 0, 600 100 C 800 200, 1000 200, 1200 100"
            stroke="none"
            strokeWidth={0}
            fill="white"
          />
        </svg>
      </div>

      {/* White section */}
      <div className="white-section">
        <div className="content">

          <h2 className="section-title">How SOL-SKIES Works</h2>
          <p className="section-subtitle">
            Simple, transparent, automated drone operations for enterprises
          </p>

          <div className="how-it-works">
            <div className="step">
              <div className="step-number">Step 01</div>
              <h4>Enterprise posts mission</h4>
              <p>Define requirements, upload zone map, deposit payment into smart contract escrow</p>
            </div>
            <div className="step">
              <div className="step-number">Step 02</div>
              <h4>Operators stake & accept</h4>
              <p>Verified operators stake SOL to guarantee performance and accept mission pieces</p>
            </div>
            <div className="step">
              <div className="step-number">Step 03</div>
              <h4>Escrow auto-settles</h4>
              <p>Smart contract releases payment instantly upon verified completion</p>
            </div>
          </div>

          <h2 className="section-title" style={{ marginTop: 80 }}>Built For</h2>

          <div className="use-cases">
            <div className="use-case"><span>🏗️</span> Infrastructure inspection</div>
            <div className="use-case"><span>🏢</span> Construction monitoring</div>
            <div className="use-case"><span>🛢️</span> Oil & gas pipeline survey</div>
            <div className="use-case"><span>🌾</span> Agriculture analysis</div>
            <div className="use-case"><span>🚨</span> Emergency response</div>
            <div className="use-case"><span>🔍</span> Thermal imaging</div>
          </div>

          <div className="operator-section">
            <div className="operator-content">
              <h3>For Drone Operators</h3>
              <p>Turn your drone into a revenue-generating asset. Stake-based credibility, instant payments, and portable reputation.</p>
              <ul className="operator-features">
                <li>Stake-based credibility system</li>
                <li>Instant on-chain payments</li>
                <li>Reputation scoring across missions</li>
                <li>NFT drone registration & verification</li>
              </ul>
              <Link to="/signup?type=operator" className="primary-btn" style={{ marginTop: 30, display: 'inline-block' }}>
                Apply as Operator →
              </Link>
            </div>
            <div className="operator-image" />
          </div>

          <div className="metrics">
            <div className="metric">
              <div className="metric-number">✓</div>
              <div className="metric-label">No Middlemen</div>
            </div>
            <div className="metric">
              <div className="metric-number">⚡</div>
              <div className="metric-label">Instant Settlements</div>
            </div>
            <div className="metric">
              <div className="metric-number">🔒</div>
              <div className="metric-label">Trustless Operations</div>
            </div>
            <div className="metric">
              <div className="metric-number">🌐</div>
              <div className="metric-label">Decentralized Network</div>
            </div>
          </div>

          <h2 className="section-title">Protocol Architecture</h2>
          <p className="section-subtitle">Enterprise-grade infrastructure powered by Solana</p>

          <div className="arch-grid">
            <div className="arch-item">
              <h5>Smart Contract Escrow</h5>
              <p>Multi-signature escrow with automatic release upon verified mission completion</p>
            </div>
            <div className="arch-item">
              <h5>Stake-based Validation</h5>
              <p>Operators stake SOL to guarantee performance; slashing for failed missions</p>
            </div>
            <div className="arch-item">
              <h5>On-chain Registry</h5>
              <p>Drone identities minted as NFTs with verified serial numbers and firmware</p>
            </div>
            <div className="arch-item">
              <h5>Dispute Resolution</h5>
              <p>Decentralized oracle network for mission verification and dispute handling</p>
            </div>
            <div className="arch-item">
              <h5>Enterprise API Layer</h5>
              <p>REST and GraphQL APIs for seamless enterprise integration</p>
            </div>
            <div className="arch-item">
              <h5>Reputation Protocol</h5>
              <p>Immutable on-chain reputation scores portable across the network</p>
            </div>
          </div>

          <h2 className="section-title" style={{ marginTop: 60 }}>Roadmap</h2>

          <div className="roadmap">
            <div className="milestone">
              <div className="quarter">Week 1</div>
              <div className="desc">Planning & Idea breakdown</div>
            </div>
            <div className="milestone">
              <div className="quarter">Week 2</div>
              <div className="desc">Frontend & Core Workflow</div>
            </div>
            <div className="milestone">
              <div className="quarter">Week 3</div>
              <div className="desc">Escrow Smart Contract & Solana Integration</div>
            </div>
            <div className="milestone">
              <div className="quarter">Week 4</div>
              <div className="desc">Testing, Multi-Operator Logic & Demo Polish</div>
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "80px 0 40px" }}>
            <h3 style={{ fontSize: 32, marginBottom: 20, color: "#111" }}>
              Ready to transform drone operations?
            </h3>
            <p style={{ color: "#666", marginBottom: 30, fontSize: 18 }}>
              Join the first decentralized drone network for enterprises
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <Link to="/whitepaper" className="primary-btn">Read Whitepaper</Link>
              <Link to="/docs" className="secondary-btn" style={{ borderColor: "#9333ea", color: "#9333ea" }}>
                View Docs
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <div className="footer-content">
          <div className="footer-col">
            <img src={logo} style={{ width: 120, filter: "brightness(0) invert(1)" }} alt="Sol Skies Logo" />
            <p>Decentralized drone operations infrastructure for enterprises. Built on Solana.</p>
          </div>
          <div className="footer-col">
            <h6>Company</h6>
            <Link to="/about">About</Link>
            <Link to="/careers">Careers</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/press">Press</Link>
          </div>
          <div className="footer-col">
            <h6>Developers</h6>
            <Link to="/docs">Documentation</Link>
            <a href="https://github.com/sanadabuamirah-commits/SOL-SKIES" target="_blank" rel="noopener noreferrer">GitHub</a>
            <Link to="/whitepaper">Whitepaper</Link>
            <Link to="/audits">Audits</Link>
          </div>
          <div className="footer-col">
            <h6>Legal</h6>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/security">Security</Link>
            <Link to="/compliance">Compliance</Link>
          </div>
          <div className="footer-col">
            <h6>Connect</h6>
            <a href="https://x.com/SOL_SK1ES" target="_blank" rel="noopener noreferrer">Twitter / X</a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>
            <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">Telegram</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© 2026 Sol Skies. All rights reserved.</div>
          <div className="social-links">
            <a href="https://x.com/SOL_SK1ES" target="_blank" rel="noopener noreferrer">𝕏</a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">💼</a>
            <a href="https://discord.com" target="_blank" rel="noopener noreferrer">💬</a>
            <a href="https://github.com/sanadabuamirah-commits/SOL-SKIES" target="_blank" rel="noopener noreferrer">📁</a>
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
