# Voyage Fiesta — Boutique (receiving end)

Site statique alimenté par **GoHighLevel**, synchronisé via **GitHub Actions** vers `products.json`.

## Source de données (products.json)

Les forfaits sont lus depuis le fichier statique `products.json` (même origine que GitHub Pages).

Configuré dans `config.js` → `PRODUCTS_JSON_URL` (défaut : `products.json`).

- **Liste boutique** (`index.html`) : seuls les forfaits avec **`active === "actif"`** sont affichés.
- **Fiche produit** (`product.html`) : `actif` et **`complet_sold_out`** restent accessibles (SEO + badge COMPLET).

Si `products.json` est vide, le site affiche « Aucun forfait disponible ».

## Flux de données

```
GHL Custom Object "Forfait Voyage"
        ↓ API (toutes les 15 min + manuel)
   GitHub Actions → scripts/sync-ghl-products.mjs
        ↓ commit
   products.json → GitHub Pages
        ↓ fetch
   api.js → index.html + product.html
```

## GitHub Actions — configuration

### Secrets requis (Settings → Secrets and variables → Actions)

| Secret | Description |
|--------|-------------|
| `GHL_API_KEY` | Token Private Integration GHL |
| `GHL_LOCATION_ID` | ID de la sub-account (location) |
| `GHL_OBJECT_SCHEMA_KEY` | Clé du Custom Object, ex. `custom_objects.forfaits_voyage` |

### Workflow

Fichier : `.github/workflows/sync-products.yml`

- **Cron** : toutes les 15 minutes
- **Manuel** : Actions → *Sync GHL Products* → *Run workflow*
- **Résultat** : commit automatique de `products.json` si les données ont changé

### Test local (optionnel)

