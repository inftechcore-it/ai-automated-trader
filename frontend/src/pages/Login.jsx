import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'demo@trading.com', password: 'Demo@1234' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Access paper and live trading controls from one terminal.">
      <form className="form" onSubmit={submit}>
        <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" />
        <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" type="password" />
        {error && <div className="form-error">{error}</div>}
        <button type="submit">Sign in</button>
        <span className="form-link">New here? <Link to="/register">Create account</Link></span>
      </form>
    </AuthShell>
  );
}
