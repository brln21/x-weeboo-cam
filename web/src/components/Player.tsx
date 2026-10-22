import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
// Side-effect import: mendaftarkan <cam-player>. Import di bawah hanya type, jadi dibuang bundler.
import '../player/cam-player';
import type { CamPlayer, PlayerStatus } from '../player/cam-player';

export interface PlayerHandle {
  toggleMute: () => boolean;
  fullscreen: () => void;
}

interface Props {
  src: string;
  /** Daftar mode VideoRTC, urutan = prioritas (lihat player/modes.ts). */
  mode: string;
}

const Player = forwardRef<PlayerHandle, Props>(function Player({ src, mode }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<CamPlayer | null>(null);
  const [status, setStatus] = useState<PlayerStatus>({ mode: 'loading' });

  useEffect(() => {
    const player = document.createElement('cam-player') as CamPlayer;
    // WebRTC paling low-latency; MSE lewat WebSocket jalan walau UDP diblok (mis. lewat tunnel).
    player.mode = mode;
    player.media = 'video,audio';
    setStatus({ mode: 'loading' });
    const onStatus = (e: Event) => setStatus((e as CustomEvent<PlayerStatus>).detail);
    player.addEventListener('camstatus', onStatus);
    containerRef.current!.appendChild(player);
    player.src = src;
    playerRef.current = player;

    return () => {
      player.removeEventListener('camstatus', onStatus);
      player.remove();
      playerRef.current = null;
    };
  }, [src, mode]);

  useImperativeHandle(ref, () => ({
    toggleMute() {
      const video = playerRef.current?.video;
      if (!video) return true;
      video.muted = !video.muted;
      return video.muted;
    },
    fullscreen() {
      const el = containerRef.current;
      const video = playerRef.current?.video as
        | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
        | undefined;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (el?.requestFullscreen) {
        el.requestFullscreen();
      } else {
        video?.webkitEnterFullscreen?.(); // iPhone Safari
      }
    },
  }));

  return (
    <div className="player" ref={containerRef}>
      <div className="player-status">
        <span className={`badge ${status.mode === 'loading' || status.mode === 'offline' ? 'warn' : 'ok'}`}>
          {status.mode === 'loading' ? 'menghubungkan…' : status.mode}
        </span>
        {status.error && <span className="badge err">{status.error}</span>}
      </div>
    </div>
  );
});

export default Player;
