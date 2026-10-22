import { useState, type FormEvent } from 'react';
import { api, type User } from '../api';

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center">
      <form className="card login" onSubmit={submit}>
        <h1>Weeboo Cam</h1>
        <label>
          Username
          <input
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
