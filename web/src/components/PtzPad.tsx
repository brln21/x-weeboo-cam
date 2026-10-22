import { useEffect, useState } from 'react';
import { api, type Direction } from '../api';

const BUTTONS: { dir: Direction; label: string; area: string }[] = [
  { dir: 'up', label: '▲', area: 'up' },
  { dir: 'left', label: '◀', area: 'left' },
  { dir: 'right', label: '▶', area: 'right' },
  { dir: 'down', label: '▼', area: 'down' },
];

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export default function PtzPad({ directions }: { directions: Direction[] }) {
  const [busy, setBusy] = useState<Direction | null>(null);
  const [error, setError] = useState('');

  async function move(dir: Direction) {
    if (busy) return;
    setBusy(dir);
    setError('');
    try {
      await api.ptz(dir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PTZ gagal');
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const dir = KEYS[e.key];
      if (!dir || !directions.includes(dir)) return;
      if (e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      move(dir);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <section className="ptz" aria-label="Kontrol PTZ">
      <div className="ptz-grid">
        {BUTTONS.filter((b) => directions.includes(b.dir)).map((b) => (
          <button
            key={b.dir}
            style={{ gridArea: b.area }}
            className={busy === b.dir ? 'active' : ''}
            onClick={() => move(b.dir)}
            disabled={busy !== null}
            aria-label={`Gerak ${b.dir}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
