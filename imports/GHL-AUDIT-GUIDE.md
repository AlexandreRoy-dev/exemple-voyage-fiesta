# Guide audit GHL → site

## Ce que tu m’envoies

Pour **chaque forfait** (ou en lot), envoie :

1. **Nom du forfait** (comme dans GHL)
2. **Ce que tu vois sur le site** (carte index, fiche produit, vols, occupations)
3. **Ce que tu veux** (grille fournisseur, courriel, capture Sunwing/Transat)

Exemple :
> Sandos — carte rouge affiche 1 928 $ au lieu de 2 459 $ — grille : double 1 928 + taxes 265,50/pers.

Je te réponds avec : **champ GHL** · **valeur actuelle (sync)** · **valeur à entrer** · **pourquoi**.

---

## Règles de saisie GHL (référence)

| Champ GHL | Règle |
|-----------|--------|
| `price` | Total **avant taxes** — occ. double (2 adultes) |
| `price_occ_double_1_child` | Total avant taxes — 2 adultes + 1 enfant (souvent DBL + tarif 1er enfant) |
| `price_occ_double_2_child` | Total avant taxes — 2 adultes + 2 enfants |
| `price_occ_simple`, `price_occ_triple`, etc. | Idem — total occupation, pas /pers. |
| `taxes_amount` | **$ / personne** (× nb voyageurs sur le site) |
| `taxes_occ_*` | **Ne plus utiliser** — vider si présents |
| `price_original` | Prix barré (carte rouge) |
| `discount_amount` | Rabais $ (carte rouge) — manuel |
| `carrier` | Compagnie aérienne (logo vols) — obligatoire |
| `supplier` | Tour operator (Sunwing, Transat…) |
| `departure_airport` | Obligatoire pour affichage (pas de défaut) |
| `forfait_link` | URL fiche hôtel |
| `destination1` | Slug destination (ex. `riviera_maya`, `panama`, `jamaïque`) |
| Vols | `flight_out_number`, `flight_return_number`, heures, villes |
| `slug` | **Ne pas remplir** — auto |

---

## Audit préliminaire (sync actuel vs correct)

Basé sur le dernier sync GHL + règles site. **À corriger dans GHL** puis laisser le sync tourner.

### Gran Muthu Runaway Bay
| Champ | Problème | Action GHL |
|-------|----------|------------|
| `taxes_amount` | Vérifier = **195** $/pers. (pas 390 total) | Corriger si besoin |
| `flight_out_number`, `flight_return_number` | Vides | Remplir quand connus |
| `flight_out_depart_time`, `flight_out_arrive_time`, retour | Vides | Remplir ou laisser « à venir » |
| `price_occ_simple` | 2208 affiché — triple N/D selon description | Vider si non vendu |

### Henry Morgan
| Champ | Problème | Action GHL |
|-------|----------|------------|
| `price` | OK **1358** (sync) | — |
| `price_occ_double_1_child` | **Vide dans GHL** — le sync met `null` | Remplir **1996** (1358+638) |
| `price_occ_simple_1_child` | **1996 à la mauvaise place** — affiche « Occ. simple + 1 enfant » | **Vider** ; mettre 1996 dans `price_occ_double_1_child` |
| `price_occ_double_2_child` | OK **3074** (sync) | — |
| `taxes_amount` | OK **300** $/pers. | — |
| `taxes_occ_*` | Encore **300** sur double / enfants (legacy) | **Vider tous** — laisser seulement `taxes_amount` |

### Melia Cozumel
| Champ | Problème | Action GHL |
|-------|----------|------------|
| `taxes_amount` | Mettre **318** $/pers. | Remplir |
| `taxes_occ_double_1_child`, `taxes_occ_double_2_child` | Encore **636** (legacy total) | **Vider** |
| `price_occ_double_2_child` | 5880 — vérifier grille fournisseur | Confirmer ou corriger |
| `flight_out_depart_date` | 2026-12-07 vs `departure_date` 2026-12-14 | Aligner dates vol |

### RIU Playa Blanca
| Champ | Problème | Action GHL |
|-------|----------|------------|
| `destination1` | Corrigé en `panama` (était bahamas) | Confirmer **panama** dans GHL |
| `taxes_amount` | **125** $/pers. | Remplir |
| `taxes_occ_double_1_child`, `taxes_occ_double_2_child` | **250** legacy | **Vider** |
| `price_occ_double_2_child` | 7152 — vérifier grille | Confirmer |

### Royalton Splash Punta Cana
| Champ | Problème | Action GHL |
|-------|----------|------------|
| `taxes_amount` | **185** $/pers. | Remplir |
| `taxes_occ_double_1_child`, `taxes_occ_double_2_child` | **370** legacy | **Vider** |
| `deposit_amount` | Vide | Remplir si requis |

### Sandos Playacar
| Champ | Problème | Action GHL |
|-------|----------|------------|
| `taxes_amount` | **265,50** $/pers. (531÷2) | Remplir |
| `taxes_occ_double` | Vider si encore 531 | Vider |
| `price` | 1927,91 — OK | — |
| `price_original` / `discount_amount` | 4000 / 1541 — OK promo | — |

### Sonesta Maho Beach
| Champ | Problème | Action GHL |
|-------|----------|------------|
| `taxes_amount` | **120** $/pers. (240÷2) | Remplir |
| `deposit_amount` | Vide | Remplir si requis |

### Viva Fortuna Beach
| Champ | Problème | Action GHL |
|-------|----------|------------|
| `taxes_amount` | **240** $/pers. — OK | — |
| Vols | Numéros et heures vides | Remplir quand connus |
| `tax_child_*`, `price_child_*` | Optionnel — non affiché site | Peut rester |

---

## Après correction GHL

1. Attendre sync (~15 min) ou lancer **Sync GHL Products** manuellement
2. Vérifier `products.json` sur GitHub (plus de `taxes_occ_*` remplis, `taxes_amount` présent)
3. M’envoyer une capture si un forfait est encore faux → audit ciblé