```bash
export GHL_API_KEY="..."
export GHL_LOCATION_ID="..."
export GHL_OBJECT_SCHEMA_KEY="custom_objects.forfaits_voyage"
node scripts/sync-ghl-products.mjs
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `config.js` | URL JSON + listes de filtres + URL formulaire GHL |
| `api.js` | Fetch `products.json`, filtres |
| `products.json` | Données live (généré par GitHub Actions) |
| `scripts/sync-ghl-products.mjs` | Script de sync GHL → JSON |
| `.github/workflows/sync-products.yml` | Workflow planifié |
| `index.html` | Liste + filtres boutique |
| `product.html` | Fiche produit + modal réservation GHL |

## Champs GHL → JSON (Custom Object)

| Champ GHL | Clé JSON | Exemple |
|-----------|----------|---------|
| name | `name` | Majestic Elegance Punta Cana |
| slug | `slug` | Majestic-Elegance-Punta-Cana |
| destination1 | `destination1` / `destination` | Punta Cana |
| dest_tag | `destTag` | SUD |
| sub_dest | `subDest` | Punta Cana |
| country | `country` | République Dominicaine |
| location | `location` | Bavaro Beach... |
| stars | `stars` | 5 |
| supplier | `supplier` | Vacances Sunwing |
| carrier | `carrier` | Sunwing Airlines |
| duration_nights | `durationNights` | 7 |
| room_category | `roomCategory` | Suite Junior Vue Mer |
| hotel_description | `hotelDescription` | Texte descriptif de l'hôtel (optionnel) |
| criteria | `criteria` | `["familial","vue_sur_la_mer"]` (GHL multi-select keys) |
| inventory | `inventory` | 3 |
| price | `price` | 1459 | Occupation double — **prix par personne** (requis) |
| price_occ_simple | `priceOccSimple` | 1890 | Occupation simple — par personne (optionnel) |
| price_occ_triple | `priceOccTriple` | 1399 | Occupation triple — par personne (optionnel) |
| price_occ_double_1_child | `priceOccDouble1Child` | 4200 | Occ. double + 1 enfant -12 ans (optionnel) |
| price_original | `priceOriginal` | 1515 | Prix régulier barré (optionnel) |
| discount_amount | `discountAmount` | 116 | Rabais en $ (optionnel — calculé si `price_original` > `price`) |
| financement_mensuel | `financingMonthly` | 116 | Paiement mensuel affiché si renseigné |
| taxes_amount | `taxesAmount` | 240 | Taxes et frais aériens par personne |
| deposit_amount | `depositAmount` | 200 | Dépôt requis par personne |
| final_payment_date | `finalPaymentDate` | 2027-01-11 | Date paiement final |
| return_date | `returnDate` | 2027-04-04 | Date de retour du séjour |
| price_child_2_12 | `priceChild212` | 668 | Enfant 2–12 ans (avant taxes) |
| price_child_13_17 | `priceChild1317` | 958 | Enfant 13–17 ans (avant taxes) |

### Vols (section fiche produit)

| Champ GHL | Clé JSON (`flights.*`) | Exemple |
|-----------|------------------------|---------|
| flight_out_from | `out.from` | Québec (YQB) |
| flight_out_depart_date | `out.departDate` | 2026-09-20 |
| flight_out_depart_time | `out.departTime` | 08:45 *(vide → « à venir »)* |
| flight_out_to | `out.to` | Cancún (CUN) |
| flight_out_arrive_date | `out.arriveDate` | 2026-09-20 |
| flight_out_arrive_time | `out.arriveTime` | 12:30 |
| flight_out_number | `out.number` | WS2632 |
| flight_return_from | `return.from` | Cancún (CUN) |
| flight_return_depart_date | `return.departDate` | 2026-09-27 |
| flight_return_depart_time | `return.departTime` | 12:15 |
| flight_return_to | `return.to` | Québec (YQB) |
| flight_return_arrive_date | `return.arriveDate` | 2026-09-27 |
| flight_return_arrive_time | `return.arriveTime` | 17:50 |
| flight_return_number | `return.number` | WS2633 |
| flight_airline_logo | `airlineLogo` | URL logo compagnie (optionnel) |
| package_type | `packageType` | Forfait Tout-Inclus |
| end_date | `endDate` | 2026-06-20T23:59:59.000Z |
| departure_date | `departureDate` | 2026-03-15T00:00:00.000Z |
| departure_airport | `departureAirport` | Montréal (YUL) |
| img | `img` | GHL file upload → mirrored to `assets/forfaits/` on sync |
| img_room | `imgRoom` | Same |
| img_extra | `imgExtra` | Same |
| img_gallery | `images[]` | Photos additionnelles (multi-upload, optionnel) |
| seo_tags | `seoTags` | ["#SUD","#PUNTA_CANA"] |
| state | `state` | `actif` · `brouillon` · `complet_sold_out` · `archiv` |
| active | `active` | Copie de `state` pour le filtre frontend |

### États (`state`)

| Valeur GHL | JSON `active` | Liste boutique | Fiche détail | Réservable |
|------------|---------------|----------------|--------------|------------|
| `actif` | `actif` | Oui | Oui | Oui |
| `complet_sold_out` | `complet_sold_out` | Non | Oui (SEO) | Non |
| `brouillon` | `brouillon` | Non (exclu du sync) | Non | Non |
| `archiv` | `archiv` | Non (exclu du sync) | Non | Non |

Le script de sync n'écrit que `actif` et `complet_sold_out` dans `products.json`.

### Images (upload GHL)

Les fichiers uploadés dans GHL sont **privés** et ne s'affichent pas directement sur GitHub Pages. Lors de chaque sync, le workflow :

1. Télécharge les images via l'API GHL (champs `img`, `img_room`, `img_extra`)
2. Les enregistre dans `assets/forfaits/{slug}-img.jpg` (etc.)
3. Écrit le chemin public dans `products.json`

Le client continue d'uploader normalement dans GHL — aucune URL à copier manuellement.

## Filtres boutique (config.js)

- **Destinations** — checkboxes (Aruba, Bahamas, Punta Cana, etc.)
- **Fournisseurs** — Sunwing, Air Canada, WestJet Québec, Transat + **Autres** (tout fournisseur non listé)
- **Aéroport de départ** — Montréal (YUL), Québec (YQB), etc.
- **Critères** — Vue mer, Familial, Adultes seulement, Swim Out, Glissades d'eau, Golf

## Formulaire GHL

1. Créer un **formulaire standard** (pas Custom Object) avec un champ caché `forfait_slug` (Query Key = `forfait_slug`) + champs contact (prénom, nom, courriel, téléphone)
2. Copier l'URL d'intégration iframe
3. Coller dans `config.js` → `GHL_FORM_EMBED_URL`
4. **Page de remerciement** : Formulaire → Paramètres → **À la soumission** → **Rediriger vers une URL** (désactiver le message de remerciement intégré) :
   ```
   https://promofiesta.roymarketing.ca/thank-you.html?forfait_slug={{forfait_slug}}
   ```
   Optionnel pour personnaliser le texte : ajoutez `&first_name={{contact.first_name}}`
5. La page `thank-you.html` sort automatiquement de l'iframe du modal et affiche le message Voyage Fiesta

## Make.com (déprécié)

L'ancien webhook Make.com n'est plus utilisé par le frontend. La sync passe entièrement par GitHub Actions + `products.json`.

Pour une sync quasi instantanée à l'avenir : webhook GHL → `repository_dispatch` sur le workflow GitHub.

## Checklist de mise en production

1. Ajouter les 3 secrets GitHub dans le repo
2. Pousser ce code sur la branche `main` (GitHub Pages)
3. Lancer le workflow manuellement (*Run workflow*)
4. Vérifier que `products.json` contient les forfaits GHL
5. Ouvrir `promofiesta.roymarketing.ca` — les cartes correspondent à GHL
6. Modifier un forfait dans GHL → attendre ≤ 15 min → rafraîchir le site
7. (Test) Sans forfaits GHL → le site affiche « Aucun forfait disponible »

Format `products.json` :

```json
{
  "updatedAt": "2026-06-14T12:00:00.000Z",
  "source": "ghl",
  "products": [ { "active": "actif", "slug": "...", ... } ]
}
```
