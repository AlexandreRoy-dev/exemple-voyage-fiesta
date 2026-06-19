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
| destination | `destination` | Punta Cana |
| dest_tag | `destTag` | SUD |
| sub_dest | `subDest` | Punta Cana |
| country | `country` | République Dominicaine |
| location | `location` | Bavaro Beach... |
| stars | `stars` | 5 |
| supplier | `supplier` | Vacances Sunwing |
| carrier | `carrier` | Sunwing Airlines |
| duration_nights | `durationNights` | 7 |
| room_category | `roomCategory` | Suite Junior Vue Mer |
| criteria | `criteria` | ["Vue mer","Familial"] |
| inventory | `inventory` | 3 |
| price | `price` | 1459 |
| package_type | `packageType` | Forfait Tout-Inclus |
| end_date | `endDate` | 2026-06-20T23:59:59.000Z |
| departure_airport | `departureAirport` | Montréal (YUL) |
| img | `img` | https://... |
| img_room | `imgRoom` | https://... |
| img_extra | `imgExtra` | https://... |
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

## Filtres boutique (config.js)

- **Destinations** — checkboxes (Aruba, Bahamas, Punta Cana, etc.)
- **Fournisseurs** — Sunwing, Air Canada, WestJet Québec, Transat + **Autres** (tout fournisseur non listé)
- **Aéroport de départ** — Montréal (YUL), Québec (YQB), etc.
- **Critères** — Vue mer, Familial, Adultes seulement, Swim Out, Glissades d'eau, Golf

## Formulaire GHL

1. Créer le formulaire dans GHL avec champs cachés : `forfait_slug`, `forfait_name`, `forfait_price`, `forfait_supplier`, `forfait_departure`
2. Copier l'URL d'intégration iframe
3. Coller dans `config.js` → `GHL_FORM_EMBED_URL`

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
