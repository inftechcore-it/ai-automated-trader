import { RefreshCcw, Save } from 'lucide-react';
import { useAuth } from '../auth.jsx';

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="grid two">
      <section className="panel">
        <h2>Profile</h2>
        <form className="form compact">
          <input defaultValue={user?.name || ''} placeholder="Name" />
          <input defaultValue={user?.email || ''} placeholder="Email" />
          <input type="password" placeholder="New password" />
          <button type="button"><Save size={16} /> Save changes</button>
        </form>
      </section>
      <section className="panel">
        <h2>Paper Wallet</h2>
        <div className="card-value">$10,000.00</div>
        <p className="muted">Reset the paper wallet balance for testing scenarios.</p>
        <button className="secondary"><RefreshCcw size={16} /> Reset balance</button>
      </section>
    </div>
  );
}
