import { Activity } from 'lucide-react';

export default function AuthShell({ title, subtitle, children }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand auth-brand"><Activity size={24} /> TradePilot</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
      <section className="market-panel">
        <div className="market-line gain">BTC/USDT 68,250.12 +1.22%</div>
        <div className="market-line loss">ETH/USDT 3,560.44 -1.17%</div>
        <div className="market-line gain">AAPL 211.34 +1.00%</div>
      </section>
    </main>
  );
}
