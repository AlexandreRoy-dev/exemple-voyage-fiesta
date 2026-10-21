#!/usr/bin/env python3
"""Deploy Voyage Fiesta reservation API to the OVH VPS (same host as DuProprio).

Merges new keys into the remote .env. It does not drop INTERNAL_NOTIFY_EMAILS
or rewrite ALLOWED_ORIGINS. Prefer the manual steps in
server/reservation-api/README.md when adding ATRIUM_API_KEY.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent  # exemple voyage fiesta
API_DIR = ROOT / "server" / "reservation-api"
_DUPRO_CANDIDATES = [
    Path(os.path.expanduser(r"~\OneDrive - Codesk\01. Roy Marketing\Clients\duproprio sync\scripts\deploy.local.env")),
    Path(r"C:\Users\Admin\OneDrive - Codesk\01. Roy Marketing\Clients\duproprio sync\scripts\deploy.local.env"),
    Path(r"C:\Users\Alex\OneDrive - Codesk\01. Roy Marketing\Clients\duproprio sync\scripts\deploy.local.env"),
]
DUPRO_ENV = next((p for p in _DUPRO_CANDIDATES if p.exists()), _DUPRO_CANDIDATES[0])

REMOTE_DIR = "/opt/voyage-fiesta-reservation"
SERVICE_NAME = "voyage-fiesta-reservation"
PORT = 3847


def merge_env(existing: str, required: dict[str, str], defaults: dict[str, str]) -> str:
    """Update required keys, keep every other line, append missing defaults."""
    lines = existing.splitlines()
    values: dict[str, str] = {}
    order: list[tuple[str, str]] = []
    for line in lines:
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in line:
            order.append(("raw", line))
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        values[key] = value.strip()
        order.append(("key", key))
    for key, value in required.items():
        values[key] = value
        if ("key", key) not in order:
            order.append(("key", key))
    for key, value in defaults.items():
        if key not in values:
            values[key] = value
            order.append(("key", key))
    out: list[str] = []
    seen: set[str] = set()
    for kind, item in order:
        if kind == "raw":
            out.append(item)
            continue
        if item in seen:
            continue
        seen.add(item)
        out.append(f"{item}={values[item]}")
    return "\n".join(out).rstrip() + "\n"


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def connect() -> paramiko.SSHClient:
    env = load_env(DUPRO_ENV)
    host = env.get("VPS_HOST", os.environ.get("VPS_HOST", "158.69.1.173"))
    user = env.get("VPS_USER", os.environ.get("VPS_USER", "ubuntu"))
    password = env.get("VPS_PASSWORD", os.environ.get("VPS_PASSWORD", ""))
    key = Path(env.get("VPS_SSH_KEY", os.path.expanduser("~/.ssh/ovh_vps"))).expanduser()

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if key.exists():
        c.connect(host, username=user, key_filename=str(key), timeout=45)
    elif password:
        c.connect(host, username=user, password=password, timeout=45)
    else:
        raise SystemExit("Need VPS_PASSWORD in duproprio deploy.local.env or ~/.ssh/ovh_vps")
    print(f"connected {user}@{host}", flush=True)
    return c


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    print(f"$ {cmd}", flush=True)
    _stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe = out.encode("ascii", "replace").decode("ascii")
        print(safe, end="" if safe.endswith("\n") else "\n", flush=True)
    if err.strip():
        safe = err.encode("ascii", "replace").decode("ascii")
        print(safe, end="" if safe.endswith("\n") else "\n", flush=True)
    return code, out, err


def sudo(c: paramiko.SSHClient, cmd: str, password: str, timeout: int = 180) -> tuple[int, str, str]:
    code, out, err = run(c, f"sudo -n bash -lc {repr(cmd)}", timeout=timeout)
    if code == 0:
        return code, out, err
    if password:
        # Avoid arrow / unicode issues in sudo prompts
        script = f"#!/bin/bash\necho {repr(password)} | sudo -S bash -lc {repr(cmd)}\n"
        return run(c, f"bash -lc {repr(script)}", timeout=timeout)
    print(f"sudo failed ({code}): {err[:500]}", flush=True)
    return code, out, err


def main() -> None:
    api_key = os.environ.get("GHL_API_KEY", "").strip()
    location_id = os.environ.get("GHL_LOCATION_ID", "V90iyFBbBrCg3tpctRjc").strip()
    if not api_key:
        print("Set GHL_API_KEY in the environment before running this script.", file=sys.stderr)
        sys.exit(1)

    if not (API_DIR / "server.mjs").exists():
        raise SystemExit(f"Missing {API_DIR / 'server.mjs'}")

    deploy_env = load_env(DUPRO_ENV)
    password = deploy_env.get("VPS_PASSWORD", "")

    c = connect()
    sftp = c.open_sftp()

    # Ensure remote dir
    sudo(c, f"mkdir -p {REMOTE_DIR} && chown ubuntu:ubuntu {REMOTE_DIR}", password)

    sudo(c, f"mkdir -p {REMOTE_DIR}/atrium-sync && chown -R ubuntu:ubuntu {REMOTE_DIR}", password)
    for name in ("server.mjs", "package.json"):
        local = API_DIR / name
        remote = f"{REMOTE_DIR}/{name}"
        print(f"upload {name} -> {remote}", flush=True)
        sftp.put(str(local), remote)
    sync_dir = ROOT / "server" / "atrium-sync"
    for name in ("sync.mjs", "map.mjs"):
        remote = f"{REMOTE_DIR}/atrium-sync/{name}"
        print(f"upload atrium-sync/{name} -> {remote}", flush=True)
        sftp.put(str(sync_dir / name), remote)

    env_remote = f"{REMOTE_DIR}/.env"
    existing = ""
    try:
        with sftp.file(env_remote, "r") as f:
            existing = f.read().decode("utf-8", errors="replace")
    except IOError:
        existing = ""
    env_body = merge_env(
        existing,
        {
            "GHL_API_KEY": api_key,
            "GHL_LOCATION_ID": location_id,
        },
        {
            "PORT": str(PORT),
            "BIND_HOST": "127.0.0.1",
            "GHL_CONTACT_TAG": "reservation-site",
            "GHL_PRICE_REQUEST_TAG": "demande-prix",
            "GHL_GROUPE_TAG": "demande-groupe",
            "GHL_GROUPE_NOTIFY": "0",
            "GHL_GROUPE_DEFAULT_OWNER": "",
            "DRY_RUN": "0",
            "GROUPES_JSON_PATH": f"{REMOTE_DIR}/groupes.json",
        },
    )
    with sftp.file(env_remote, "w") as f:
        f.write(env_body)
    run(c, f"chmod 600 {env_remote}")

    # Node install
    code, _, _ = run(c, "command -v node && node -v")
    if code != 0:
        print("Installing Node.js 20...", flush=True)
        sudo(
            c,
            "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
            password,
            timeout=300,
        )

    run(c, f"cd {REMOTE_DIR} && npm install --omit=dev", timeout=180)

    unit = f"""[Unit]
