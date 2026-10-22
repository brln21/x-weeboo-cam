import crypto from 'node:crypto';
import fs from 'node:fs';
import { config } from './config.js';

export const COOKIE_NAME = 'wc_session';
export const ROLES = ['viewer', 'controller'];

// --- password hashing (scrypt, tanpa dependency) ---

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64url'), expected.length, SCRYPT);
  return crypto.timingSafeEqual(actual, expected);
}

// Hash dummy supaya waktu respon sama walau username tidak ada.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

// --- users file ---

let usersCache = { mtimeMs: -1, users: [] };

export function loadUsers() {
  let stat;
  try {
    stat = fs.statSync(config.usersFile);
  } catch {
    return [];
  }
  // Re-read kalau file berubah, jadi hapus/ubah user langsung berlaku tanpa restart.
  if (stat.mtimeMs !== usersCache.mtimeMs) {
    const users = JSON.parse(fs.readFileSync(config.usersFile, 'utf8'));
    usersCache = { mtimeMs: stat.mtimeMs, users: Array.isArray(users) ? users : [] };
  }
  return usersCache.users;
}

function findUser(username) {
  return loadUsers().find((u) => u.username === username && ROLES.includes(u.role));
}

export function authenticate(username, password) {
  const user = typeof username === 'string' ? findUser(username) : undefined;
  const ok = verifyPassword(String(password ?? ''), user ? user.hash : DUMMY_HASH);
  return ok && user ? { username: user.username, role: user.role } : null;
}

// --- session token: base64url(payload).hmac ---

function sign(data) {
  return crypto.createHmac('sha256', config.sessionSecret).update(data).digest('base64url');
}

export function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ u: user.username, exp: Date.now() + config.sessionTtlMs }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;

  // Role selalu diambil dari users file, bukan dari token.
  const user = findUser(data.u);
  return user ? { username: user.username, role: user.role } : null;
}

export function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function userFromRequest(req) {
  return verifySessionToken(parseCookies(req.headers.cookie)[COOKIE_NAME]);
}

export function sessionCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(config.sessionTtlMs / 1000)}`,
    config.cookieSecure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.cookieSecure ? '; Secure' : ''}`;
}

// --- login rate limit (in-memory, per IP) ---

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILS = 10;
const loginFails = new Map();

export function loginBlocked(ip) {
  const entry = loginFails.get(ip);
  if (!entry || entry.resetAt < Date.now()) {
    loginFails.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILS;
}

export function recordLoginFail(ip) {
  const now = Date.now();
  const entry = loginFails.get(ip);
  if (!entry || entry.resetAt < now) {
    loginFails.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count++;
  }
}

export function clearLoginFails(ip) {
  loginFails.delete(ip);
}
