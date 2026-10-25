# Reservation API (OVH VPS)

Node service on the same VPS as DuProprio (`158.69.1.173`).

- **Path on VPS:** `/opt/voyage-fiesta-reservation`
- **Service:** `systemctl status voyage-fiesta-reservation`
- **Public URL:** `http://158.69.1.173:3847/`
- **Health:** `GET /health`
- **Submit:** `POST /` or `POST /submit` with JSON `{ "payload": { ... } }`

## Redeploy

```powershell
$env:GHL_API_KEY = "pit-..."   # do not commit
$env:GHL_LOCATION_ID = "V90iyFBbBrCg3tpctRjc"
python scripts\deploy-reservation-api-vps.py
```

Secrets live only in `/opt/voyage-fiesta-reservation/.env` on the VPS (chmod 600).

## Site config

`config.js` → `GHL_RESERVATION_API_URL = 'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/'`

## GHL

Contacts get tag `reservation-site` + notes with deposit / assurances / passengers.
Automate on that tag in GHL.

`quickform` and `agent_slug` keep their current tags, source and owner lookup. `demande_prix` still uses `demande-prix` (that tag starts a client workflow; do not reuse it for groups).

## Facebook multipartage links

The multipartage app adds `?ref=<agent-slug>&ghl_user=<GHL user id>` to the link of each Facebook Page. `lead-ref.js` (loaded on every page with a form) keeps those values, plus `utm_*`, in `localStorage` for 30 days. Each form then sends them as `lead_ref`, `lead_ghl_user` and `lead_utm_*`. A newer link replaces the older one.

On submit:

- `lead_ghl_user` must be a user of the location (`GET /users/?locationId=`, cached 10 minutes). An unknown id, a deleted user or a failed lookup is ignored.
- If that id is ignored, `lead_ref` is looked up in `staff.json`. A known slug is the shared-link advisor.
- The shared-link advisor comes before the forfait owner and before `agent_slug`, for every request type, including `demande_groupe`.
- It is applied only when the contact is new or has no owner. An owned contact is never reassigned.
- `lead_ref` adds the tag `fb-<ref>` and a `Provenance` block (ref, GHL id, UTM) to the note.
- A lead without these fields behaves as before.

## Groupes Atrium

`GET /groupes.json` serves the file at `GROUPES_JSON_PATH` (default: `groupes.json` next to `server.mjs`). The sync that writes it is [`../atrium-sync/README.md`](../atrium-sync/README.md).

`POST /` with `request_type: demande_groupe` creates or updates the contact, adds tags `demande-groupe` and `groupe-<id>`, and writes a note whose source is `Site groupes Atrium`. A contact that already has an owner is not reassigned. `agent_slug` is resolved in `staff.json` when the shared link did not name an advisor. `GHL_GROUPE_DEFAULT_OWNER` applies only when the owner is still empty. The tag `demande-prix` is never sent for this type, even if the client includes it.

`GHL_GROUPE_NOTIFY` defaults to off. Set `GHL_GROUPE_NOTIFY=1` to send the internal email to `INTERNAL_NOTIFY_EMAILS`. Other request types are unchanged.

`AGENT_NOTIFY=1` sends that lead only to the advisor email in `staff.json`. `INTERNAL_NOTIFY_EMAILS` is not copied. The internal list is used when `AGENT_NOTIFY` is off (including the `GHL_GROUPE_NOTIFY` rule), or when `AGENT_NOTIFY` is on and the advisor has no email.

`DRY_RUN=1`, or `"dry_run": true` on the request, returns `{ ok, dryRun, contact, tags, note, assignedTo, notify }` and does not call GoHighLevel. The API key is not required in that mode.

`BIND_HOST` (or `HOST`) defaults to `127.0.0.1`. Nginx and the Cloudflare tunnel already proxy `127.0.0.1:3847`. A direct call to the public port 3847 from outside the VPS stops working with this default. Set `BIND_HOST=0.0.0.0` only if that raw port is still required.

When `ALLOWED_ORIGINS` is empty or unset, the allowed origins are:

- `https://aubaineexpress.voyagefiesta.ca`
- `https://www.aubaineexpress.voyagefiesta.ca`
- `https://voyagefiesta.com`
- `https://www.voyagefiesta.com`
- `https://promofiesta.roymarketing.ca`

`http://localhost` and `http://127.0.0.1` (any port) stay allowed. An explicit `ALLOWED_ORIGINS=*` still allows every origin. The production file uses `*`; do not delete that line unless you mean to replace it with the list above.

## Deploy on the VPS (manual)

Do not rely on a blind run of `scripts/deploy-reservation-api-vps.py` for this release. The script now merges `.env` instead of replacing it, and it uploads `atrium-sync/sync.mjs` and `map.mjs`, but it still rewrites the systemd unit. The steps below keep `INTERNAL_NOTIFY_EMAILS` and the current origins.

```bash
ssh ubuntu@158.69.1.173
sudo systemctl stop voyage-fiesta-reservation
cd /opt/voyage-fiesta-reservation
cp -a server.mjs server.mjs.bak-$(date +%Y%m%d)
cp -a .env .env.bak-$(date +%Y%m%d)
```

From this repo, copy `server/reservation-api/server.mjs`, `server/reservation-api/package.json`, `server/atrium-sync/sync.mjs` and `server/atrium-sync/map.mjs` to the server (`atrium-sync/` next to `server.mjs`). Then append, without removing existing lines:

```bash
BIND_HOST=127.0.0.1
GROUPES_JSON_PATH=/opt/voyage-fiesta-reservation/groupes.json
ATRIUM_API_KEY=the-atrium-key
ATRIUM_API_BASE=https://api.groupeatrium.com/v3
ATRIUM_OUTPUT=/opt/voyage-fiesta-reservation/groupes.json
GHL_GROUPE_TAG=demande-groupe
GHL_GROUPE_NOTIFY=0
GHL_GROUPE_DEFAULT_OWNER=
DRY_RUN=0
```

`GHL_GROUPE_NOTIFY=0` disables the internal email for `demande_groupe` only. Set it to `1` when that mail should go to `INTERNAL_NOTIFY_EMAILS`. Leave `GHL_GROUPE_DEFAULT_OWNER` empty so new contacts stay unassigned. Do not set `ATRIUM_API_KEY` in git.

```bash
chmod 600 /opt/voyage-fiesta-reservation/.env
sudo systemctl restart voyage-fiesta-reservation
curl -sS http://127.0.0.1:3847/health
cd /opt/voyage-fiesta-reservation && /usr/bin/node atrium-sync/sync.mjs
curl -sS http://127.0.0.1:3847/groupes.json | head -c 180
```

Cron, user `ubuntu`:

```cron
17 */2 * * * cd /opt/voyage-fiesta-reservation && /usr/bin/node atrium-sync/sync.mjs >> /var/log/atrium-sync.log 2>&1
```

Until that first sync succeeds, `/groupes/` shows a clear unavailable message. The search engines still work, because their lists ship with the static site.
