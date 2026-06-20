# Courriel de confirmation — Réservation Voyage Fiesta

## Objet (sujet)

```
Confirmation de votre demande — {{contact.forfait_name}} | Aubaines Express Voyage
```

Variante plus personnelle :

```
{{contact.first_name}}, nous avons bien reçu votre demande pour {{contact.forfait_name}}
```

---

## Prérequis GHL

1. **Formulaire → Mapping** : chaque champ caché doit être mappé vers un **Contact Custom Field** avec la **même clé** que le Query Key (`prix_total`, `depot_total`, etc.).
2. **Workflow** : déclencheur *Form submitted* → action *Send email*.
3. Dans l’éditeur GHL, utilisez le sélecteur de champs contact pour insérer les merge fields — les noms ci-dessous correspondent aux clés custom field.

---

## Corps du courriel (HTML / texte)

Copiez le bloc ci-dessous dans votre template GHL (mode texte ou HTML simple).

---

Bonjour {{contact.first_name}},

Merci d’avoir choisi **Aubaines Express Voyage** pour votre prochain séjour. Nous avons bien reçu votre demande de réservation et un conseiller vous contactera sous peu pour la confirmer.

---

**VOTRE FORFAIT**

Hôtel : {{contact.forfait_name}}  
Destination : {{contact.destination}}{{#if contact.sub_destination}}, {{contact.sub_destination}}{{/if}}  
Type : {{contact.package_type}}  
Chambre : {{contact.room_category}}  
Fournisseur : {{contact.supplier}}  
Transporteur : {{contact.carrier}}

---

**DATES & DÉPART**

Départ : {{contact.departure_date}} — {{contact.departure_airport}}  
Retour : {{contact.return_date}}  
Durée : {{contact.duration_nights}} nuits

---

**OCCUPATION & VOYAGEURS**

Configuration : {{contact.occupation_label}}  
Adultes : {{contact.nombre_adultes}}  
Enfants (2-12 ans) : {{contact.nombre_enfants_2_12}}  
Enfants (13-17 ans) : {{contact.nombre_enfants_13_17}}  
**Total voyageurs : {{contact.nombre_personnes}}**

---

**TARIFICATION ESTIMÉE** *(sujet à confirmation)*

{{contact.pricing_summary}}

Prix avant taxes : **{{contact.prix_total_avant_taxes}} $**  
Taxes et frais aériens : **{{contact.taxes_total}} $**  
**Total estimé : {{contact.prix_total}} $**

---

**MODALITÉS DE PAIEMENT**

Dépôt requis : **{{contact.depot_par_personne}} $ / personne**  
**Dépôt total à verser : {{contact.depot_total}} $**  
Date limite — paiement final : **{{contact.final_payment_date}}**

---

**PROCHAINES ÉTAPES**

1. Un conseiller Voyage Fiesta communiquera avec vous par téléphone ou courriel.  
2. Le dépôt sera requis pour bloquer votre place.  
3. Le solde devra être payé au plus tard le {{contact.final_payment_date}}.  
4. Les horaires de vol définitifs vous seront transmis une fois confirmés par le fournisseur.

---

**IMPORTANT**

Les tarifs, taxes et disponibilités sont sujets à changement sans préavis jusqu’à confirmation écrite et réception du dépôt. Ce courriel ne constitue pas une confirmation finale de réservation.

Des questions? Répondez à ce courriel ou appelez-nous — nous sommes là pour vous accompagner.

Bonne journée,

**L’équipe Aubaines Express Voyage**  
Voyage Fiesta  
[Insérer téléphone agence]  
[Insérer courriel agence]

---

## Version HTML (optionnelle — GHL email builder)

```html
<p>Bonjour <strong>{{contact.first_name}}</strong>,</p>

<p>Merci d’avoir choisi <strong>Aubaines Express Voyage</strong>. Votre demande pour <strong>{{contact.forfait_name}}</strong> a bien été reçue.</p>

<table cellpadding="8" cellspacing="0" style="width:100%;max-width:560px;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
  <tr style="background:#025091;color:#fff;">
    <td colspan="2"><strong>Votre forfait</strong></td>
  </tr>
  <tr><td>Hôtel</td><td><strong>{{contact.forfait_name}}</strong></td></tr>
  <tr><td>Destination</td><td>{{contact.destination}}, {{contact.sub_destination}}</td></tr>
  <tr><td>Départ</td><td>{{contact.departure_date}} — {{contact.departure_airport}}</td></tr>
  <tr><td>Retour</td><td>{{contact.return_date}}</td></tr>
  <tr><td>Occupation</td><td>{{contact.occupation_label}}</td></tr>
  <tr><td>Voyageurs</td><td>{{contact.nombre_personnes}} ({{contact.nombre_adultes}} adulte(s), {{contact.nombre_enfants_2_12}} enfant(s) 2-12)</td></tr>
  <tr style="background:#fff7ed;">
    <td>Prix avant taxes</td><td><strong>{{contact.prix_total_avant_taxes}} $</strong></td>
  </tr>
  <tr style="background:#fff7ed;">
    <td>Taxes</td><td><strong>{{contact.taxes_total}} $</strong></td>
  </tr>
  <tr style="background:#F26522;color:#fff;">
    <td><strong>Total estimé</strong></td><td><strong>{{contact.prix_total}} $</strong></td>
  </tr>
  <tr><td>Dépôt total</td><td><strong>{{contact.depot_total}} $</strong></td></tr>
  <tr><td>Paiement final avant le</td><td><strong>{{contact.final_payment_date}}</strong></td></tr>
</table>

<p style="font-size:12px;color:#666;margin-top:16px;">{{contact.pricing_summary}}</p>

<p style="font-size:12px;color:#666;">Tarifs sujets à confirmation. Ce courriel ne constitue pas une réservation ferme.</p>

<p>À bientôt,<br><strong>L’équipe Aubaines Express Voyage</strong></p>
```

---

## Champs custom contact à créer (si pas déjà fait)

| Clé custom field | Source formulaire |
|------------------|-------------------|
| `forfait_name` | Nom du forfait |
| `forfait_slug` | Slug |
| `destination` | Destination |
| `sub_destination` | Ville |
| `departure_date` | Date départ |
| `return_date` | Date retour |
| `departure_airport` | Aéroport |
| `final_payment_date` | Paiement final |
| `occupation_label` | Occ. choisie |
| `nombre_personnes` | Total voyageurs |
| `nombre_adultes` | Adultes |
| `nombre_enfants_2_12` | Enfants 2-12 |
| `prix_total_avant_taxes` | Avant taxes |
| `taxes_total` | Taxes total |
| `prix_total` | **Total** |
| `depot_par_personne` | Dépôt / pers. |
| `depot_total` | **Dépôt total** |
| `pricing_summary` | Résumé calcul |
| `package_type` | Tout-inclus, etc. |
| `room_category` | Chambre |
| `supplier` | Fournisseur |
| `carrier` | Transporteur |
| `duration_nights` | Nuits |

---

## Courriel interne (équipe) — optionnel

**Objet :** `[NOUVELLE DEMANDE] {{contact.forfait_name}} — {{contact.first_name}} {{contact.last_name}}`

```
Nouvelle demande de réservation

Client : {{contact.first_name}} {{contact.last_name}}
Courriel : {{contact.email}}
Téléphone : {{contact.phone}}

Forfait : {{contact.forfait_name}} ({{contact.forfait_slug}})
Occupation : {{contact.occupation_label}}
Voyageurs : {{contact.nombre_personnes}}
Total : {{contact.prix_total}} $
Dépôt : {{contact.depot_total}} $
Paiement final : {{contact.final_payment_date}}

{{contact.pricing_summary}}
```
