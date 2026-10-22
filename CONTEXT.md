# CONTEXT — Self-Hosted Xiaomi C301 Viewer App

> File handoff dari sesi perencanaan di Claude chat ke Claude Code.
> Taruh di root repo. Baca file ini dulu sebelum mulai coding.

## Tujuan Project
Bikin **app sendiri** (web app) untuk melihat + mengontrol **Xiaomi Smart Camera C301**
secara **online dari luar rumah**, lepas dari app Xiaomi Home. App dibuka publik
(bisa diakses orang lain) dengan login.

Prinsip inti: **app TIDAK ngomong langsung ke kamera**. Kamera cuma bisa diajak ngomong
lewat protokol tertutup Xiaomi (`miss`/cs2), yang sudah di-reverse-engineer oleh
**go2rtc** (AlexxIT). Jadi go2rtc = engine; app = front-end yang konsumsi output go2rtc.

## Perangkat
- **Kamera:** Xiaomi Smart Camera C301 — 2304×1296 (2K), pan-tilt (PTZ), codec **H.265/HEVC**,
  WiFi 2.4GHz, audio keluar sebagai G.711 (PCMA).
- **Server produksi (rencana):** laptop spare, Intel **i5 (2015)**, RAM 12GB, storage 500GB,
  dipakai nyala 24/7. BELUM dikonfirmasi generasi i5-nya (perlu cek QuickSync buat
  hardware transcode — lihat Open Items).
- **Server tes (sekarang):** laptop uji coba terpisah. go2rtc jalan di sini untuk validasi.

## Status Sekarang (SUDAH BERES ✅)
- go2rtc jalan di laptop tes, source Xiaomi sudah login & authenticated.
- Nama stream di go2rtc: **`Xiaomi`** (auto-generated, bukan `c301`).
- Dikonfirmasi kamera kirim **H.265**. Ditambah transcode ke **H.264** di stream yang sama.
- **Playback diverifikasi jalan di HP** (LAN, lewat MSE). → Keputusan codec terkunci:
  **app konsumsi H.264**, jangan andalkan H.265 (banyak browser user nolak HEVC).

## Konfigurasi go2rtc (state tes saat ini)
```yaml
# go2rtc.yaml — JANGAN commit yang asli (berisi token akun). Pakai .example di repo.
xiaomi:
  "<ACCOUNT_ID>": "V1:<TOKEN>"      # terisi otomatis setelah login di WebUI

streams:
  Xiaomi:
    - xiaomi://<ACCOUNT_ID>:<REGION>@<CAMERA_IP>?did=<DID>&model=<MODEL>
    - "ffmpeg:Xiaomi#video=h264"     # transcode H265 -> H264 (software, di laptop tes)
```
Nilai rahasia yang HARUS keluar dari repo: `ACCOUNT_ID`, `TOKEN`, `REGION`, `CAMERA_IP`,
`DID`, `MODEL`. Simpan di `go2rtc.yaml` (di-.gitignore) atau `.env`.

### Endpoint go2rtc yang dipakai app
- MSE/WebRTC player: `http://<SERVER>:1984/stream.html?src=Xiaomi`
- WebSocket (buat player custom): `ws://<SERVER>:1984/api/ws?src=Xiaomi`
- RTSP: `rtsp://<SERVER>:8554/Xiaomi`
- Snapshot JPEG: `http://<SERVER>:1984/api/frame.jpeg?src=Xiaomi`
- Two-way audio: didukung go2rtc (lewat WebSocket/WebRTC).
- PTZ: **TIDAK** ada API-nya di go2rtc untuk Xiaomi (dicek di source v1.9.14: `cmdMotorReq`
  didefinisikan di `pkg/xiaomi/miss/client.go` tapi tidak dipakai). Lihat bagian Progress.

## Arsitektur Target
```
[C301] → [go2rtc @ laptop i5, bind localhost] → [Cloudflare Tunnel] → [domain HTTPS]
                                                                           ↓
          [App React] ← auth (Cloudflare Access / Supabase / Clerk) ──────┘
```
- **Transport:** Cloudflare Tunnel (publik, tanpa buka port) — SUDAH DIPILIH.
- **Auth:** wajib. Opsi cepat = Cloudflare Access; opsi proper = login di app (Supabase/Clerk)
  + backend jadi satu-satunya yang boleh minta stream ke go2rtc.
- **Role:** pisahkan **viewer** (cuma nonton) vs **controller** (boleh PTZ).

## Stack App (saran)
- Frontend: **React** (Lovable/Vite). User nyaman di React.
- Player: pakai **VideoRTC web component** dari go2rtc (low-latency WebRTC, fallback MSE).
- PTZ: tombol panah → panggil API PTZ go2rtc lewat backend.

