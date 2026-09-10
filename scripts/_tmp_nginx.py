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
    "cat /etc/nginx/sites-enabled/voyage-fiesta-reservation /etc/nginx/sites-available/voyage-fiesta-reservation 2>/dev/null | head -n 80",
    password,
)
c.close()
