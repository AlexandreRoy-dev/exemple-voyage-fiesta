"""Upload reservation API and restart. No secrets printed."""
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
sftp = c.open_sftp()
sftp.put(str(d.API_DIR / "server.mjs"), f"{d.REMOTE_DIR}/server.mjs")
sftp.close()
d.sudo(c, f"systemctl restart {d.SERVICE_NAME}", password, timeout=60)
d.run(c, f"systemctl is-active {d.SERVICE_NAME}")
d.run(c, f"curl -sS http://127.0.0.1:{d.PORT}/health")
c.close()
print("deployed")
