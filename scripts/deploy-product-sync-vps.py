#!/usr/bin/env python3
"""Deploy Voyage Fiesta GHL product sync to the DuProprio OVH VPS (15-min cron)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

HERE = Path(__file__).resolve().parent
_DUPRO_CANDIDATES = [
    Path(os.path.expanduser(r"~\OneDrive - Codesk\01. Roy Marketing\Clients\duproprio sync\scripts\deploy.local.env")),
    Path(r"C:\Users\Admin\OneDrive - Codesk\01. Roy Marketing\Clients\duproprio sync\scripts\deploy.local.env"),
]
DUPRO_ENV = next((p for p in _DUPRO_CANDIDATES if p.exists()), _DUPRO_CANDIDATES[0])

REMOTE_APP = "/home/ubuntu/voyage-fiesta-sync"
REMOTE_REPO = f"{REMOTE_APP}/repo"
REMOTE_KEY = "/home/ubuntu/.ssh/voyage-fiesta-sync"
GIT_SSH_URL = "git@github.com:AlexandreRoy-dev/exemple-voyage-fiesta.git"
GIT_HTTPS_URL = "https://github.com/AlexandreRoy-dev/exemple-voyage-fiesta.git"
SCHEMA_KEY = "custom_objects.voyages"


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
        print(out, end="" if out.endswith("\n") else "\n", flush=True)
    if err.strip():
        print(err[:800], end="" if err.endswith("\n") else "\n", flush=True)
    return code, out, err


def github_token() -> str:
    for name in ("GH_TOKEN", "GITHUB_TOKEN", "GITHUB_PAT"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    try:
        proc = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n\n",
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    token = ""
    for line in (proc.stdout or "").splitlines():
        if line.startswith("password="):
            token = line.split("=", 1)[1].strip()
            break
    if token.startswith(("ghp_", "github_pat_", "gho_", "ghu_")):
        return token
    return ""


def add_deploy_key(pubkey: str) -> bool:
    token = github_token()
    if not token:
        print("No GitHub token in env / credential manager — add the deploy key by hand.", flush=True)
        return False
    body = json.dumps(
        {
            "title": "vps-voyage-fiesta-sync",
            "key": pubkey.strip(),
            "read_only": False,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.github.com/repos/AlexandreRoy-dev/exemple-voyage-fiesta/keys",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "voyage-fiesta-vps-sync",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"Deploy key added (HTTP {resp.status})", flush=True)
            return True
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        if exc.code == 422 and "key already exists" in detail.lower():
            print("Deploy key already exists on the repo — OK", flush=True)
            return True
        print(f"Could not add deploy key (HTTP {exc.code}): {detail[:300]}", flush=True)
        return False


def main() -> None:
    for name in ("run-vps-product-sync.sh", "install-vps-product-sync-cron.sh"):
        if not (HERE / name).exists():
            raise SystemExit(f"Missing {HERE / name}")

    c = connect()
    sftp = c.open_sftp()

    run(c, f"mkdir -p {REMOTE_APP}/scripts {REMOTE_APP}/logs {REMOTE_REPO} /home/ubuntu/.ssh")
    run(c, "chmod 700 /home/ubuntu/.ssh")

    if run(c, f"test -f {REMOTE_KEY}")[0] != 0:
        run(
            c,
            f'ssh-keygen -t ed25519 -f {REMOTE_KEY} -N "" -C "voyage-fiesta-vps-sync"',
        )
    run(c, f"chmod 600 {REMOTE_KEY} {REMOTE_KEY}.pub")
    run(c, "ssh-keyscan -t ed25519 github.com >> /home/ubuntu/.ssh/known_hosts 2>/dev/null || true")

    _, pubkey, _ = run(c, f"cat {REMOTE_KEY}.pub")
    pubkey = pubkey.strip()
    print("VPS deploy public key:", flush=True)
    print(pubkey, flush=True)
    key_ok = add_deploy_key(pubkey)

    for name in ("run-vps-product-sync.sh", "install-vps-product-sync-cron.sh"):
        local = HERE / name
        remote = f"{REMOTE_APP}/scripts/{name}"
        print(f"upload {name} -> {remote}", flush=True)
        sftp.put(str(local), remote)
        run(c, f"sed -i 's/\\r$//' {remote} && chmod +x {remote}")

    # Reuse the reservation API PIT already on the VPS. Do not print it.
    env_cmd = f"""
