# Cursor handoff (2026-08-31)

**Use this file to continue Voyage Fiesta.** Older `CURSOR-HANDOFF.txt` is from 2026-06-20 and is outdated (live URL, iframe form, GitHub cron).

**Next session prompt:** `Continuing Voyage Fiesta. Read @Cursor handoff (2026-08-31).md`

When a chat is near the context limit (~80%+), write a new `Cursor handoff (YYYY-MM-DD).md` in this repo before the thread dies.

---

## 1. Live stack (truth as of 31 Aug 2026)

| What | Value |
|------|--------|
| Client | Éric Lacasse / Voyage Fiesta + Mariage Sud (Roy Marketing) |
| Live boutique | https://aubaineexpress.voyagefiesta.ca/ |
| Sub-boutique | `https://aubaineexpress.voyagefiesta.ca/?agent=<owner.slug>` |
| Old preview URL | `promofiesta.roymarketing.ca` — do not use |
| GitHub | https://github.com/AlexandreRoy-dev/exemple-voyage-fiesta.git (`main`) |
| GHL location | `V90iyFBbBrCg3tpctRjc` — **Mariage Sud et Voyage Fiesta** |
| Custom object | `custom_objects.voyages` |
| Sending domain | `promo.voyagefiesta.com` |
| Permis | 703631 |
| Brand | `#025091` / `#F26522` |
| Language | Quebec French. No em dashes in client copy. |

**GHL MCP `locations_get-location` is often bound to the wrong location (Steven Lavoie).** For Voyage Fiesta always use the PIT + location `V90iyFBbBrCg3tpctRjc`. PIT lives in gitignored `.cursor/mcp.json`. API calls need a browser User-Agent or Cloudflare returns 1010.

**Do not PUT/update existing contacts** from the old agence create-only import.

---

## 2. Data flow

```
GHL Custom Object "Voyage"
    → OVH VPS cron every 15 min (America/Montreal)
    → scripts/sync-ghl-products.mjs
    → git push products.json + agents.json + assets/forfaits + share/
    → GitHub Pages (~1–2 min)
    → api.js → index.html / product.html
```

VPS: `158.69.1.173` (ubuntu). SSH key `~/.ssh/ovh_vps`. Password in DuProprio `duproprio sync/scripts/deploy.local.env` — never print secrets.

| Path | Role |
|------|------|
| `/home/ubuntu/voyage-fiesta-sync` | App + cron |
| `/home/ubuntu/voyage-fiesta-sync/repo` | Git clone |
| `/home/ubuntu/voyage-fiesta-sync/logs/sync.log` | Log |
| `/home/ubuntu/voyage-fiesta-sync/scripts/run-vps-product-sync.sh` | Job |
| Deploy key on GitHub | `vps-voyage-fiesta-sync` (write) |
| GHL env | Copied from `/opt/voyage-fiesta-reservation/.env` + `GHL_OBJECT_SCHEMA_KEY=custom_objects.voyages` |
| GitHub Actions `sync-products.yml` | **workflow_dispatch only** (no schedule — it skipped under load) |

Manual sync:

```bash
ssh ubuntu@158.69.1.173
bash /home/ubuntu/voyage-fiesta-sync/scripts/run-vps-product-sync.sh
```

From Windows: `python scripts/deploy-product-sync-vps.py`

Last catalog sync seen: 8 forfaits (7 `actif`, 1 `pre_vente`). Sonesta skipped (`inactif`). New: **Marien Puerto Plata Hotel** (`marien-puerto-plata-hotel-2027-01-14`, `pre_vente`).

Listing shows: `actif`, `pre_vente`, `complet_sold_out`, `vendu`. Hidden: `inactif`, `brouillon`, `archiv`.

---

## 3. Reservation / leads

Native form on `product.html` → reservation API (not the GHL iframe for the live path).

