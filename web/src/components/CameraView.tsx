import { useEffect, useRef, useState } from 'react';
import { api, ApiError, SNAPSHOT_PATH, STREAM_WS_PATH, type CameraInfo, type User } from '../api';
import Player, { type PlayerHandle } from './Player';
import PtzPad from './PtzPad';

interface Props {
  user: User;
  onLogout: () => void;
  onSessionExpired: () => void;
}

export default function CameraView({ user, onLogout, onSessionExpired }: Props) {
  const [info, setInfo] = useState<CameraInfo | null>(null);
  const [muted, setMuted] = useState(true);
  const playerRef = useRef<PlayerHandle>(null);

  useEffect(() => {
    const handle = (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onSessionExpired();
      else console.error(err);
    };
    api.cameraInfo().then(setInfo).catch(handle);
    // Player reconnect terus kalau sesi habis; cek berkala supaya balik ke login.
    const id = setInterval(() => api.me().catch(handle), 60_000);
    return () => clearInterval(id);
  }, [onSessionExpired]);

  const canControl = user.role === 'controller' && info?.ptz;

  return (
    <div className="app">
      <header className="topbar">
        <strong>Weeboo Cam</strong>
        <span className="muted">
          {user.username} · {user.role}
        </span>
        <button onClick={onLogout}>Keluar</button>
      </header>

      <main className="camera">
        <Player ref={playerRef} src={STREAM_WS_PATH} />

        <div className="toolbar">
          <button onClick={() => setMuted(playerRef.current?.toggleMute() ?? true)}>
            {muted ? '🔇 Suara' : '🔊 Suara'}
          </button>
          <a className="button" href={SNAPSHOT_PATH} download={`snapshot-${Date.now()}.jpg`}>
            📷 Snapshot
          </a>
          <button onClick={() => playerRef.current?.fullscreen()}>⛶ Layar penuh</button>
        </div>

        {canControl && <PtzPad directions={info.ptz!.directions} />}
        {user.role === 'controller' && info && !info.ptz && (
          <p className="muted small">PTZ belum dikonfigurasi di server (PTZ_DRIVER=none).</p>
        )}
      </main>
    </div>
  );
}
