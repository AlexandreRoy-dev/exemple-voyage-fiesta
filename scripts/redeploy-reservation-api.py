#!/usr/bin/env python3
"""Upload server.mjs only and restart the service (keeps remote .env)."""
from __future__ import annotations

import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
LOCAL = ROOT / "server" / "reservation-api" / "server.mjs"
REMOTE_DIR = "/opt/voyage-fiesta-reservation"
SERVICE = "voyage-fiesta-reservation"

spec = importlib.util.spec_from_file_location(
    "deploy", HERE / "deploy-reservation-api-vps.py"
)
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)

if not LOCAL.exists():
    raise SystemExit(f"Missing {LOCAL}")

env = d.load_env(d.DUPRO_ENV)
password = env.get("VPS_PASSWORD", "")

c = d.connect()
try:
    sftp = c.open_sftp()
    remote = f"{REMOTE_DIR}/server.mjs"
    print(f"upload {LOCAL.name} -> {remote}", flush=True)
    sftp.put(str(LOCAL), remote)
    sftp.close()
    d.sudo(c, f"systemctl restart {SERVICE}", password)
    d.run(c, f"systemctl --no-pager is-active {SERVICE}")
    d.run(c, "curl -sS http://127.0.0.1:3847/health")
    print("DONE", flush=True)
finally:
    c.close()
