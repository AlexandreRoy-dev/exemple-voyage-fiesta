# Courriel confirmation — champs du formulaire actuel

Correspondance avec votre formulaire GHL (sans le slug).

| Label dans le formulaire | Query Key recommandée | Merge field (insérer via picker) |
|--------------------------|----------------------|----------------------------------|
| Nom du forfait | `forfait_name` | `{{contact.custom.forfait_name}}` |
| occupation | `occupation` | `{{contact.custom.occupation}}` |
| nombre_personnes | `nombre_personnes` | `{{contact.custom.nombre_personnes}}` |
| nombre_adultes | `nombre_adultes` | `{{contact.custom.nombre_adultes}}` |
| nombre_enfants_2_12 | `nombre_enfants_2_12` | `{{contact.custom.nombre_enfants_2_12}}` |
| prix_total_avant_taxe | `prix_total_avant_taxe` | `{{contact.custom.prix_total_avant_taxe}}` |
| taxes_total1 | `taxes_total1` | `{{contact.custom.taxes_total1}}` |
| Dépôt/pers | `depot_par_personne` | `{{contact.custom.depot_par_personne}}` |
| dépôt total | `depot_total` | `{{contact.custom.depot_total}}` |
| date de paiement | `final_payment_date` | `{{contact.custom.final_payment_date}}` |
| Sommaire | `pricing_summary` | `{{contact.custom.pricing_summary}}` |
| Prénom | (standard) | `{{contact.first_name}}` |
| Nom de famille | (standard) | `{{contact.last_name}}` |
| Courriel | (standard) | `{{contact.email}}` |
| Téléphone | (standard) | `{{contact.phone}}` |

> **Important :** utilisez toujours le bouton **Insert Custom Value** dans GHL — la syntaxe exacte peut varier (`{{contact.custom.xxx}}` ou `{{contact.xxx}}`).

> **Prefill site :** le site envoie `prix_total_avant_taxes`, `taxes_total` et `pricing_summary`. Si vos Query Keys diffèrent (`prix_total_avant_taxe`, `taxes_total1`, `Sommaire`), renommez les champs dans GHL **ou** alignez les Query Keys sur celles du site.

---

## Objet

```
Confirmation de votre demande — {{contact.custom.forfait_name}} | Aubaines Express Voyage
```

Version sans custom field dans l'objet (si erreur) :

```
Confirmation de votre demande | Aubaines Express Voyage
```

---

## Corps du courriel

```
Bonjour {{contact.first_name}},

Merci d'avoir choisi Aubaines Express Voyage pour votre prochain séjour. Nous avons bien reçu votre demande de réservation et un conseiller vous contactera sous peu pour la confirmer.

──────────────────────
VOTRE FORFAIT
──────────────────────

Hôtel : {{contact.custom.forfait_name}}
Occupation : {{contact.custom.occupation}}

──────────────────────
VOYAGEURS
──────────────────────

Adultes : {{contact.custom.nombre_adultes}}
Enfants (2-12 ans) : {{contact.custom.nombre_enfants_2_12}}
Total voyageurs : {{contact.custom.nombre_personnes}}

──────────────────────
TARIFICATION ESTIMÉE (sujet à confirmation)
──────────────────────

{{contact.custom.pricing_summary}}

Prix avant taxes : {{contact.custom.prix_total_avant_taxe}} $
Taxes et frais aériens : {{contact.custom.taxes_total1}} $

──────────────────────
MODALITÉS DE PAIEMENT
──────────────────────

Dépôt requis : {{contact.custom.depot_par_personne}} $ / personne
DÉPÔT TOTAL : {{contact.custom.depot_total}} $
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
2. Le dépôt sera requis pour bloquer votre place.
3. Le solde devra être payé au plus tard le {{contact.custom.final_payment_date}}.
4. Les horaires de vol définitifs vous seront transmis une fois confirmés.

Les tarifs, taxes et disponibilités sont sujets à changement sans préavis jusqu'à confirmation écrite et réception du dépôt. Ce courriel ne constitue pas une confirmation finale de réservation.

Des questions? Répondez directement à ce courriel.

Bonne journée,

L'équipe Aubaines Express Voyage
Voyage Fiesta
```

---

## Si « Sommaire » a une autre clé

Si le champ s'appelle `sommaire` dans GHL (et non `pricing_summary`), remplacez la ligne par :

```
{{contact.custom.sommaire}}
```

---

## Custom fields Contact à créer (minimum)

Créez ces champs dans **Settings → Custom Fields → Contact**, puis mappez-les dans le formulaire :

1. `forfait_name`
2. `occupation`
3. `nombre_personnes`
4. `nombre_adultes`
5. `nombre_enfants_2_12`
6. `prix_total_avant_taxe`
7. `taxes_total1`
8. `depot_par_personne`
9. `depot_total`
10. `final_payment_date`
11. `pricing_summary` (ou `sommaire` — même clé que la Query Key du champ Sommaire)