set -euo pipefail
RES=/opt/voyage-fiesta-reservation/.env
if [ ! -f "$RES" ]; then
  echo "missing $RES" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$RES"
set +a
umask 077
cat > {REMOTE_APP}/.env <<EOF
GHL_API_KEY=$GHL_API_KEY
GHL_LOCATION_ID=${{GHL_LOCATION_ID:-V90iyFBbBrCg3tpctRjc}}
GHL_OBJECT_SCHEMA_KEY={SCHEMA_KEY}
SYNC_SSH_KEY={REMOTE_KEY}
EOF
chmod 600 {REMOTE_APP}/.env
echo wrote {REMOTE_APP}/.env
"""
    code, _, _ = run(c, env_cmd)
    if code != 0:
        raise SystemExit("Could not write VPS .env from reservation API secrets")

    if run(c, f"test -d {REMOTE_REPO}/.git")[0] != 0:
        clone = (
            f"GIT_SSH_COMMAND='ssh -i {REMOTE_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new' "
            f"git clone --branch main --single-branch {GIT_SSH_URL} {REMOTE_REPO}"
        )
        code, _, _ = run(c, clone, timeout=180)
        if code != 0:
            print("SSH clone failed — trying HTTPS (public repo only)", flush=True)
            run(c, f"rm -rf {REMOTE_REPO}")
            code, _, _ = run(c, f"git clone --branch main --single-branch {GIT_HTTPS_URL} {REMOTE_REPO}", timeout=180)
            if code != 0:
                raise SystemExit(
                    "Could not clone the repo. Add the deploy key above to GitHub "
                    "(Settings → Deploy keys → Allow write access), then rerun this script."
                )
        run(c, f"git -C {REMOTE_REPO} remote set-url origin {GIT_SSH_URL}")
    else:
        run(c, f"git -C {REMOTE_REPO} remote set-url origin {GIT_SSH_URL}")
        run(
            c,
            f"GIT_SSH_COMMAND='ssh -i {REMOTE_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new' "
            f"git -C {REMOTE_REPO} fetch origin main && git -C {REMOTE_REPO} reset --hard origin/main",
            timeout=180,
        )

    run(c, f"git -C {REMOTE_REPO} config user.name voyage-fiesta-vps")
    run(c, f"git -C {REMOTE_REPO} config user.email sync@voyagefiesta.local")

    run(c, f"bash {REMOTE_APP}/scripts/install-vps-product-sync-cron.sh")

    print("\nRunning first sync now...", flush=True)
    code, _, _ = run(c, f"bash {REMOTE_APP}/scripts/run-vps-product-sync.sh", timeout=180)
    run(c, f"tail -n 40 {REMOTE_APP}/logs/sync.log || true")

    sftp.close()
    c.close()

    if code != 0 and not key_ok:
        print(
            "\nAdd this deploy key on GitHub with write access, then rerun:\n"
            "  python scripts/deploy-product-sync-vps.py\n"
            f"  {pubkey}"
        )
        sys.exit(1)
    if code != 0:
        raise SystemExit("First sync failed — see output above / logs/sync.log on the VPS")
    print("\nDONE. Cron every 15 min on the DuProprio VPS.")
    print(f"  app: {REMOTE_APP}")
    print("  log: /home/ubuntu/voyage-fiesta-sync/logs/sync.log")


if __name__ == "__main__":
    main()
