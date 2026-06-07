import { Bot, Lock } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import InfoLabel from '../components/InfoLabel.jsx';

export default function AiAnalysis() {
  return (
    <div className="grid two">
      <section className="panel">
        <h2>Analysis Request</h2>
        <div className="form compact">
          <select disabled><option>Binance</option><option>NASDAQ</option></select>
          <input disabled defaultValue="BTC/USDT" />
          <select disabled><option>1h</option><option>1d</option></select>
          <button disabled><Lock size={16} /> Pending consultation</button>
        </div>
      </section>
      <section className="panel ai-disabled">
        <Bot size={32} />
        <Badge tone="yellow">Not implemented</Badge>
        <h2>AI analysis needs a design decision first</h2>
        <p>Before building this feature we need to agree on model provider, prompt boundaries, risk wording, data retention, and whether the output can include trading recommendations.</p>
        <div className="indicator-grid">
          <div><InfoLabel label="RSI" tip="Relative Strength Index." /><strong>--</strong></div>
          <div><InfoLabel label="MACD" tip="Momentum indicator using moving averages." /><strong>--</strong></div>
          <div><InfoLabel label="EMA Cross" tip="Relationship between EMA 50 and EMA 200." /><strong>--</strong></div>
        </div>
      </section>
    </div>
  );
}
