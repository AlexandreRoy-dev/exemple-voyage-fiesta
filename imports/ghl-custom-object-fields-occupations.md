# Champs Custom Object GHL — Forfaits voyage

Créer ces champs dans **Settings → Custom Objects → forfaits_voyage** (types **Number** ou **Monetary**).

> **Règle d'affichage :** une occupation n'apparaît sur le site **que si son prix avant taxes est renseigné**.  
> Les taxes sont **optionnelles** par occupation (colonne vide = pas de taxes affichées).

---

## 1. Prix avant taxes — par occupation ($ / pers.)

| Field Key | Label GHL suggéré | Occupation |
|-----------|-------------------|------------|
| `price` ou `price_occ_double` | Prix — occ. double | 2 adultes |
| `price_occ_double_1_child` | Prix — occ. double + 1 enfant (2-12) | 2 adultes + 1 enfant |
| `price_occ_double_2_child` | Prix — occ. double + 2 enfants (2-12) | 2 adultes + 2 enfants |
| `price_occ_simple` | Prix — occ. simple | 1 adulte |
| `price_occ_simple_1_child` | Prix — occ. simple + 1 enfant (2-12) | 1 adulte + 1 enfant |
| `price_occ_triple` | Prix — occ. triple | 3 adultes |
| `price_occ_quad` | Prix — occ. quad | 4 adultes |
| `price_autres` | Prix — autres | Autre configuration |

---

## 2. Taxes — par occupation ($ / pers.) ← **NOUVEAUX**

| Field Key | Label GHL suggéré | Lié à |
|-----------|-------------------|-------|
| `taxes_occ_double` | Taxes — occ. double | `price` / `price_occ_double` |
| `taxes_occ_double_1_child` | Taxes — occ. double + 1 enfant | `price_occ_double_1_child` |
| `taxes_occ_double_2_child` | Taxes — occ. double + 2 enfants | `price_occ_double_2_child` |
| `taxes_occ_simple` | Taxes — occ. simple | `price_occ_simple` |
| `taxes_occ_simple_1_child` | Taxes — occ. simple + 1 enfant | `price_occ_simple_1_child` |
| `taxes_occ_triple` | Taxes — occ. triple | `price_occ_triple` |
| `taxes_occ_quad` | Taxes — occ. quad | `price_occ_quad` |
| `taxes_occ_autres` | Taxes — occ. autres | `price_autres` |

Entrez le montant **par personne** (ex. 240 $ / pers. pour occ. double).

---

## 3. Référence enfants (optionnel — calcul multi-tarifs)

| Field Key | Label |
|-----------|-------|
| `price_child_2_12` | Prix enfant 2-12 ans ($ / pers.) |
| `price_child_13_17` | Prix enfant 13-17 ans ($ / pers.) |

Utilisé quand l'occupation inclut des enfants et que le prix enfant diffère du tarif adulte.

---

## 4. Autres champs forfait (déjà utilisés)

| Field Key | Label | Type |
|-----------|-------|------|
| `name` | Nom de l'hôtel | Text |
| `slug` | Identifiant URL | Text |
| `state` | Statut | Dropdown |
| `destination1` | Destination | Text |
| `sub_dest` | Ville | Text |
| `departure_date` | Date de départ | Date |
| `return_date` | Date de retour | Date |
| `departure_airport` | Aéroport de départ | Text |
| `deposit_amount` | Dépôt ($ / pers.) | Number |
| `final_payment_date` | Date paiement final | Date |
| `price_original` | Prix internet ($ / pers.) | Number |
| `discount_amount` | Rabais ($ / pers.) | Number |
| `supplier` | Fournisseur | Text/Dropdown |
| `carrier` | Transporteur | Text |
| `room_category` | Catégorie chambre | Text |
| `package_type` | Type forfait | Text |
| `duration_nights` | Durée (nuits) | Number |
| `inventory` | Chambres disponibles | Number |
| `forfait_link` | Lien forfait original (fournisseur) | URL / Text |

> **Ne plus utiliser** `taxes_amount` (global) — remplacé par `taxes_occ_*` par occupation.

---

## 5. Formulaire GHL — champs cachés (Query Keys)

Mapper vers **Contact Custom Fields** pour les courriels.

| Query Key formulaire | Source au moment de la réservation |
|----------------------|-------------------------------------|
| `forfait_name` | Nom hôtel |
| `occupation` | Libellé (ex. « Occ. double ») |
| `nombre_personnes` | Total voyageurs |
| `nombre_adultes` | Adultes |
| `nombre_enfants_2_12` | Enfants 2-12 |
| `prix_total_avant_taxe` | Total avant taxes (occupation choisie) |
| `taxes_par_personne` | Taxes / pers. de l'occupation choisie (GHL) |
| `taxes_total1` | Taxes × nb personnes |
| `depot_par_personne` | Dépôt / pers. |
| `depot_total` | Dépôt × nb personnes |
| `prix_total` | Avant taxes + taxes totales |
| `final_payment_date` | Date paiement final |
| `sommaire` / `pricing_summary` | Résumé texte du calcul |

---

## 6. Exemple — Viva Fortuna occ. double

| Champ | Valeur |
|-------|--------|
| `price` | 1809 |
| `taxes_occ_double` | 240 |
| `price_occ_simple` | 2378 |
| `taxes_occ_simple` | 240 |

Au booking (2 adultes, occ. double) :
- `prix_total_avant_taxe` → 3618
- `taxes_par_personne` → 240
- `taxes_total1` → 480
- `prix_total` → 4098
