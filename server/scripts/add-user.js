// Tambah / update user: npm run user:add -- <username> <viewer|controller>
import fs from 'node:fs';
import readline from 'node:readline';
import { config } from '../src/config.js';
import { hashPassword, loadUsers, ROLES } from '../src/auth.js';

const [username, role] = process.argv.slice(2);

if (!username || !ROLES.includes(role)) {
  console.error(`Pakai: npm run user:add -- <username> <${ROLES.join('|')}>`);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
// Jangan echo ketikan password ke terminal.
rl._writeToOutput = () => {};
// Iterator mem-buffer baris, jadi tetap jalan kalau input di-pipe.
const lines = rl[Symbol.asyncIterator]();

async function askHidden(question) {
  process.stdout.write(question);
  const { value } = await lines.next();
  process.stdout.write('\n');
  return value ?? '';
}

function fail(message) {
  console.error(message);
  rl.close();
  process.exit(1);
}

const password = await askHidden('Password: ');
if (password.length < 10) fail('Password minimal 10 karakter.');
if ((await askHidden('Ulangi password: ')) !== password) fail('Password tidak sama.');
rl.close();

const users = loadUsers().filter((u) => u.username !== username);
users.push({ username, role, hash: hashPassword(password) });
fs.writeFileSync(config.usersFile, JSON.stringify(users, null, 2) + '\n', { mode: 0o600 });
console.log(`User "${username}" (${role}) disimpan di ${config.usersFile}`);