| Piece | Status |
|-------|--------|
| `config.js` `GHL_RESERVATION_API_URL` | Still a Cloudflare tunnel: `https://hart-intelligence-footwear-underground.trycloudflare.com/` |
| VPS API | `/opt/voyage-fiesta-reservation`, port **3847**, systemd `voyage-fiesta-reservation` |
| Worker | `workers/submit-reservation/` |
| Server | `server/reservation-api/server.mjs` |

**Assignment (pushed in `7ab3610`):** new leads are assigned to the voyage **Owner** only.

- `assignedTo` must be a **string user id**, not `[userId]`. Array form is ignored by GHL upsert.
- If `agent_id` is missing, server looks up owner from live `products.json` by `forfait_slug` (5 min cache).
- Process tags only: `reservation-site` / `demande-prix` / `demande-prevente`
- **No owner Smart List tags** (`barbara`, `eric`, `lead-conseiller`). Routing = assignment.

Old slug alias still in `api.js`: `barbara-conseillere-voyage` → `barbara-delisle`.

**Repro that led to the fix:** reserved Barbara’s RIU Flamingos; contact **Testeur CRM** (`Nv3YXCj3Hs7qDk0mwQAy`, `alexandre.roy.97@hotmail.com`) stayed on Éric. After the fix, that contact was manually assigned to Barbara.

### GHL users (this location)

| Name | ID | Email |
|------|-----|--------|
| Agence Voyages Fiesta et Mariage Sud | `M37kX9dOKDqiT8arwEJs` | info@promo.voyagefiesta.com |
| Divison Rabais Voyage | `VtiD6mbBQU9uI8atIPIy` | Rabais@voyagefiesta.com |
| Eric Lacasse | `fG599Arfh45eLVOMCMLh` | info@voyagesfiesta.com |
| Barbara Delisle | `0nvsiaLmrxoziqCY1cOY` | Barbara@voyagefiesta.com |
| Jasmine Stan | `BhhvFMtF0UsXpdnQnxzJ` | jasmine@mariagesud.com |
| Sabrina Tremblay | `Xdip2xRxyWi1n3KJaMjI` | sabrina@mariagesud.com |
| Valerie Castonguay | `W4Y7L2Uoszcnh87CeSHI` | valerie@mariagesud.com |
| Vanessa Vecchio | `iERaWbeWruXnURio6HYJ` | INFO@EXPERIENCESVIP.CA |

---

## 4. Occupation pricing (hard rule)

**Never show, calculate, or submit a total unless that occupancy has an explicit GHL price.** Rule file: `.cursor/rules/ghl-occupation-pricing.mdc`

| Adults | GHL field | Empty field |
|--------|-----------|-------------|
| 1 | `priceOccSimple` | Demande de prix. Never use double. |
| 2 | `price` (occ. double) | Demande de prix |
| 3 | `priceOccTriple` | Demande de prix |
| 4 | `priceOccQuad` | Demande de prix |
| 5+ / Autres | `priceAutres` | Always on request if empty |
| Kids | `priceChild212`, 2e enfant, `priceChild1317` | No reuse of another occupancy or of the 1st child price for a 2nd child |

Taxes (`taxesAmount`) apply **per person** only after the occupancy/child unit is published.

UI if unpublished: « Veuillez nous contacter » + interest form. No dollar, no deposit total, no `selected_price` fallback.

**Bug fixed locally (31 Aug, NOT pushed yet):** with child unit pricing, 1 adult always used the double row. Marien showed **1 298 $** (778 + 520) instead of **1 598 $** (1078 + 520).

### Uncommitted files (this machine)

```
M api.js
M config.js
M product.html
?? .cursor/rules/
?? imports/ghl-email-3-etapes-economiser.html
?? imports/ghl-email-infolettre-aubaines-express.html
?? imports/ghl-email-promo-boutique-aubaines-express.html
```

Live boutique still has the old occupancy math until these are committed + pushed.