Description=Voyage Fiesta reservation API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory={REMOTE_DIR}
EnvironmentFile={REMOTE_DIR}/.env
ExecStart=/usr/bin/node {REMOTE_DIR}/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
    # Write unit via temp then sudo move
    tmp_unit = "/tmp/voyage-fiesta-reservation.service"
    with sftp.file(tmp_unit, "w") as f:
        f.write(unit)
    sudo(
        c,
        f"mv {tmp_unit} /etc/systemd/system/{SERVICE_NAME}.service && systemctl daemon-reload && systemctl enable --now {SERVICE_NAME} && systemctl restart {SERVICE_NAME}",
        password,
    )

    run(c, f"systemctl --no-pager status {SERVICE_NAME} | head -n 20")
    run(c, f"curl -sS http://127.0.0.1:{PORT}/health")

    # Nginx site if nginx exists
    code, _, _ = run(c, "command -v nginx")
    if code == 0:
        nginx_conf = f"""server {{
    listen 80;
    server_name api-fiesta.roymarketing.ca 158.69.1.173;

    location /reservation/ {{
        proxy_pass http://127.0.0.1:{PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
        tmp_ng = "/tmp/voyage-fiesta-reservation.nginx"
        with sftp.file(tmp_ng, "w") as f:
            f.write(nginx_conf)
        sudo(
            c,
            f"mv {tmp_ng} /etc/nginx/sites-available/{SERVICE_NAME} && ln -sfn /etc/nginx/sites-available/{SERVICE_NAME} /etc/nginx/sites-enabled/{SERVICE_NAME} && nginx -t && systemctl reload nginx",
            password,
        )
        print("nginx route: http://158.69.1.173/reservation/", flush=True)
    else:
        print(f"nginx not found — open firewall for TCP {PORT} or install nginx", flush=True)
        sudo(c, f"ufw allow {PORT}/tcp || true", password)

    sftp.close()
    c.close()
    print("\nDONE. Point config.js GHL_RESERVATION_API_URL to:")
    print("  https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/")
    print(f"  (HTTP fallback: http://158.69.1.173/reservation/ or :{PORT})")


if __name__ == "__main__":
    main()
