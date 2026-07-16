# Custom Object GHL v2 — Forfait Voyage (schéma propre)

Object suggéré : **`custom_objects.forfaits_voyage_v2`** (ou remplacer l’ancien après migration).

**Règle d’or prix :** tout montant saisi = **$ / personne** (adulte ou enfant selon le champ).  
**Taxes :** un seul champ `taxes_amount` = **$ / personne** (affiché tel quel, sans multiplier sur le site).  
**Rabais :** `discount_amount` = montant **$** économisé (pastille rouge).

---

## 1. Champs auto — ne pas créer dans GHL

| Donnée | Calculé par le sync |
|--------|---------------------|
| `slug` | `name` + `departure_date` (ou slug explicite si fourni) |
| `return_date` | `departure_date` + `duration_nights` |
| `location` | libellé destination + pays (voir §3) |
| Occupations affichées | dérivées des prix adulte + enfant (voir §5) |

---

## 2. Identité & publication

| Field Key | Label GHL (FR) | Type | Requis | Notes |
|-----------|----------------|------|--------|-------|
| `name` | Nom de l’hôtel / forfait | Texte | Oui | Titre fiche |
| `state` | Statut | Liste | Oui | `actif` · `brouillon` · `complet_sold_out` · `archiv` |
| `slug` | Identifiant URL (optionnel) | Texte | Non | Laisser vide = auto |
| `inventory` | Inventaire | Nombre | Oui | Mettre `0` si complet |
| `forfait_link` | Lien fiche fournisseur | URL | Oui | Sunwing / Transat / etc. |

### Valeurs `state`

| Valeur | Boutique | Fiche | Réservation |
|--------|----------|-------|-------------|
| `actif` | Oui | Oui | Oui |
| `complet_sold_out` | Non | Oui (COMPLET) | Non |
| `brouillon` | Non | Non | Non |
| `archiv` | Non | Non | Non |

---

## 3. Destination — version simplifiée (1 seul endroit)

**Avant :** `destination1` + `sub_dest` + `country` + `location` (4 champs redondants).  
**Maintenant :** le client choisit **une destination** ; le reste se déduit.

| Field Key | Label GHL (FR) | Type | Requis | Notes |
|-----------|----------------|------|--------|-------|
| `destination` | Destination | Liste unique | Oui | Valeurs = filtres boutique (Punta Cana, Roatan, Cozumel, Jamaïque, Panama, etc.) |
| `dest_tag` | Région promo | Liste unique | Oui | `sud` · `europe` · `canada` · `usa` · `circuit` · `croisiere` |
| `country` | Pays (surcharge) | Texte | Non | **Optionnel** — rempli auto depuis `destination` si vide |

### Table de référence (sync — à coder une fois)

Exemples :

| `destination` | `country` auto | `dest_tag` suggéré |
|---------------|----------------|--------------------|
| Punta Cana | République Dominicaine | sud |
| Roatan | Honduras | sud |
| Cozumel | Mexique | sud |
| Montego Bay | Jamaïque | sud |
| Panama | Panama | sud |

Le client ne retape plus ville + pays + destination trois fois.

---

## 4. Dates, durée, aéroport

| Field Key | Label GHL (FR) | Type | Requis |
|-----------|----------------|------|--------|
| `departure_date` | Date de départ | Date | Oui |
| `duration_nights` | Durée (nuits) | Nombre | Oui (défaut 7) |
| `end_date` | Fin promo Top Chrono | Date | Oui |
| `final_payment_date` | Date paiement final | Date | Recommandé |
| `departure_airport` | Aéroport de départ | Liste unique | Oui |
| `aeroport_retour` | Aéroport de retour | Liste unique | Non | Vide = même que départ |

**Valeurs `departure_airport` :** `Montréal (YUL)` · `Québec (YQB)` · etc.

---

## 5. Prix — adultes ($ / personne)

| Field Key | Label GHL (FR) | Type | Occupation site |
|-----------|----------------|------|-----------------|
| `prix_double` | Prix occ. double ($ / pers.) | Nombre | 2 adultes — **requis** (prix de base) |
| `prix_simple` | Prix occ. simple ($ / pers.) | Nombre | 1 adulte |
| `prix_triple` | Prix occ. triple ($ / pers.) | Nombre | 3 adultes |
| `prix_quad` | Prix occ. quad ($ / pers.) | Nombre | 4 adultes |

> Alias rétrocompatibilité sync actuel : `price` → `prix_double`, `price_occ_simple` → `prix_simple`, etc.

