from __future__ import annotations
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("deploy", HERE / "deploy-reservation-api-vps.py")
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
c = d.connect()
env = d.load_env(d.DUPRO_ENV)
password = env.get("VPS_PASSWORD", "")
d.sudo(
    c,
    "journalctl -u voyage-fiesta-reservation --since '2026-09-09 11:00' --no-pager | tail -n 60",
    password,
)
c.close()
