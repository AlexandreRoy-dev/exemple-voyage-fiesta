# Plan de création — Custom Object « Voyage » (GHL)

Créer les champs **dans cet ordre**, dossier par dossier.  
Pour chaque champ : **Field type** → **Folder** → **Field name** (FR) → vérifier **Key** → **Description** (optionnel).

> **Types GHL recommandés**  
> - Montants : **Monetary** (ou Number si Monetary indisponible)  
> - Dates : **Date**  
> - Listes : **Single Options** (une valeur) ou **Multiple Options** (plusieurs)  
> - Texte court : **Single line** · Texte long : **Large text** · URL : **URL** · Images : **File Upload**

---

## Étape 0 — Avant de commencer

1. Créer l’objet **Voyage** (si pas déjà fait).
2. Créer les **dossiers** (folders) dans cet ordre :
   - `01 — Statut & identité`
   - `02 — Destination & dates`
   - `03 — Hôtel & filtres`
   - `04 — Fournisseur`
   - `05 — Prix adultes`
   - `06 — Prix enfants`
   - `07 — Taxes, rabais & dépôt`
   - `08 — Vols`
   - `09 — Médias & liens`

3. Noter le **Schema Key** GHL (ex. `custom_objects.voyage`) → à mettre dans GitHub Secrets plus tard.

---

## Étape 1 — Statut & identité (4 champs)

| # | Field name (FR) | Key | Type | Requis | Notes |
|---|-----------------|-----|------|--------|-------|
| 1.1 | Statut du forfait | `statut` | Single Options | Oui | Voir options § A |
| 1.2 | Inventaire | `inventaire` | Number | Oui | Places dispo ; `0` = complet |
| 1.3 | Identifiant URL (optionnel) | `identifiant_url` | Single line | Non | Laisser vide = généré auto |
| 1.4 | Lien fiche fournisseur | `lien_fiche_fournisseur` | URL | Oui | Sunwing / Transat / etc. |

**§ A — Options `statut`**

| Libellé affiché | Valeur (key option) |
|-----------------|---------------------|
| Actif | `actif` |
| Brouillon | `brouillon` |
| Complet / Sold out | `complet_sold_out` |
| Archivé | `archiv` |

> Le champ **Nom** (`name`) existe déjà sur l’objet GHL — l’utiliser pour le nom de l’hôtel.

---

## Étape 2 — Destination & dates (7 champs)

| # | Field name (FR) | Key | Type | Requis | Notes |
|---|-----------------|-----|------|--------|-------|
| 2.1 | Destination | `destination` | Single Options | Oui | Voir options § B |
| 2.2 | Région promo | `region_promo` | Single Options | Oui | Voir options § C |
| 2.3 | Pays (surcharge) | `pays` | Single line | Non | Optionnel si différent de la destination |
| 2.4 | Date de départ | `date_depart` | Date | Oui | |
| 2.5 | Durée (nuits) | `duree_nuits` | Number | Oui | Défaut : 7 |
| 2.6 | Fin promo Top Chrono | `date_fin_promo` | Date | Oui | Compte à rebours boutique |
| 2.7 | Date paiement final | `date_paiement_final` | Date | Recommandé | Modalités paiement |
| 2.8 | Aéroport de départ | `aeroport_depart` | Single Options | Oui | Voir options § D |
| 2.9 | Aéroport de retour | `aeroport_retour` | Single Options | Non | Même liste que § D ; vide = identique au départ |

**§ B — Options `destination`** (ajouter au fil des forfaits)

Punta Cana · Roatan · Cozumel · Montego Bay · Panama · Freeport · Saint-Martin · Playa del Carmen · Cancún · Riviera Maya · Jamaïque · Cuba · Bahamas · *(autres selon besoin)*

**§ C — Options `region_promo`**

| Libellé | Valeur |
|---------|--------|
| Sud | `sud` |
| Europe | `europe` |
| Canada | `canada` |
| États-Unis | `usa` |
| Circuit | `circuit` |
| Croisière | `croisiere` |

**§ D — Options `aeroport_depart`**

Montréal (YUL) · Québec (YQB) · *(autres si besoin)*

---

## Étape 3 — Hôtel & filtres (6 champs)

