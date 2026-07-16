import paramiko
from pathlib import Path

env = {}
p = Path(r"C:\Users\Alex\OneDrive - Codesk\01. Roy Marketing\Clients\duproprio sync\scripts\deploy.local.env")
for line in p.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    env.get("VPS_HOST", "158.69.1.173"),
    username=env.get("VPS_USER", "ubuntu"),
    password=env.get("VPS_PASSWORD", ""),
    timeout=30,
)


def run(cmd, timeout=180):
    print("$", cmd, flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        print(out.encode("ascii", "replace").decode(), end="" if out.endswith("\n") else "\n", flush=True)
    if err.strip():
        print(err.encode("ascii", "replace").decode(), end="" if err.endswith("\n") else "\n", flush=True)
    return code


pw = env.get("VPS_PASSWORD", "")


def sudo(cmd, timeout=300):
    code = run(f"sudo -n bash -lc {repr(cmd)}", timeout=timeout)
    if code == 0:
        return code
    return run(f"echo {repr(pw)} | sudo -S bash -lc {repr(cmd)}", timeout=timeout)


run("curl -sS http://127.0.0.1:3847/health")
run("systemctl is-active voyage-fiesta-reservation")

# Install nginx + certbot
sudo("apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx")
sudo("ufw allow 'Nginx Full' || ufw allow 80/tcp; ufw allow 443/tcp || true")

nginx_conf = """
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /reservation/ {
        proxy_pass http://127.0.0.1:3847/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3847/health;
    }
}
"""
tmp = "/tmp/vf-reservation.conf"
sftp = c.open_sftp()
with sftp.file(tmp, "w") as f:
    f.write(nginx_conf)
sftp.close()

sudo(f"mv {tmp} /etc/nginx/sites-available/voyage-fiesta-reservation")
sudo("rm -f /etc/nginx/sites-enabled/default")
sudo("ln -sfn /etc/nginx/sites-available/voyage-fiesta-reservation /etc/nginx/sites-enabled/voyage-fiesta-reservation")
sudo("nginx -t && systemctl enable --now nginx && systemctl reload nginx")

run("curl -sS http://127.0.0.1/reservation/health")
run("curl -sS http://127.0.0.1/health")

# Install cloudflared for quick HTTPS tunnel (site is HTTPS → needs HTTPS API)
code = run("command -v cloudflared")
if code != 0:
    sudo(
        "curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb && dpkg -i /tmp/cloudflared.deb || apt-get install -f -y"
    )

# systemd service for named quick tunnel is ephemeral; use a persistent local tunnel config
# For stable HTTPS without custom domain yet: cloudflared tunnel --url http://127.0.0.1:3847
# We'll create a systemd oneshot that writes the URL to a file on start.

unit = """[Unit]
Description=Cloudflared quick tunnel for Voyage Fiesta reservation API
After=network-online.target voyage-fiesta-reservation.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3847
Restart=always
RestartSec=5
StandardOutput=append:/var/log/vf-cloudflared.log
StandardError=append:/var/log/vf-cloudflared.log

[Install]
WantedBy=multi-user.target
"""

# Find cloudflared path
run("which cloudflared || ls /usr/bin/cloudflared /usr/local/bin/cloudflared 2>/dev/null")
cf_path = "/usr/bin/cloudflared"
unit = unit.replace("/usr/local/bin/cloudflared", cf_path)

sftp = c.open_sftp()
with sftp.file("/tmp/vf-cloudflared.service", "w") as f:
    f.write(unit)
sftp.close()

sudo("touch /var/log/vf-cloudflared.log && chown ubuntu:ubuntu /var/log/vf-cloudflared.log")
sudo("mv /tmp/vf-cloudflared.service /etc/systemd/system/vf-cloudflared.service && systemctl daemon-reload && systemctl enable --now vf-cloudflared && systemctl restart vf-cloudflared")

import time
time.sleep(4)
run("sleep 3; grep -oE 'https://[a-zA-Z0-9.-]+\\.trycloudflare\\.com' /var/log/vf-cloudflared.log | tail -n 1")
run("systemctl --no-pager status vf-cloudflared | head -n 15")

c.close()
print("DONE", flush=True)
