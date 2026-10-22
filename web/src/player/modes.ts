// Mode player sama seperti parameter `mode` di stream.html go2rtc,
// mis. /?mode=webrtc,mse,hls,mjpeg. Urutan = prioritas fallback.

export const DEFAULT_MODE = 'webrtc,mse,hls,mjpeg';

const ALLOWED = new Set(['webrtc', 'webrtc/tcp', 'mse', 'hls', 'mp4', 'mjpeg']);

export const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: DEFAULT_MODE, label: 'Auto' },
  { value: 'webrtc', label: 'WebRTC' },
  { value: 'webrtc/tcp', label: 'WebRTC (TCP)' },
  { value: 'mse', label: 'MSE' },
  { value: 'hls', label: 'HLS' },
  { value: 'mjpeg', label: 'MJPEG' },
];

/** Bersihkan input mode; token yang tidak dikenal dibuang. */
export function normalizeMode(value: string | null | undefined): string | null {
  const tokens = (value || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => ALLOWED.has(t));
  return tokens.length ? [...new Set(tokens)].join(',') : null;
}

const STORAGE_KEY = 'weeboo-cam:mode';

export function initialMode(): string {
  const fromUrl = normalizeMode(new URLSearchParams(location.search).get('mode'));
  if (fromUrl) return fromUrl;
  try {
    return normalizeMode(localStorage.getItem(STORAGE_KEY)) || DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function rememberMode(mode: string) {
  const url = new URL(location.href);
  if (mode === DEFAULT_MODE) url.searchParams.delete('mode');
  else url.searchParams.set('mode', mode);
  history.replaceState(null, '', url);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // private mode / storage diblok: cukup pakai URL
  }
}
