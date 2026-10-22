import { execFile } from 'node:child_process';
import { config, SERVER_DIR } from './config.js';

export const DIRECTIONS = ['up', 'down', 'left', 'right'];

export function ptzEnabled() {
  return config.ptz.driver !== 'none';
}

// go2rtc belum punya API PTZ untuk Xiaomi, jadi gerakan diserahkan ke program
// eksternal (mis. script python-miio). direction sudah divalidasi sebelum sampai sini,
// dan execFile tidak lewat shell, jadi tidak ada injection.
export function movePtz(direction) {
  if (!DIRECTIONS.includes(direction)) {
    return Promise.reject(new Error('invalid direction'));
  }
  const args = config.ptz.args.map((a) => a.replaceAll('{direction}', direction));
  return new Promise((resolve, reject) => {
    execFile(config.ptz.exec, args, { cwd: SERVER_DIR, timeout: 5000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
