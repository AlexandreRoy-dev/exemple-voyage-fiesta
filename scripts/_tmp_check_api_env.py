"""Check VPS API env (no secrets) and whether a stable HTTPS route exists."""
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

cmds = [
    "grep -E '^(ALLOWED_ORIGINS|PORT|GHL_LOCATION_ID|GHL_CONTACT_TAG)=' /opt/voyage-fiesta-reservation/.env",
    "systemctl is-active voyage-fiesta-reservation",
    "command -v nginx && ls /etc/nginx/sites-enabled | tr '\\n' ' '",
    "curl -sSI http://127.0.0.1:3847/ | head -n 15",
]
for cmd in cmds:
    print("\n#####", cmd[:90])
    if cmd.startswith("grep") or cmd.startswith("systemctl") or "nginx" in cmd:
        d.sudo(c, cmd, password, timeout=40)
    else:
        d.run(c, cmd)

c.close()
