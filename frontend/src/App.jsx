import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Exchanges from './pages/Exchanges.jsx';
import Trading from './pages/Trading.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Orders from './pages/Orders.jsx';
import Watchlist from './pages/Watchlist.jsx';
import AiAnalysis from './pages/AiAnalysis.jsx';
import Settings from './pages/Settings.jsx';
import Account from './pages/Account.jsx';
import Bots from './pages/Bots.jsx';
import BotDetail from './pages/BotDetail.jsx';
import BotAnalytics from './pages/BotAnalytics.jsx';
import CommunityBots from './pages/CommunityBots.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot">Loading terminal...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Protected><Layout /></Protected>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="exchanges" element={<Exchanges />} />
          <Route path="trading" element={<Trading />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="orders" element={<Orders />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="ai-analysis" element={<AiAnalysis />} />
          <Route path="bots" element={<Bots />} />
          <Route path="bots/:id" element={<BotDetail />} />
          <Route path="community-bots" element={<CommunityBots />} />
          <Route path="bot-analytics" element={<BotAnalytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="account" element={<Account />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
