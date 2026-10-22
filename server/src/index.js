import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import httpProxy from 'http-proxy';
import { config, validateConfig } from './config.js';
import {
  authenticate,
  clearLoginFails,
  clearSessionCookie,
  createSessionToken,
  loadUsers,
  loginBlocked,
  recordLoginFail,
  sessionCookie,
  userFromRequest,
} from './auth.js';
import { DIRECTIONS, movePtz, ptzEnabled } from './ptz.js';

validateConfig();

const app = express();
// cloudflared jalan di mesin yang sama, jadi X-Forwarded-For hanya dipercaya dari loopback.
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': [
      "default-src 'self'",
      "connect-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "frame-ancestors 'none'",
    ].join('; '),
  });
  next();
});

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // bukan browser; tetap butuh cookie sesi
  if (config.allowedOrigins.length) return config.allowedOrigins.includes(origin);
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function requireUser(req, res, next) {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

function checkOrigin(req, res, next) {
  if (!originAllowed(req)) return res.status(403).json({ error: 'bad origin' });
  next();
}

// --- auth ---

app.post('/api/auth/login', checkOrigin, express.json({ limit: '10kb' }), (req, res) => {
  if (loginBlocked(req.ip)) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
  }
  const user = authenticate(req.body?.username, req.body?.password);
  if (!user) {
    recordLoginFail(req.ip);
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  clearLoginFails(req.ip);
  res.set('Set-Cookie', sessionCookie(createSessionToken(user)));
  res.json({ user });
});

app.post('/api/auth/logout', checkOrigin, (req, res) => {
  res.set('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

app.get('/api/auth/me', requireUser, (req, res) => {
  res.json({ user: req.user });
});

// --- camera ---

const proxy = httpProxy.createProxyServer({ target: config.go2rtcUrl, changeOrigin: true });
proxy.on('error', (err, req, resOrSocket) => {
  console.error('go2rtc proxy error:', err.message);
  if (resOrSocket instanceof http.ServerResponse) {
    if (!resOrSocket.headersSent) resOrSocket.writeHead(502, { 'Content-Type': 'application/json' });
    resOrSocket.end(JSON.stringify({ error: 'go2rtc tidak bisa dihubungi' }));
  } else {
    resOrSocket.destroy();
  }
});

// Forward ke go2rtc dengan path yang ditentukan server. Cookie sesi tidak ikut diteruskan.
function forward(req, res, go2rtcPath) {
  req.url = go2rtcPath;
  delete req.headers.cookie;
  proxy.web(req, res);
}

const src = encodeURIComponent(config.stream);

app.get('/api/camera/info', requireUser, (req, res) => {
  res.json({
    stream: config.stream,
    ptz: ptzEnabled() ? { directions: DIRECTIONS } : null,
  });
});

app.get('/api/camera/snapshot', requireUser, (req, res) => {
  res.set('Cache-Control', 'no-store');
  forward(req, res, `/api/frame.jpeg?src=${src}`);
});

// Fallback HLS untuk browser tanpa MSE (iPhone lama). VideoRTC membentuk URL ini
// dari URL WebSocket: /api/camera/ws -> /api/camera/hls/...
const HLS_FILES = new Set(['playlist.m3u8', 'segment.ts', 'init.mp4', 'segment.m4s']);
app.get('/api/camera/hls/:file', requireUser, (req, res) => {
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!HLS_FILES.has(req.params.file) || !id) return res.status(404).end();
  forward(req, res, `/api/hls/${req.params.file}?id=${encodeURIComponent(id)}`);
});

const ptzLast = new Map();
app.post(
  '/api/camera/ptz',
  checkOrigin,
  requireUser,
  requireRole('controller'),
  express.json({ limit: '1kb' }),
  async (req, res) => {
    if (!ptzEnabled()) return res.status(501).json({ error: 'PTZ belum dikonfigurasi' });
    const direction = req.body?.direction;
    if (!DIRECTIONS.includes(direction)) return res.status(400).json({ error: 'direction tidak valid' });

    const now = Date.now();
    if (now - (ptzLast.get(req.user.username) || 0) < 300) {
      return res.status(429).json({ error: 'pelan-pelan' });
    }
    ptzLast.set(req.user.username, now);

    try {
      await movePtz(direction);
      res.json({ ok: true });
    } catch (err) {
      console.error('PTZ error:', err.message);
      res.status(502).json({ error: 'Perintah PTZ gagal' });
    }
  },
);

app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

// --- frontend hasil build ---

if (fs.existsSync(config.webDist)) {
  app.use(express.static(config.webDist, { index: false }));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(config.webDist, 'index.html')));
}

// --- WebSocket stream (WebRTC signaling + MSE) ---

const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  const reject = (status) => {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };

  if (url.pathname !== '/api/camera/ws') return reject('404 Not Found');
  // Cegah cross-site WebSocket hijacking.
  if (!req.headers.origin || !originAllowed(req)) return reject('403 Forbidden');
  if (!userFromRequest(req)) return reject('401 Unauthorized');

  // Stream dipaksa dari config; parameter src dari client diabaikan.
  req.url = `/api/ws?src=${src}`;
  delete req.headers.cookie;
  // go2rtc menolak Origin yang beda dengan Host-nya sendiri; origin sudah dicek di atas.
  delete req.headers.origin;
  proxy.ws(req, socket, head);
});

server.listen(config.port, config.host, () => {
  console.log(`weeboo-cam server di http://${config.host}:${config.port}`);
  console.log(`go2rtc: ${config.go2rtcUrl} (stream "${config.stream}")`);
  console.log(`PTZ: ${config.ptz.driver}`);
  if (!loadUsers().length) {
    console.warn('Belum ada user. Buat dengan: npm run user:add -- <username> <viewer|controller>');
  }
});
