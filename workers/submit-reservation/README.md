# Soumission réservation via API GHL (sans iframe)

Le client ne voit plus le formulaire GHL. Le site envoie les données à un **Cloudflare Worker**, qui crée/met à jour le contact dans GHL avec votre **Private Integration Token**.

## Pourquoi un worker ?

La clé API ne doit **jamais** être dans le JavaScript du site (GitHub Pages). Le worker garde `GHL_API_KEY` côté serveur.

## Déploiement (une fois)

```bash
cd workers/submit-reservation
npm i -g wrangler   # si besoin
npx wrangler login
npx wrangler secret put GHL_API_KEY      # même token que GitHub Actions
npx wrangler secret put GHL_LOCATION_ID  # V90iyFBbBrCg3tpctRjc
npx wrangler deploy
```

Copiez l’URL du worker (ex. `https://voyage-fiesta-submit-reservation.xxx.workers.dev`) dans [`config.js`](../../config.js) :

```js
window.GHL_RESERVATION_API_URL = 'https://voyage-fiesta-submit-reservation.xxx.workers.dev';
```

Scopes Private Integration recommandés : **contacts.write** (et contacts.readonly si upsert).

## Comportement

1. Formulaire natif (étapes 1–2–3) sur le site  
2. POST JSON `{ payload }` → worker  
3. Worker → `POST /contacts/upsert` (GHL) avec nom, courriel, téléphone, adresse, notes détaillées, tag `reservation-site`  
4. Redirection → `thank-you.html`  

Aucun iframe GHL.

## Champs custom (optionnel)

Par défaut, le détail va dans **Notes** + tag. Pour remplir des custom fields GHL :

```bash
npx wrangler secret put CUSTOM_FIELD_MAP
# Coller par ex. : {"depot":"abc123","nombre_passagers":"def456"}
```

Les clés = clés du payload natif (`depot`, `assurance_medicale`, …). Les valeurs = IDs des custom fields (Settings → Custom Fields dans GHL).

## Workflows GHL

Déclenchez vos automations sur :

- **Contact created / updated**, ou  
- **Tag added** : `reservation-site`

## CORS

Par défaut `ALLOWED_ORIGINS=*`. Pour restreindre :

```bash
npx wrangler secret put ALLOWED_ORIGINS
# https://aubaineexpress.voyagefiesta.ca,https://promofiesta.roymarketing.ca
```
