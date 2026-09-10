from __future__ import annotations
import importlib.util
import socket
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("deploy", HERE / "deploy-reservation-api-vps.py")
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)

for host in ("api-fiesta.roymarketing.ca", "aubaineexpress.voyagefiesta.ca"):
    try:
        print(host, socket.getaddrinfo(host, 443)[:2])
    except Exception as e:
        print(host, "dns fail", e)

c = d.connect()
env = d.load_env(d.DUPRO_ENV)
password = env.get("VPS_PASSWORD", "")
d.run(c, "command -v certbot; ls /etc/letsencrypt/live 2>/dev/null | tr '\\n' ' '")
d.run(c, "dig +short api-fiesta.roymarketing.ca A || getent hosts api-fiesta.roymarketing.ca")
c.close()
