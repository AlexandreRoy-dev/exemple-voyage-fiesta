# Champs Custom Object GHL — Forfait Voyage (aligné site juin 2026)

## Auto — ne pas créer

| Champ | Généré par |
|-------|------------|
| `slug` | `name` + `departure_date` (sync) |
| `return_date` | `departure_date` + `duration_nights` |
| `location` | `sub_dest` + `country` |

---

## Prix occupations — TOTAL avant taxes ($)

| Field Key | Occupation |
|-----------|------------|
| `price` | Occ. double (2 adultes) |
| `price_occ_double_1_child` | Double + 1 enfant 2-12 |
| `price_occ_double_2_child` | Double + 2 enfants 2-12 |
| `price_occ_simple` | Occ. simple |
| `price_occ_simple_1_child` | Simple + 1 enfant 2-12 |
| `price_occ_triple` | Occ. triple |
| `price_occ_quad` | Occ. quad |
| `price_autres` | Autres |

Une occupation n'apparaît sur le site **que si son prix est renseigné**.

---

## Taxes & promo

| Field Key | Règle |
|-----------|--------|
| `taxes_amount` | **$ / personne** — site calcule × nb voyageurs selon occupation |
| `price_original` | Prix barré (carte rouge index) |
| `discount_amount` | Rabais $ (carte rouge — **saisi manuellement**) |

Ne plus utiliser `taxes_occ_*` — un seul `taxes_amount` suffit.

---

## Vols

| Aller | Retour |
|-------|--------|
| `flight_out_from`, `flight_out_to` | `flight_return_from`, `flight_return_to` |
| `flight_out_depart_time`, `flight_out_arrive_time` | `flight_return_depart_time`, `flight_return_arrive_time` |
| **`flight_out_number`** | **`flight_return_number`** |
| `flight_out_depart_date`, `flight_out_arrive_date` | `flight_return_depart_date`, `flight_return_arrive_date` |

Alias : `vol_aller_*`, `vol_retour_*`. Logo vol = champ **`carrier`** (obligatoire).

---

## Autres champs requis

`name`, `state`, `destination1`, `sub_dest`, `country`, `departure_date`, `duration_nights`, `end_date`, `departure_airport` (pas de défaut), `supplier`, `carrier`, `stars`, `room_category`, `inventory`, `img`, **`forfait_link`**

Libellé lien sur le site : **Consultez la fiche complète de l'hôtel ici**
