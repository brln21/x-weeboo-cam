# Weeboo Cam

Web app sendiri untuk melihat + mengontrol **Xiaomi Smart Camera C301** dari luar rumah,
tanpa app Xiaomi Home. Latar belakang & keputusan desain ada di [CONTEXT.md](CONTEXT.md).

```
[C301] ──miss/cs2──> [go2rtc 127.0.0.1:1984] <── [server/ :3000] <── [cloudflared] <── HTTPS ── browser
                                                   │
                                                   ├─ login (cookie sesi, role viewer/controller)
                                                   ├─ proxy WebSocket stream (WebRTC signaling + MSE)
                                                   ├─ snapshot, HLS fallback
                                                   ├─ PTZ (khusus controller)
                                                   └─ serve frontend (web/dist)
```

Browser **tidak pernah** bicara langsung ke go2rtc. Backend yang cek login dulu, lalu
meneruskan ke go2rtc dengan nama stream yang dikunci di server.

## Struktur

```
server/                 Backend Node (Express 5, tanpa database)
  src/index.js          Route API, proxy ke go2rtc, WebSocket upgrade
  src/auth.js           Hash password (scrypt), cookie sesi HMAC, rate limit login
  src/ptz.js            Driver PTZ (none | exec)
  scripts/add-user.js   Tambah/ubah user
  scripts/ptz-template.py  Kerangka driver PTZ (belum diisi)
  .env.example
web/                    Frontend React + Vite + TypeScript
  src/vendor/video-rtc.js   Player VideoRTC dari go2rtc (MIT, vendored)
  src/player/cam-player.ts  <cam-player> = VideoRTC tanpa UI, status via event
  src/components/       Login, CameraView, Player, PtzPad
go2rtc/go2rtc.yaml.example
deploy/cloudflared-config.yml.example
```

## Menjalankan (dev)

Butuh Node.js 20.12+ dan go2rtc yang sudah jalan (lihat `go2rtc/go2rtc.yaml.example`).

```bash
npm install
cp server/.env.example server/.env      # isi SESSION_SECRET, GO2RTC_URL, dst.
npm run user:add -- namamu controller   # minta password (min 10 karakter)

# dua terminal:
npm run dev:server    # backend di http://127.0.0.1:3000
npm run dev:web       # frontend di http://localhost:5173 (proxy /api ke backend)
```

Mau tes dari HP di LAN saat dev: `npm run dev:web -- --host`, lalu buka `http://<ip-laptop>:5173`.

## Produksi (laptop i5)

```bash
npm install
npm run build          # build frontend ke web/dist
npm start              # backend serve API + frontend di :3000
```

Di `server/.env` produksi set `COOKIE_SECURE=true` dan `ALLOWED_ORIGINS=https://cam.domainmu.com`.
Lalu jalankan `cloudflared` dengan `deploy/cloudflared-config.yml.example` (arahkan ke `:3000`).

Agar jalan otomatis 24/7 di Windows, daftarkan go2rtc, `npm start`, dan cloudflared sebagai service
(misalnya pakai NSSM, atau `cloudflared service install` untuk tunnel).

## User & role

| Role         | Bisa                                   |
|--------------|----------------------------------------|
| `viewer`     | Nonton, snapshot                       |
| `controller` | Semua yang viewer bisa + PTZ           |

- Tambah / ganti password: `npm run user:add -- <username> <viewer|controller>`
- Hapus user: hapus entry-nya dari `server/users.json`. Berlaku langsung (sesi user itu ikut mati),
  tanpa restart.
- Logout paksa semua orang: ganti `SESSION_SECRET` lalu restart server.

## PTZ — status

go2rtc (v1.9.14) **belum** menyediakan API PTZ untuk kamera Xiaomi: command motor
(`cmdMotorReq`) memang ada di kode protokol `miss`-nya, tapi belum dipakai di mana pun. Jadi PTZ dibuat
lewat driver yang bisa diganti:

- `PTZ_DRIVER=none` (default): tombol PTZ tidak muncul.
- `PTZ_DRIVER=exec`: tiap tombol menjalankan `PTZ_EXEC PTZ_EXEC_ARGS` dengan `{direction}` =
  `up|down|left|right`. Kerangkanya ada di `server/scripts/ptz-template.py` (rencananya pakai
  python-miio + token device). siid/aiid motor C301 **belum diverifikasi**, jadi cek dulu di
  https://home.miot-spec.com/.

## Catatan

- **Codec:** player minta H.264 (hasil transcode go2rtc). Urutan mode: WebRTC → MSE → HLS → MJPEG.
- **Lewat tunnel:** signaling WebRTC jalan lewat WebSocket, tapi media WebRTC butuh jalur UDP/TCP langsung
  ke port 8555. Kalau tidak tembus, player otomatis pakai MSE lewat WebSocket (latency sedikit lebih tinggi,
  tapi selalu jalan lewat Cloudflare).
- **Keamanan:** go2rtc & backend bind ke `127.0.0.1`. Cookie `HttpOnly` + `SameSite=Strict`, Origin dicek
  di POST & WebSocket, login dibatasi 10 kali gagal / 15 menit per IP, role diambil dari `users.json`
  setiap request (bukan dari cookie).