Une occupation **n’apparaît** que si son prix adulte de base est renseigné.

---

## 6. Prix — enfants ($ / personne / enfant)

| Field Key | Label GHL (FR) | Type | Usage |
|-----------|----------------|------|--------|
| `prix_enfant_2_moins` | Enfant 2 ans et moins ($ / pers.) | Nombre | Nourrisson / tout-petit |
| `prix_1er_enfant_2_12` | 1er enfant 2-12 ans ($ / pers.) | Nombre | 1er enfant tranche 2-12 |
| `prix_2e_enfant_2_12` | 2e enfant 2-12 ans ($ / pers.) | Nombre | 2e enfant tranche 2-12 |
| `prix_1er_enfant_13_17` | 1er enfant 13-17 ans ($ / pers.) | Nombre | 1er adolescent |
| `prix_2e_enfant_13_17` | 2e enfant 13-17 ans ($ / pers.) | Nombre | 2e adolescent |

### Occupations famille dérivées (calculées au sync / affichage)

| Occupation affichée | Voyageurs | Formule avant taxes (total forfait) | Affichage / pers. |
|---------------------|-----------|--------------------------------------|-------------------|
| Occ. double | 2A | `2 × prix_double` | `prix_double` |
| Occ. double + 1 enfant 2-12 | 2A + 1E | `2×prix_double + prix_1er_enfant_2_12` | total ÷ 3 |
| Occ. double + 2 enfants 2-12 | 2A + 2E | `2×prix_double + prix_1er + prix_2e` | total ÷ 4 |
| Occ. simple + 1 enfant 2-12 | 1A + 1E | `prix_simple + prix_1er_enfant_2_12` | total ÷ 2 |

Afficher une occupation enfant seulement si **tous** les prix composants sont renseignés.

---

## 7. Taxes, rabais, dépôt

| Field Key | Label GHL (FR) | Type | Règle |
|-----------|----------------|------|--------|
| `taxes_amount` | Taxes et frais aériens ($ / pers.) | Nombre | **Un seul champ** — ne pas recréer `taxes_occ_*` |
| `discount_amount` | Rabais Aubaines Express ($) | Nombre | Pastille rouge ; barré = prix + rabais + taxes / pers. |
| `financement_mensuel` | Financement ($ / mois) | Nombre | Optionnel — sous le prix promo |
| `deposit_amount` | Dépôt requis ($ / pers.) | Nombre | Modalités paiement + formulaire |

**Ne plus utiliser :** `price_original`, `taxes_occ_double`, `taxes_occ_*`, `price_occ_double_1_child` (remplacés par composantes enfant).

---

## 8. Hôtel & filtres boutique

| Field Key | Label GHL (FR) | Type | Requis |
|-----------|----------------|------|--------|
| `stars` | Étoiles | Nombre | Oui (3 · 3.5 · 4 · 4.5 · 5) |
| `room_category` | Catégorie de chambre | Texte | Oui |
| `package_type` | Type de forfait | Texte | Oui (ex. Tout-inclus) |
| `hotel_description` | Description hôtel | Texte long | Recommandé |
| `criteria` | Critères boutique | Multi-liste | Optionnel |
| `seo_tags` | Tags SEO | Multi-liste / texte | Optionnel |

### Valeurs `criteria` (alignées `config.js`)

`familial` · `tout_inclus_allinclusive` · `directement_sur_la_plage` · `tranquille__dtente` · `vol_direct_sans_escale` · `adultes_seulement` · `vue_sur_la_mer` · `swim_out` · `glissades_deau` · `golf` · etc.

---

## 9. Fournisseur & transport

| Field Key | Label GHL (FR) | Type | Requis |
|-----------|----------------|------|--------|
| `supplier` | Fournisseur | Liste unique | Oui |
| `carrier` | Transporteur / compagnie | Texte | Oui (logo vol dérivé) |

**Valeurs `supplier` :** `sunwing` · `vacances_air_canada` · `westjet` · `transat`

---

## 10. Vols — version simplifiée (4 champs)

Le site construit déjà l’affichage complet (`getEffectiveFlights` dans `api.js`) :

| Source forfait | Remplit sur la fiche vol |
|----------------|--------------------------|
| `aeroport_depart` | Départ aller |
| `aeroport_retour` (ou `aeroport_depart`) | Arrivée retour |
| `destination` | Arrivée aller · Départ retour |
| `date_depart` | Date aller |
| `date_depart` + `duree_nuits` | Date retour |
| `transporteur` | Compagnie + logo |