## Open Items / Next Steps (urut prioritas)
1. **Pindah go2rtc ke laptop i5 produksi.** Konfirmasi generasi i5 (`wmic cpu get name`).
   Kalau Skylake (i5-6xxx) → ganti transcode ke hardware QuickSync:
   `"ffmpeg:Xiaomi#video=h264#hardware"` biar ringan.
2. **Cloudflare Tunnel** (`cloudflared`) di depan go2rtc (bind localhost). Dapat domain + HTTPS.
3. **Auth layer** + pemisahan role viewer/controller.
4. **App React:** player WebRTC + kontrol PTZ + halaman login.
5. **Audio transcode** (G.711/PCMA → AAC/Opus) — minor, belakangan.
6. (Opsional) **Rekaman lokal** ke storage 500GB.

## Catatan Keamanan (non-negotiable, karena publik)
- JANGAN expose go2rtc mentah ke internet. Selalu di balik tunnel + auth.
- HTTPS wajib (Cloudflare kasih otomatis).
- Ini kamera di rumah — kalau endpoint bocor, orang bisa ngintip & muterin kamera.
  Auth serius dari hari pertama.
- Tiap connect, go2rtc tetap ambil encryption key dari cloud Xiaomi (butuh internet sebentar).
  Jadi "tanpa app Xiaomi" ✅, tapi bukan 100% offline.

## Prompt pertama buat Claude Code
> Baca CONTEXT.md. Status: go2rtc sudah streaming C301 (H264 transcode, verified di HP).
> Bantu scaffold React app (Vite) dengan: player WebRTC pakai VideoRTC component dari go2rtc
> (src=Xiaomi), kontrol PTZ, dan halaman login. Mulai dari struktur folder + player dulu,
> go2rtc-nya aku arahkan nanti lewat env var.

## Progress (update dari Claude Code)

### Sesi 1 — scaffold app ✅
- Monorepo npm workspaces: `server/` (Express 5) + `web/` (React 19 + Vite + TS). Detail di README.md.
- **Auth proper sudah jadi** (bukan Cloudflare Access): login di app, user di `server/users.json`
  (scrypt), cookie sesi HMAC `HttpOnly; SameSite=Strict`, role `viewer`/`controller`,
  rate limit login, cek Origin di POST + WebSocket.
- **Backend = satu-satunya jalur ke go2rtc.** Endpoint publik:
  `POST /api/auth/login|logout`, `GET /api/auth/me`, `GET /api/camera/info`,
  `GET /api/camera/snapshot`, `GET /api/camera/hls/*`, `WS /api/camera/ws`,
  `POST /api/camera/ptz` (controller saja). Nama stream dikunci di `GO2RTC_STREAM`.
- Player: `video-rtc.js` go2rtc di-vendor, dibungkus `<cam-player>` (mode webrtc,mse,hls,mjpeg).
- Sudah dites dengan go2rtc 1.9.14 + stream dummy: login, role, origin check, rate limit,
  snapshot, dan video lewat WebSocket proxy jalan di browser.
- PTZ: driver pluggable (`PTZ_DRIVER=none|exec`). Default `none` → tombol disembunyikan.

### Sesi 2 — debug layar hitam di laptop tes
- Error go2rtc: `miss: read media: cs2: pop buffer is full` (model `mxiang.camera.c301`).
- Sebab (dari source go2rtc `internal/streams/add_consumer.go` + `pkg/xiaomi/miss/cs2/conn.go`):
  source `xiaomi://` dan `ffmpeg:Xiaomi#video=h264` di stream yang sama → go2rtc menyambung ke
  kamera dulu untuk audio, lalu menunggu ffmpeg. Selama menunggu, antrean media cs2 (100 paket)
  penuh dan koneksi diputus. Ini muncul sejak player tidak lagi menawarkan H.265.
- Solusi: pisahkan `Xiaomi_raw` (xiaomi://) dan `Xiaomi` (`ffmpeg:Xiaomi_raw#video=h264#audio=opus`).
  Lihat go2rtc/go2rtc.yaml.example.

### Next steps
1. Tes app dengan C301 asli (isi `server/.env`, arahkan ke go2rtc laptop tes).
2. PTZ: cari siid/aiid motor C301 di home.miot-spec.com, isi `server/scripts/ptz-template.py`
   (python-miio + token device). Alternatif: PR ke go2rtc pakai `cmdMotorReq`.
3. Pindah ke laptop i5 + QuickSync, pasang cloudflared ke `:3000`, `COOKIE_SECURE=true`.
4. Audio (unmute sudah ada di UI; transcode PCMA → Opus/AAC di go2rtc kalau perlu).