Em dashes removed from pré-vente form / banner strings (hyphen or period).

### Actif forfaits affected (live catalog)

Default **2 adults** unchanged on all 7 `actif`. What changed: 1 / 3 / 4 / 5 adults no longer show a invented double-based total.

| Forfait | 1 adulte avant → maintenant | 3 adultes avant → maintenant |
|---------|-----------------------------|------------------------------|
| HENRY MORGAN (11 janv.) | 1 658 $ → contact | 4 974 $ → contact |
| Henry Morgan Roatan (15 mars) | 1 918 $ → contact | 5 754 $ → contact |
| Melia Cozumel (7 déc.) | 1 747 $ → contact | 5 241 $ → contact |
| RIU FLAMINGOS (20 déc.) | 3 500 $ → contact | 10 500 $ → contact |
| RIU PLAYA BLANCA (12 fév.) | 1 999 $ → contact | 5 997 $ → contact |
| Sandos Playacar (30 déc.) | 2 458 $ → contact | 7 374 $ → contact |
| Viva Fortuna (27 mars) | 1 999 $ → contact | 5 997 $ → contact |

**Pré-vente Marien** (on the site, not `actif`): 1 adulte **1 298 $ → 1 598 $**; 3 adultes **3 894 $ → 3 864 $**; 4 adultes → contact.

2 adultes and 2 adultes + 1 enfant (2-12) unchanged when those GHL fields exist.

---

## 5. Emails / copy

- Quebec French, letter-like, **no em dashes**
- Merge: `{{contact.first_name}}`, `{{unsubscribe_link}}`
- **Never `{{user.name}}` in campaign From** (use a real mailbox / user)
- Infolettre agence last hardcoded as **Agence Voyages Fiesta et Mariage Sud**: `info@promo.voyagefiesta.com`, phone **514 856-6614** (`+15148566614`)
- Boutique link in campaigns: `https://aubaineexpress.voyagefiesta.ca/` only

| File | Notes |
|------|--------|
| `imports/ghl-email-3-etapes-economiser.html` | Untracked. Objet: `3 étapes faciles pour économiser sur votre forfait tout inclus` |
| `imports/ghl-email-infolettre-aubaines-express.html` | Untracked |
| `imports/ghl-email-promo-boutique-aubaines-express.html` | Untracked |
| `imports/ghl-email-infolettre-generique.html` | Assigned-user template |
| `imports/ghl-email-confirmation-reservation.md` | Confirmation (older; still useful) |

---

## 6. Key files

| File | Role |
|------|------|
| `config.js` | Boutique URL, reservation API, labels, form keys |
| `api.js` | Pricing, occupations, agent context, GHL params |
| `product.html` | Fiche + traveler selects + interest / booking |
| `index.html` | Listing |
| `products.json` | Live feed (VPS). Do not hand-edit except emergency |
| `agents.json` | Owners from GHL users |
| `scripts/sync-ghl-products.mjs` | GHL → JSON + images + share pages |
| `server/reservation-api/server.mjs` | VPS reservation API |
| `workers/submit-reservation/` | Cloudflare Worker path |
| `share/{slug}.html` | Facebook OG (not `product.html?slug=`) |
| `.cursor/rules/ghl-occupation-pricing.mdc` | Occupancy rule |

Cache-bust after deploy: bump `?v=` on `config.js` / `api.js` in `index.html`, `product.html`, `thank-you.html`.

---

## 7. Open / next

1. **Commit + push** occupancy + no-em-dash + rule (local only today). Live site still wrong for 1 adult on Marien.
2. Point `GHL_RESERVATION_API_URL` at the VPS API instead of the trycloudflare tunnel when ready.
3. README still says Make.com deprecated / GitHub Actions as the 15-min source — **VPS cron is the source now**.
4. Generic infolettre doc still suggests `{{user.name}}` in From — do not use that in campaigns.
5. Viva has both child 2-12 and 13-17; the single Enfants dropdown uses 2-12. Table can show both bands.
6. Confirmation email + remaining GHL form question copies: `imports/ghl-forms-questions-a-repliquer.md`
7. Facebook rescrape `share/*` after big product changes: https://developers.facebook.com/tools/debug/
8. Do not invent combo occupancies in sync (`normalizeOccupationPriceFields` only remaps a known GHL mix-up: double+1 enfant sometimes lands in simple+1 enfant).

