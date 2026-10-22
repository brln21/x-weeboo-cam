import { useEffect, useRef, useState } from 'react';
import { api, ApiError, SNAPSHOT_PATH, STREAM_WS_PATH, type CameraInfo, type User } from '../api';
import { initialMode, MODE_OPTIONS, rememberMode } from '../player/modes';
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
  const [mode, setMode] = useState(initialMode);
  const playerRef = useRef<PlayerHandle>(null);

  function changeMode(value: string) {
    setMode(value);
    setMuted(true); // player dibuat ulang dalam keadaan muted
    rememberMode(value);
  }

  // Mode dari URL yang bukan salah satu preset tetap bisa dipilih.
  const modeOptions = MODE_OPTIONS.some((o) => o.value === mode)
    ? MODE_OPTIONS
    : [...MODE_OPTIONS, { value: mode, label: mode }];

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
        <Player ref={playerRef} src={STREAM_WS_PATH} mode={mode} />

        <div className="toolbar">
          <label className="select">
            <span className="muted">Mode</span>
            <select value={mode} onChange={(e) => changeMode(e.target.value)}>
              {modeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
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
