import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(SERVER_DIR, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;

function list(value) {
  return (value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function parseArgs(value) {
  if (!value) return [];
  const args = JSON.parse(value);
  if (!Array.isArray(args) || !args.every((a) => typeof a === 'string')) {
    throw new Error('PTZ_EXEC_ARGS harus JSON array of string');
  }
  return args;
}

export const config = {
  port: Number(env.PORT || 3000),
  host: env.HOST || '127.0.0.1',
  go2rtcUrl: (env.GO2RTC_URL || 'http://127.0.0.1:1984').replace(/\/$/, ''),
  stream: env.GO2RTC_STREAM || 'Xiaomi',
  sessionSecret: env.SESSION_SECRET || '',
  sessionTtlMs: Number(env.SESSION_TTL_HOURS || 12) * 3600_000,
  cookieSecure: env.COOKIE_SECURE === 'true',
  allowedOrigins: list(env.ALLOWED_ORIGINS),
  usersFile: path.resolve(SERVER_DIR, env.USERS_FILE || './users.json'),
  ptz: {
    driver: env.PTZ_DRIVER || 'none',
    exec: env.PTZ_EXEC || '',
    args: parseArgs(env.PTZ_EXEC_ARGS),
  },
  webDist: path.resolve(SERVER_DIR, '../web/dist'),
};

export function validateConfig() {
  if (config.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET wajib diisi (min 32 karakter). Lihat server/.env.example');
  }
  if (!['none', 'exec'].includes(config.ptz.driver)) {
    throw new Error(`PTZ_DRIVER tidak dikenal: ${config.ptz.driver}`);
  }
  if (config.ptz.driver === 'exec' && !config.ptz.exec) {
    throw new Error('PTZ_DRIVER=exec butuh PTZ_EXEC');
  }
}