| # | Field name (FR) | Key | Type | Requis | Notes |
|---|-----------------|-----|------|--------|-------|
| 3.1 | Étoiles | `etoiles` | Number | Oui | 3 · 3.5 · 4 · 4.5 · 5 |
| 3.2 | Catégorie de chambre | `categorie_chambre` | Single line | Oui | |
| 3.3 | Type de forfait | `type_forfait` | Single line | Oui | ex. Tout-inclus |
| 3.4 | Description hôtel | `description_hotel` | Large text | Recommandé | |
| 3.5 | Critères boutique | `criteres` | Multiple Options | Non | Voir options § E |
| 3.6 | Tags SEO | `tags_seo` | Single line | Non | ex. #SUD #PUNTACANA |

**§ E — Options `criteres`**

Familial · Tout-inclus · Directement sur la plage · Tranquille / Détente · Vol direct sans escale · Adultes seulement · Vue sur la mer · Swim out · Glissades d'eau · Golf

*(Valeurs techniques si besoin : `familial`, `tout_inclus_allinclusive`, `directement_sur_la_plage`, etc.)*

---

## Étape 4 — Fournisseur (2 champs)

| # | Field name (FR) | Key | Type | Requis | Notes |
|---|-----------------|-----|------|--------|-------|
| 4.1 | Fournisseur | `fournisseur` | Single Options | Oui | Voir options § F |
| 4.2 | Transporteur | `transporteur` | Single line | Oui | ex. WestJet — sert au logo vol |

**§ F — Options `fournisseur`**

| Libellé | Valeur |
|---------|--------|
| Vacances Sunwing | `sunwing` |
| Vacances Air Canada | `vacances_air_canada` |
| Vacances WestJet Québec | `westjet` |
| Vacances Transat | `transat` |

---

## Étape 5 — Prix adultes ($ / personne) (4 champs)

> **Règle :** chaque montant = **prix par personne** pour cette occupation adulte.

| # | Field name (FR) | Key | Type | Requis | Notes |
|---|-----------------|-----|------|--------|-------|
| 5.1 | Prix occ. double ($ / pers.) | `prix_occ_double` | Monetary | **Oui** | Base obligatoire — 2 adultes |
| 5.2 | Prix occ. simple ($ / pers.) | `prix_occ_simple` | Monetary | Non | 1 adulte |
| 5.3 | Prix occ. triple ($ / pers.) | `prix_occ_triple` | Monetary | Non | 3 adultes |
| 5.4 | Prix occ. quad ($ / pers.) | `prix_occ_quad` | Monetary | Non | 4 adultes |

---

## Étape 6 — Prix enfants ($ / personne / enfant) (5 champs)

| # | Field name (FR) | Key | Type | Requis | Notes |
|---|-----------------|-----|------|--------|-------|
| 6.1 | Enfant 2 ans et moins ($ / pers.) | `prix_enfant_2_moins` | Monetary | Non | Nourrisson |
| 6.2 | 1er enfant 2-12 ans ($ / pers.) | `prix_1er_enfant_2_12` | Monetary | Non | Requis pour « double + 1 enfant » |
| 6.3 | 2e enfant 2-12 ans ($ / pers.) | `prix_2e_enfant_2_12` | Monetary | Non | Requis pour « double + 2 enfants » |
| 6.4 | 1er enfant 13-17 ans ($ / pers.) | `prix_1er_enfant_13_17` | Monetary | Non | |
| 6.5 | 2e enfant 13-17 ans ($ / pers.) | `prix_2e_enfant_13_17` | Monetary | Non | |

---

## Étape 7 — Taxes, rabais & dépôt (4 champs)

| # | Field name (FR) | Key | Type | Requis | Notes |
|---|-----------------|-----|------|--------|-------|
| 7.1 | Taxes et frais aériens ($ / pers.) | `taxes_par_personne` | Monetary | Oui | **Un seul champ** — ne pas créer de taxes par occupation |
| 7.2 | Rabais Aubaines Express ($) | `rabais` | Monetary | Non | Pastille rouge liste |
| 7.3 | Dépôt requis ($ / pers.) | `depot_par_personne` | Monetary | Recommandé | |
| 7.4 | Financement ($ / mois) | `financement_mensuel` | Monetary | Non | Sous le prix promo si applicable |

---

## Étape 8 — Vols (4 champs — version simplifiée)