### À créer dans GHL (dossier `08 — Vols`)

| Field Key (label) | Clé API GHL réelle | Type |
|-------------------|--------------------|------|
| Vol aller - numéro | `vol_aller_numero` | Texte |
| Vol aller - heure départ | `vol_aller_heure_dpart` | Texte (HH:MM) |
| Vol aller - heure d'arrivée | `vol_aller__heure_darrivee` | Texte (HH:MM) |
| Vol retour - numéro | `vol_retour_numero` | Texte |
| Vol retour - heure départ | `vol_retour_heure_dpart` | Texte (HH:MM) |
| Vol retour - heure d'arrivée | `vol_retour__heure_darrivee` | Texte (HH:MM) |

Si une heure d'arrivée est vide, le site affiche « à venir ».

**Ne pas créer :** `vol_aller_depart`, `vol_aller_arrivee`, dates de vol séparées, etc.

---

## 11. Images

| Field Key | Label GHL (FR) | Type | Notes |
|-----------|----------------|------|-------|
| `img` | Photo principale | Fichier | Requis — sync → `assets/forfaits/` |
| `img_room` | Photo chambre | Fichier | Optionnel |
| `img_extra` | Photo extra | Fichier | Optionnel |
| `img_gallery` | Galerie | Fichier (multi) | Optionnel |

---

## 12. Récap — nombre de champs à créer

| Section | Nb champs |
|---------|-----------|
| Identité | 5 |
| Destination | 2–3 |
| Dates | 5 |
| Prix adultes | 4 |
| Prix enfants | 5 |
| Taxes / promo / dépôt | 4 |
| Hôtel / filtres | 6 |
| Fournisseur | 2 |
| Vols | 4 (+ 2 optionnels) |
| Images | 4 |
| **Total** | **~37 champs** (+ champs système GHL `name`) |

---

## 13. Migration depuis l’ancien objet

| Ancien champ | Nouveau champ |
|--------------|---------------|
| `price` | `prix_double` |
| `price_occ_simple` | `prix_simple` |
| `price_occ_triple` | `prix_triple` |
| `price_occ_quad` | `prix_quad` |
| `price_occ_double_1_child` | **Calculé** : `2×prix_double + prix_1er_enfant_2_12` |
| `price_occ_double_2_child` | **Calculé** : `2×prix_double + prix_1er + prix_2e` |
| `price_child_2_12` | `prix_1er_enfant_2_12` (revérifier grille fournisseur) |
| `destination1` + `sub_dest` | `destination` seul |
| `taxes_occ_*` | **Supprimer** — garder `taxes_amount` seulement |
| `price_original` | **Supprimer** — rabais via `discount_amount` |

---

## 14. Après création GHL — côté site (à faire)

1. Mettre à jour `GHL_OBJECT_SCHEMA_KEY` dans GitHub Secrets.
2. Adapter `scripts/sync-ghl-products.mjs` : nouvelles clés + calcul occupations enfant.
3. Adapter `api.js` : occupations dérivées des composantes enfant.
4. Réimporter les 8 forfaits avec la nouvelle grille.
5. Vérifier formulaire GHL (champs cachés inchangés — calculés à la réservation).

---

## 15. Exemple saisi — Royalton Splash

| Champ | Valeur |
|-------|--------|
| `prix_double` | 1568 |
| `prix_1er_enfant_2_12` | 1088 *(exemple — à confirmer grille)* |
| `prix_2e_enfant_2_12` | 1088 |
| `taxes_amount` | 370 |
| `discount_amount` | 287 |
| `deposit_amount` | 200 |

Occupations visibles :
- Double : **1 568 $ / pers.** + **370 $** taxes / pers.
- Double + 1 enfant : total forfait `2×1568 + 1088` → affichage / pers. = total ÷ 3
- Double + 2 enfants : total `2×1568 + 1088 + 1088` → ÷ 4

---

## 16. Formulaire réservation GHL (inchangé)

Les champs cachés du formulaire restent les **Query Keys** listés dans `config.js` → `GHL_FORM_HIDDEN_FIELDS`.  
Ils sont **remplis par le site** à la réservation (pas à saisir dans l’objet forfait).

Minimum iframe : `forfait_name`, `occupation`, `nombre_personnes`, `prix_total_avant_taxe`, `taxes_total1`, `taxes_par_personne`, `depot_par_personne`, `depot_total`, `prix_total`, `pricing_summary`, `final_payment_date`.