---

## 8. Merged chats (Voyage Fiesta only)

Cursor cannot fuse these into one UI thread. This file is the merge. Open a chat by title; IDs are for search.

| Date (approx) | Chat | ID | What it holds |
|---------------|------|-----|----------------|
| 2026-08-31 | voyage fiesta (this thread) | `2ad27718-a901-4606-bcee-19d7c85031f1` | VPS 15-min sync, lead assignment-only, occupancy GHL-only, emails, this handoff |
| 2026-08-27 | Prévente passenger price tax | `bc-019faec2-6112-7d0f-b49a-c6a1a7ff29a4` | Cloud: prévente + taxes / passager |
| 2026-08-25 | Contact removal by tag | `02fc24d4-6be8-451d-8788-8cc202330e22` | Voyage Fiesta location vs JohnWay MCP; Barbara tag import (~331 contacts). Do not mass-update contacts from old import |
| 2026-08-22 | GHL products sync failure | `80cd021b-89ce-4d26-8ed0-a21e005c2885` | Actions failed on empty git push after a good GHL pull |
| 2026-08-19 | Voyage Fiesta platform requirements | `ab5bc431-6725-472d-aa33-2a6dc9e8ed09` | Multi-advisor platform, sub-boutiques, sequences. Later superseded: no per-conseiller tags |
| 2026-07-29 | Prévente status missing | `c5f9e7ae-ffef-4450-839e-ea1d7b230aba` | Henry Morgan prévente not showing until sync |
| 2026-07-28 | Email confirmation and contest | `95b33022-6f61-4211-9197-a51af6f80b4d` | Infolettre + contest copy |
| 2026-07-28 | File reading for cursor | `39d56f2d-0561-4a6d-85b0-c9ec82f9ecd9` | First `CURSOR-HANDOFF.txt`; old live URL; GHL form priority; 13-17 occupations |
| 2026-07-27 | GHL connection through MCP | `18e25066-ca2c-4e30-8069-9744dc60b50a` | PIT + location valid for Mariage Sud / Voyage Fiesta |
| 2026-07-18 | Website content loss | `f3204933-d7a1-40a2-aeed-6ec6682020f4` | Boutique empty / flights+photos not syncing; email templates |
| 2026-07-14 | Iframe integration in newsletter | `17ba2692-7a8b-47e6-b5be-a03cab6227ae` | Newsletter + boutique iframe `?embed=1` |
| 2026-07-09 | Form conversion funnel | `eb6fd771-92b4-422d-928f-e4f6ce84a777` | Mariage Sud + Voyage Fiesta funnel pages |
| 2026-07-07 | GHL form custom domain | `5182bde6-aaf2-4b24-a4ad-e45f80798708` | `forms.voyagefiesta.com` CNAME pattern |
| 2026-07-03 | Voyage Fiesta platform requirements | `99d0cde1-551d-4798-a5be-1a9b06db7a1f` | Earlier platform spec |

Not Voyage Fiesta (ignore for this handoff): DuProprio/Centris VPS chats, Marie-Claude, Rentman, JohnWay-only GHL, etc.

---

## 9. Do not

- Invent an occupancy or child price from another field
- Use `assignedTo: [userId]`
- Tag new leads `barbara` / `eric` / `lead-conseiller` for routing
- Put `{{user.name}}` in campaign From
- Edit `products.json` / `agents.json` by hand unless the VPS is down
- Force-push `main`
- Print PIT, SSH password, or `.env`