> **Le site remplit automatiquement** à partir des autres champs :
> - **Départ aller** → `aeroport_depart`
> - **Arrivée retour** → `aeroport_retour` (ou `aeroport_depart` si vide)
> - **Arrivée aller** / **Départ retour** → `destination`
> - **Date aller** → `date_depart`
> - **Date retour** → `date_depart` + `duree_nuits`
> - **Compagnie / logo** → `transporteur`
>
> Le client n’a qu’à saisir **numéro + heures** quand ils sont connus.

| # | Field name (FR) | Key | Type | Requis | Exemple |
|---|-----------------|-----|------|--------|---------|
| 8.1 | Vol aller — numéro | `vol_aller_numero` | Single line | Non | WS2916 |
| 8.2 | Vol aller — heure départ | `vol_aller_heure_depart` | Single line | Non | 08:15 |
| 8.3 | Vol retour — numéro | `vol_retour_numero` | Single line | Non | WS2903 |
| 8.4 | Vol retour — heure départ | `vol_retour_heure_depart` | Single line | Non | 15:10 |

### Optionnel (seulement si vous voulez l’heure d’arrivée affichée)

| # | Field name (FR) | Key | Type | Notes |
|---|-----------------|-----|------|-------|
| 8.5 | Vol aller — heure arrivée | `vol_aller_heure_arrivee` | Single line | Sinon « à venir » |
| 8.6 | Vol retour — heure arrivée | `vol_retour_heure_arrivee` | Single line | Sinon « à venir » |

**Ne pas créer :** villes, dates de vol, aéroports destination — déjà couverts par `destination`, `aeroport_depart`, `date_depart`.

---

## Étape 9 — Médias & liens (4 champs)

| # | Field name (FR) | Key | Type | Requis | Notes |
|---|-----------------|-----|------|--------|-------|
| 9.1 | Photo principale | `photo_principale` | File Upload | **Oui** | Sync → site |
| 9.2 | Photo chambre | `photo_chambre` | File Upload | Non | |
| 9.3 | Photo extra | `photo_extra` | File Upload | Non | |
| 9.4 | Galerie photos | `galerie_photos` | File Upload (multi) | Non | Si GHL le permet |

---

## Récapitulatif

| Dossier | Nb champs |
|---------|-----------|
| 01 Statut & identité | 4 |
| 02 Destination & dates | **9** |
| 03 Hôtel & filtres | 6 |
| 04 Fournisseur | 2 |
| 05 Prix adultes | 4 |
| 06 Prix enfants | 5 |
| 07 Taxes, rabais & dépôt | 4 |
| 08 Vols | **4** (+ 2 optionnels) |
| 09 Médias | 4 |
| **Total custom** | **38** (+ 2 optionnels vols) |
| + Nom hôtel (`name` système) | 1 |
| **Grand total** | **39 champs** |

---

## Ordre de saisie d’un forfait test (après création)

1. **Nom** + **Statut** = Actif  
2. **Destination** + **Région promo** + **Dates** + **Aéroport**  
3. **Étoiles** + **Chambre** + **Description** + **Critères**  
4. **Fournisseur** + **Transporteur**  
5. **Prix occ. double** (+ autres occ. si vendues)  
6. **Prix enfants** (si familles)  
7. **Taxes / pers.** + **Rabais** + **Dépôt**  
8. **Vols** — numéros + heures départ seulement (le reste est auto)  
9. **Photos** + **Lien fiche**  
10. Enregistrer → tester sync site

---

## Champs volontairement absents (ne pas créer)

| Ancien champ | Pourquoi |
|--------------|----------|
| `taxes_occ_double`, etc. | Remplacé par `taxes_par_personne` |
| `price_occ_double_1_child` | Calculé : adultes + enfants |
| `price_original` | Remplacé par `rabais` |
| `sub_dest` + `destination1` | Remplacé par `destination` seul |
| `return_date` | Calculé auto |
| `location` | Calculé auto |

---

## Après création — me transmettre

1. **Schema Key** exact (Settings de l’objet)  
2. Capture ou liste des **Keys** si GHL les a modifiés vs ce plan  
3. Un **forfait test** rempli (ex. Royalton) pour valider le sync

On adaptera ensuite `sync-ghl-products.mjs` et `api.js` aux nouvelles clés.
