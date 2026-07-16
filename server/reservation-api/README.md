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

`config.js` → `GHL_RESERVATION_API_URL = 'http://158.69.1.173:3847/'`

## GHL

Contacts get tag `reservation-site` + notes with deposit / assurances / passengers.
Automate on that tag in GHL.
