import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Activity, BarChart3, Bot, Briefcase, ChevronRight, Gauge, ListOrdered, Settings, Shield, Star, Wallet } from 'lucide-react';
import { useAuth } from '../auth.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/exchanges', label: 'Exchanges', icon: Shield },
  { to: '/trading', label: 'Trading', icon: Activity },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/orders', label: 'Orders', icon: ListOrdered },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/ai-analysis', label: 'AI Analysis', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const title = navItems.find((item) => item.to === location.pathname)?.label || 'Terminal';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Wallet size={22} />
          <span>TradePilot</span>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <div className="breadcrumb">Terminal <ChevronRight size={14} /> {title}</div>
            <h1>{title}</h1>
          </div>
          <div className="user-chip">
            <BarChart3 size={16} />
            <span>{user?.name || 'Trader'}</span>
            <button className="ghost small" onClick={logout}>Logout</button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
