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
| `config.js` | URL JSON + listes de filtres + URL API réservation |
| `api.js` | Fetch `products.json`, filtres |
| `products.json` | Données live (généré par GitHub Actions) |
| `scripts/sync-ghl-products.mjs` | Script de sync GHL → JSON |
| `workers/submit-reservation/` | Cloudflare Worker : form → GHL Contacts API |
| `.github/workflows/sync-products.yml` | Workflow planifié |
| `index.html` | Liste + filtres boutique |
| `product.html` | Fiche produit + modal réservation (API, sans iframe) |

## Réservation sans iframe GHL

Le formulaire natif envoie les données à un **Cloudflare Worker**, qui crée le contact via l’API GHL (token serveur). Voir [`workers/submit-reservation/README.md`](workers/submit-reservation/README.md).

1. Déployer le worker + secrets `GHL_API_KEY` / `GHL_LOCATION_ID`
2. Coller l’URL dans `config.js` → `GHL_RESERVATION_API_URL`
3. Dans GHL : workflow sur tag `reservation-site` (ou contact créé)

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
| stars | `stars` | 5 · 3.5 (demi-étoiles supportées) |
| supplier | `supplier` | Vacances Sunwing |
| carrier | `carrier` | Sunwing Airlines |
| duration_nights | `durationNights` | 7 |
| room_category | `roomCategory` | Suite Junior Vue Mer |
| hotel_description | `hotelDescription` | Texte descriptif de l'hôtel (optionnel) |
| criteria | `criteria` | `["familial","vue_sur_la_mer"]` (GHL multi-select keys) |
| inventory | `inventory` | 3 |
| price | `price` | 1459 | Occ. double — **prix par personne** (requis pour afficher l'option) |
| price_occ_double_1_child | `priceOccDouble1Child` | 4200 | Occ. double + 1 enfant 2-12 |
| price_occ_double_2_child | `priceOccDouble2Child` | — | Occ. double + 2 enfants 2-12 **(à créer)** |
| price_occ_simple | `priceOccSimple` | 1890 | Occ. simple |
| price_occ_simple_1_child | `priceOccSimple1Child` | — | Occ. simple + 1 enfant 2-12 **(à créer)** |
| price_occ_triple | `priceOccTriple` | 1399 | Occ. triple |
| price_occ_quad | `priceOccQuad` | — | Occ. quad **(à créer)** |
| price_autres | `priceAutres` | — | Autres **(à créer)** |
| price_child_2_12 | `priceChild212` | 668 | Réf. tarif enfant seul (optionnel, pas dans le picker) |
| price_child_13_17 | `priceChild1317` | 958 | Réf. tarif enfant seul (optionnel) |
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
| flight_out_arrive_time / `vol_aller__heure_darrivee` | `out.arriveTime` | 12:30 *(vide → « à venir »)* |
| flight_out_number | `out.number` | WS2632 |
| flight_return_from | `return.from` | Cancún (CUN) |
| flight_return_depart_date | `return.departDate` | 2026-09-27 |
| flight_return_depart_time | `return.departTime` | 12:15 |
| flight_return_to | `return.to` | Québec (YQB) |
| flight_return_arrive_date | `return.arriveDate` | 2026-09-27 |
| flight_return_arrive_time / `vol_retour__heure_darrivee` | `return.arriveTime` | 17:50 *(vide → « à venir »)* |
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

### Champs contact (visibles)
Prénom, nom, courriel, téléphone — champs standards GHL.

### Champs forfait (cachés — Query Key = clé exacte)

Créez un champ **Hidden** (ou texte) par ligne. Dans les paramètres du champ, **Query Key** doit correspondre exactement :

| Query Key | Exemple de valeur |
|-----------|-------------------|
| `forfait_slug` | Gran-Muthu-Runaway-Bay-Montego-Bay |
| `forfait_name` | Gran Muthu Runaway Bay |
| `destination` | Jamaïque |
| `sub_destination` | Montego Bay |
| `departure_date` | 25 février 2027 |
| `return_date` | 4 mars 2027 |
| `departure_airport` | Montréal (YUL) |
| `final_payment_date` | 11 décembre 2026 |
| `deposit_amount` | 200 |
| `taxes_amount` | 390 |
| `occupation` | double |
| `occupation_label` | Occ. double (2 pers.) |
| `selected_price` | 1518 |
| `selected_taxes` | 390 |
| `selected_total` | 1908 |
| `nombre_personnes` | 3 |
| `nombre_adultes` | 2 |
| `nombre_enfants_2_12` | 1 |
| `depot_par_personne` | 200 |
| `depot_total` | 600 |
| `prix_total_avant_taxes` | 4184 |
| `taxes_total` | 1170 |
| `prix_total` / `total` | 5354 |
| `pricing_summary` | 2 adultes × 1 518 $ + 1 enfant (2-12) × 1 148 $ = 4 184 $ avant taxes |
| `price_double` | 1518 |
| `price_triple` | *(vide si N/A)* |
| `price_simple` | 2208 |
| `price_child_2_12` | 1148 |
| `price_child_13_17` | 958 |
| `price_original` | 2165 |
| `supplier` | sunwing |
| `carrier` | WestJet |
| `room_category` | Chambre avec vue cour |
| `package_type` | Forfait Tout-Inclus |
| `duration_nights` | 7 |

Liste complète aussi dans `config.js` → `GHL_FORM_HIDDEN_FIELDS`.

Le site envoie ces valeurs automatiquement dans l'URL de l'iframe quand le client clique **Réserver**. L'occupation choisie sur la fiche produit (radio ou liste déroulante) remplit `occupation`, `selected_price`, etc.

### Configuration

1. Créer le formulaire standard avec les champs ci-dessus + contact
2. Copier l'URL d'intégration iframe → `config.js` → `GHL_FORM_EMBED_URL`
3. **Page de remerciement** : Paramètres → **À la soumission** → **Rediriger vers une URL** :
   ```
   https://promofiesta.roymarketing.ca/thank-you.html?forfait_slug={{forfait_slug}}&first_name={{contact.first_name}}
   ```
4. Dans GHL, mappez les champs cachés vers des **Custom Fields contact** si vous voulez les voir dans le CRM et les workflows

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
