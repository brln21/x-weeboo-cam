import { useEffect, useState } from 'react';
import { api, ApiError, type User } from './api';
import Login from './components/Login';
import CameraView from './components/CameraView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="center muted">Memuat…</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <CameraView
      user={user}
      onLogout={async () => {
        await api.logout().catch(() => {});
        setUser(null);
      }}
      onSessionExpired={() => setUser(null)}
    />
  );
}
