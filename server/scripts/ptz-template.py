"""
Template driver PTZ untuk PTZ_DRIVER=exec.

Dipanggil server sebagai:  python scripts/ptz-template.py <up|down|left|right>
Exit code 0 = sukses, selain itu = gagal (stderr dicatat di log server).

go2rtc (per v1.9.x) BELUM expose perintah motor untuk kamera Xiaomi, jadi PTZ
harus lewat jalur lain. Opsi yang paling masuk akal: protokol MIoT lokal via
python-miio (pip install python-miio), pakai IP + token device (token bisa
diambil dengan "Xiaomi Cloud Tokens Extractor").

Nomor service/action (siid/aiid atau piid) untuk motor C301 harus dicek di
https://home.miot-spec.com/ berdasarkan model kamera kamu. BELUM diverifikasi -
isi sendiri setelah dicek, lalu ganti PTZ_EXEC_ARGS di .env ke script ini.
"""
import sys

DIRECTIONS = {"up", "down", "left", "right"}


def move(direction: str) -> None:
    # Contoh kerangka (sesuaikan setelah cek miot-spec):
    #
    # import os
    # from miio import Device
    # dev = Device(os.environ["CAM_IP"], os.environ["CAM_TOKEN"])
    # dev.send("action", {"did": "ptz", "siid": SIID, "aiid": AIID, "in": [VALUE[direction]]})
    raise NotImplementedError("Driver PTZ belum diisi - lihat docstring di file ini")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in DIRECTIONS:
        print("usage: ptz-template.py <up|down|left|right>", file=sys.stderr)
        sys.exit(2)
    try:
        move(sys.argv[1])
    except Exception as e:  # noqa: BLE001
        print(f"PTZ gagal: {e}", file=sys.stderr)
        sys.exit(1)
