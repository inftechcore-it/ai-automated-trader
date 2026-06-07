import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Start with a $10,000 paper wallet before connecting any exchange.">
      <form className="form" onSubmit={submit}>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name" />
        <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" />
        <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" type="password" />
        <input value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} placeholder="Confirm password" type="password" />
        {error && <div className="form-error">{error}</div>}
        <button type="submit">Create account</button>
        <span className="form-link">Already registered? <Link to="/login">Sign in</Link></span>
      </form>
    </AuthShell>
  );
}
