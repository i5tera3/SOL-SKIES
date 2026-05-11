// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SolanaWalletProvider } from './Context/WalletContext';
import { SessionProvider } from './Context/sessionContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import OperatorDashboard from './pages/operator/dashboard';
import EnterpriseDashboard from './pages/EnterpriseDashboard';
import Admin from './pages/Admin';
import OperatorProfile from './pages/OperatorProfile';
import EnterpriseProfile from './pages/EnterpriseProfile';
import MissionDetails from './pages/MissionDetails';

// Global toast styling — matches the dark theme everywhere else.
const TOAST_OPTIONS = {
  position: 'top-right',
  toastOptions: {
    duration: 4000,
    style: {
      background: '#1a1a1a',
      color: '#fff',
      border: '1px solid #333',
      fontSize: '13px',
      fontWeight: 500,
      padding: '12px 16px',
      borderRadius: '10px',
    },
    success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
    error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' }, duration: 6000 },
    loading: { iconTheme: { primary: '#9333ea', secondary: '#fff' } },
  },
};

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <SolanaWalletProvider>
          <Toaster {...TOAST_OPTIONS} />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Admin — no auth required for demo */}
            <Route path="/admin" element={<Admin />} />

            {/* Public profile pages */}
            <Route path="/operator/:username" element={<OperatorProfile />} />
            <Route path="/enterprise/:companySlug" element={<EnterpriseProfile />} />
            <Route path="/missions/:id" element={<MissionDetails />} />

            {/* Protected: Operator */}
            <Route path="/operator/dashboard" element={
              <ProtectedRoute requiredRole="operator">
                <OperatorDashboard />
              </ProtectedRoute>
            } />

            {/* Protected: Enterprise */}
            <Route path="/enterprise/dashboard" element={
              <ProtectedRoute requiredRole="enterprise">
                <EnterpriseDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </SolanaWalletProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}

export default App;
