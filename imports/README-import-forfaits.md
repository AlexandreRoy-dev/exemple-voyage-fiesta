# Import forfait GHL — Viva Fortuna Beach Freeport

Fichier : `forfait-viva-fortuna-freeport-2027.csv`

## Avant l'import

1. Vérifier que les **noms de colonnes** correspondent aux clés de votre Custom Object GHL (`forfaits_voyage`). Renommez les en-têtes si votre import utilise les libellés français de l'interface.
2. Les champs **img**, **img_room**, **img_extra** et **img_gallery** ne sont pas dans le CSV — ajoutez les photos manuellement dans GHL après l'import.
3. Valeurs **multi-select** (`criteria`, `seo_tags`) : séparées par `|` dans ce CSV. Si GHL exige une autre syntaxe à l'import, remplacez par des virgules ou plusieurs colonnes selon l'assistant d'import.

## Correspondance des tarifs

| Ligne client | Champ GHL | Valeur |
|--------------|-----------|--------|
| Occupation double (offre Aubaines) | `price` | 1809 |
| Occupation triple | `price_occ_triple` | 1709 |
| Occupation simple | `price_occ_simple` | 2378 |
| Prix internet (barré) | `price_original` | 2815 |
| Rabais affiché | `discount_amount` | 1006 |
| Taxes et frais aériens | `taxes_amount` | 240 |
| Dépôt requis | `deposit_amount` | 200 |
| Paiement final | `final_payment_date` | 2027-01-11 |
| Enfant 2–12 ans | `price_child_2_12` | 668 |
| Enfant 13–17 ans | `price_child_13_17` | 958 |
| Date de retour | `return_date` | 2027-04-04 |

## Champs à compléter dans GHL après import

- **Photos** : img, img_room, img_extra
- **Étoiles** (`stars`) si connu
- **Critères / icônes** : plage, glissades, etc. (prochain mandat)
- **Heures de vol** et **numéros de vol** quand disponibles
- **`end_date`** : date de fin de promo (countdown) — CSV utilise le paiement final (11 janv. 2027) ; ajustez si la promo se termine plus tôt

## Notes

- `supplier` = `sunwing` (comme l'autre fiche) — utiliser `Vacances Sunwing` si votre liste déroulante GHL l'exige.
- `destination1` = `Bahamas` pour le filtre boutique (pas « Freeport » seul).
- `dest_tag` = `sud` pour la région Sud.
