import { VideoRTC } from '../vendor/video-rtc.js';

export type PlayerMode = 'loading' | 'RTC' | 'MSE' | 'HLS' | 'MJPEG' | 'offline';

export interface PlayerStatus {
  mode: PlayerMode;
  error?: string;
}

/**
 * Turunan VideoRTC (go2rtc) tanpa UI sendiri; status dikirim lewat event
 * `camstatus` supaya UI-nya dibuat di React.
 */
export class CamPlayer extends VideoRTC {
  private current: PlayerMode = 'loading';
  private lastError = '';

  constructor() {
    super();
    // Jangan tawarkan H.265 ke go2rtc: browser yang mengaku bisa HEVC (Chrome/Edge di
    // Windows) akan dikirimi H.265 mentah dari kamera. Selalu pakai transcode H.264.
    this.CODECS = this.CODECS.filter((codec) => !codec.startsWith('hvc1'));
  }

  private emit(status: PlayerStatus) {
    this.current = status.mode;
    this.lastError = status.error || '';
    this.dispatchEvent(new CustomEvent<PlayerStatus>('camstatus', { detail: status }));
  }

  oninit() {
    super.oninit();
    this.video.controls = false;
    this.video.muted = true; // autoplay di HP butuh muted; user bisa unmute
    this.video.style.objectFit = 'contain';
  }

  onconnect() {
    const started = super.onconnect();
    if (started) this.emit({ mode: 'loading' });
    return started;
  }

  onopen() {
    const modes = super.onopen();
    this.onmessage['camstatus'] = (msg) => {
      switch (msg.type) {
        case 'error':
          // Mode cadangan bisa gagal setelah mode lain sudah jalan; jangan timpa mode-nya.
          this.emit({ mode: this.current, error: msg.value });
          break;
        case 'mse':
        case 'hls':
        case 'mjpeg':
          this.emit({ mode: msg.type.toUpperCase() as PlayerMode });
          break;
      }
    };
    return modes;
  }

  onclose() {
    // WebSocket juga ditutup sengaja setelah WebRTC tersambung (wsState sudah CLOSED);
    // itu bukan putus koneksi, jadi status RTC jangan ditimpa.
    if (this.wsState === WebSocket.CLOSED) return super.onclose();
    const reconnecting = super.onclose();
    this.emit({
      mode: reconnecting ? 'loading' : 'offline',
      // Pesan error dari go2rtc lebih berguna daripada pesan umum.
      error: this.lastError || 'Koneksi stream terputus, mencoba lagi… (cek log terminal backend)',
    });
    return reconnecting;
  }

  onpcvideo(video: HTMLVideoElement) {
    super.onpcvideo(video);
    if (this.pcState !== WebSocket.CLOSED) this.emit({ mode: 'RTC' });
  }
}

if (!customElements.get('cam-player')) {
  customElements.define('cam-player', CamPlayer);
}
