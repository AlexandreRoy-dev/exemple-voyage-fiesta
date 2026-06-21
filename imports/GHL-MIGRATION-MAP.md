# Migration forfaits_voyage (ancien) → Voyage (nouveau)

## Prérequis

1. Objet **Voyage** créé avec tous les champs du plan (`GHL-PLAN-CREATION-CHAMPS.md`).
2. Token GHL avec scopes : `objects/record.readwrite` (ou équivalent custom objects).
3. Variables d’environnement (ne pas coller le token dans le chat) :

```bash
GHL_API_KEY=...
GHL_LOCATION_ID=V90iyFBbBrCg3tpctRjc
GHL_SOURCE_SCHEMA_KEY=custom_objects.forfaits_voyage
GHL_TARGET_SCHEMA_KEY=custom_objects.voyage   # à confirmer dans GHL
```

## Commandes

```bash
# 1) Exporter les schémas (vérifie que les Keys correspondent)
node scripts/export-ghl-schema.mjs

# 2) Aperçu migration (sans écrire dans GHL)
node scripts/migrate-ghl-forfaits.mjs

# 3) Créer les enregistrements dans Voyage
node scripts/migrate-ghl-forfaits.mjs --apply
```

Sorties :
- `imports/ghl-schema-source.json`
- `imports/ghl-schema-target.json`
- `imports/migration-preview.json`

---

## Table de correspondance champs

| Ancien (forfaits_voyage) | Nouveau (Voyage) | Notes |
|--------------------------|------------------|-------|
| `name` | `name` | Nom hôtel |
| `state` | `statut` | actif, brouillon, complet_sold_out, archiv |
| `inventory` | `inventaire` | |
| `slug` | `identifiant_url` | Optionnel |
| `forfait_link` | `lien_fiche_fournisseur` | |
| `destination1` / `destination` / `sub_dest` | `destination` | Normalisé (voir script) |
| `dest_tag` | `region_promo` | sud, europe, … |
| `country` | `pays` | Gardé si présent |
| `departure_date` | `date_depart` | |
| `duration_nights` | `duree_nuits` | |
| `end_date` | `date_fin_promo` | |
| `final_payment_date` | `date_paiement_final` | |
| `departure_airport` | `aeroport_depart` | |
| — | `aeroport_retour` | Vide (= même que départ) |
| `stars` | `etoiles` | |
| `room_category` | `categorie_chambre` | |
| `package_type` | `type_forfait` | |
| `hotel_description` | `description_hotel` | |
| `criteria` | `criteres` | Multi-select |
| `seo_tags` | `tags_seo` | Tableau → texte joint |
| `supplier` | `fournisseur` | |
| `carrier` | `transporteur` | |
| `price` | `prix_occ_double` | $ / pers. |
| `price_occ_simple` | `prix_occ_simple` | |
| `price_occ_triple` | `prix_occ_triple` | |
| `price_occ_quad` | `prix_occ_quad` | |
| `price_child_2_12` | `prix_1er_enfant_2_12` | Ou dérivé (voir ci-dessous) |
| `price_child_13_17` | `prix_1er_enfant_13_17` | |
| `price_occ_double_1_child` | *(dérivé)* → `prix_1er_enfant_2_12` | Si enfant direct absent |
| `price_occ_double_2_child` | *(dérivé)* → `prix_2e_enfant_2_12` | Si absent |
| `taxes_amount` | `taxes_par_personne` | $ / pers. |
| `discount_amount` | `rabais` | |
| `deposit_amount` | `depot_par_personne` | |
| `financing_monthly` | `financement_mensuel` | |
| `flight_out_number` / `vol_aller_numero` | `vol_aller_numero` | |
| `flight_out_depart_time` / `vol_aller_heure_depart` | `vol_aller_heure_depart` | |
| `flight_out_arrive_time` / `vol_aller_heure_arrivee` | `vol_aller_heure_arrivee` | Optionnel |
| `flight_return_number` / `vol_retour_numero` | `vol_retour_numero` | |
| `flight_return_depart_time` / `vol_retour_heure_depart` | `vol_retour_heure_depart` | |
| `flight_return_arrive_time` / `vol_retour_heure_arrivee` | `vol_retour_heure_arrivee` | Optionnel |
| `img` | `photo_principale` | Fichier — repasse tel quel |
| `img_room` | `photo_chambre` | |
| `img_extra` | `photo_extra` | |
| `img_gallery` | `galerie_photos` | |

### Champs **non** migrés (obsolètes)

`taxes_occ_*` · `price_original` · `price_occ_double_1_child` (stocké en enfant dérivé) · `price_occ_simple_1_child` · `location` · `return_date` · `price_autres`

---

## Dérivation prix enfant (ancien modèle → nouveau)

Si `prix_1er_enfant_2_12` absent :

```
prix_1er = price_child_2_12
         OU max(0, price_occ_double_1_child - 2 × prix_occ_double)   // si ancien total occupation
```

Si `prix_2e_enfant_2_12` absent et `price_occ_double_2_child` présent :

```
prix_2e = max(0, price_occ_double_2_child - 2 × prix_occ_double - prix_1er)
```

Le preview JSON liste les **warnings** par forfait (dérivations, destinations ambiguës).

---

## Après migration

1. Vérifier 8 forfaits dans GHL **Voyage**.
2. Corriger manuellement images si GHL n’a pas accepté la copie de fichiers.
3. Mettre à jour `GHL_OBJECT_SCHEMA_KEY` → nouvel objet.
4. Adapter `sync-ghl-products.mjs` aux nouvelles clés.
5. Lancer sync + vérifier le site.
