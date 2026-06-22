# Courriel confirmation — Voyage Fiesta (juin 2026)

> **Statut :** template prêt — automation GHL **pas encore configurée**.

Correspondance formulaire ↔ Contact custom fields ↔ merge tags courriel.

---

## Champs cachés formulaire (Query Key = clé exacte)

| Label GHL suggéré | Query Key | Merge field courriel |
|-------------------|-----------|----------------------|
| Nom du forfait | `forfait_name` | `{{contact.custom.forfait_name}}` |
| Occupation | `occupation` | `{{contact.custom.occupation}}` |
| Nombre de passagers | `nombre_personnes` | `{{contact.custom.nombre_personnes}}` |
| Adultes | `nombre_adultes` | `{{contact.custom.nombre_adultes}}` |
| Enfants 2-12 ans | `nombre_enfants_2_12` | `{{contact.custom.nombre_enfants_2_12}}` |
| Enfants 13-17 ans | `nombre_enfants_13_17` | `{{contact.custom.nombre_enfants_13_17}}` |
| Prix avant taxes (groupe) | `prix_total_avant_taxe` | `{{contact.custom.prix_total_avant_taxe}}` |
| Taxes total (groupe) | `taxes_total1` | `{{contact.custom.taxes_total1}}` |
| Taxes / passager | `taxes_par_personne` | `{{contact.custom.taxes_par_personne}}` |
| Dépôt / passager | `depot_par_personne` | `{{contact.custom.depot_par_personne}}` |
| **Dépôt total** | `depot_total` | `{{contact.custom.depot_total}}` |
| Total forfait | `prix_total` | `{{contact.custom.prix_total}}` |
| Date paiement final | `final_payment_date` | `{{contact.custom.final_payment_date}}` |
| Sommaire | `pricing_summary` | `{{contact.custom.pricing_summary}}` |

Standards contact : `{{contact.first_name}}`, `{{contact.last_name}}`, `{{contact.email}}`, `{{contact.phone}}`

> Utilisez **Insert Custom Value** dans GHL — la syntaxe peut varier.

> Le site envoie aussi `prix_total_avant_taxes`, `taxes_total`, `sommaire` (alias) — optionnels si vous n’utilisez que les clés du tableau.

---

## Exemple valeurs — Melia Cozumel, 5 passagers

| Clé | Valeur |
|-----|--------|
| forfait_name | Melia Cozumel |
| occupation | Occ. double + 3 enfants (2-12 ans) |
| nombre_personnes | 5 |
| nombre_adultes | 2 |
| nombre_enfants_2_12 | 3 |
| depot_par_personne | 200 |
| **depot_total** | **1000** |
| prix_total | 6792.55 |

---

## Objet

```
Confirmation de votre demande — {{contact.custom.forfait_name}} | Voyage Fiesta
```

---

## Corps du courriel

```
Bonjour {{contact.first_name}},

Merci d'avoir choisi Voyage Fiesta pour votre prochain séjour. Nous avons bien reçu votre demande de réservation et un conseiller vous contactera sous peu pour la confirmer.

──────────────────────
VOTRE FORFAIT
──────────────────────

Hôtel : {{contact.custom.forfait_name}}
Occupation : {{contact.custom.occupation}}

──────────────────────
PASSAGERS
──────────────────────

Adultes : {{contact.custom.nombre_adultes}}
Enfants (2-12 ans) : {{contact.custom.nombre_enfants_2_12}}
Enfants (13-17 ans) : {{contact.custom.nombre_enfants_13_17}}
Total passagers : {{contact.custom.nombre_personnes}}

──────────────────────
TARIFICATION ESTIMÉE (sujet à confirmation)
──────────────────────

{{contact.custom.pricing_summary}}

Prix avant taxes et frais aériens : {{contact.custom.prix_total_avant_taxe}} $
Taxes et frais aériens (total) : {{contact.custom.taxes_total1}} $
Total forfait : {{contact.custom.prix_total}} $

──────────────────────
MODALITÉS DE PAIEMENT
──────────────────────

Dépôt requis : {{contact.custom.depot_par_personne}} $ / passager
DÉPÔT TOTAL À PAYER : {{contact.custom.depot_total}} $
Paiement final au plus tard le : {{contact.custom.final_payment_date}}

──────────────────────
VOS COORDONNÉES
──────────────────────

Nom : {{contact.first_name}} {{contact.last_name}}
Courriel : {{contact.email}}
Téléphone : {{contact.phone}}

──────────────────────
PROCHAINES ÉTAPES
──────────────────────

1. Un conseiller vous contactera par téléphone ou courriel.
2. Le dépôt de {{contact.custom.depot_total}} $ sera requis pour bloquer votre place.
3. Le solde devra être payé au plus tard le {{contact.custom.final_payment_date}}.
4. Les horaires de vol définitifs vous seront transmis une fois confirmés.

Les tarifs, taxes et disponibilités sont sujets à changement sans préavis jusqu'à confirmation écrite et réception du dépôt. Ce courriel ne constitue pas une confirmation finale de réservation.

Des questions? Répondez directement à ce courriel.

Bonne journée,

L'équipe Voyage Fiesta
```

---

## Automation GHL

1. **Trigger :** Form submitted → formulaire Réservation de forfait
2. **Action :** Send Email (template ci-dessus)
3. **(Optionnel)** Notification interne conseiller
4. **(Optionnel)** Paiement : montant = `depot_total`

---

## Custom fields Contact minimum

1. forfait_name
2. occupation
3. nombre_personnes
4. nombre_adultes
5. nombre_enfants_2_12
6. nombre_enfants_13_17
7. prix_total_avant_taxe
8. taxes_total1
9. depot_par_personne
10. depot_total
11. prix_total
12. final_payment_date
13. pricing_summary

Voir aussi `config.js` → `GHL_FORM_IFRAME_KEYS` et `GHL_FORM_HIDDEN_FIELDS`.
