# Courriel remerciement — Voyage Fiesta (juin 2026)

> **Template HTML :** [`ghl-email-remerciement.html`](./ghl-email-remerciement.html) — copier le code dans GHL (Marketing → Emails → Templates).

Correspondance formulaire ↔ Contact custom fields ↔ merge tags courriel.

---

## Champs formulaire (Query Key = clé exacte)

| Label GHL | Query Key | Merge field courriel |
|-----------|-----------|----------------------|
| forfait (slug) | `forfait_slug` | `{{contact.custom.forfait_slug}}` |
| Nom du forfait | `forfait_name` | `{{contact.custom.forfait_name}}` |
| dépot total | `depot_total` | `{{contact.custom.depot_total}}` |
| nombre_personnes | `nombre_personnes` | `{{contact.custom.nombre_personnes}}` |
| nombre_adultes | `nombre_adultes` | `{{contact.custom.nombre_adultes}}` |
| Enfants (total, tous âges) | `nombre_enfants_2_12` | `{{contact.custom.nombre_enfants_2_12}}` |
| occupation | `occupation` | `{{contact.custom.occupation}}` |
| date de paiement | `final_payment_date` | `{{contact.custom.final_payment_date}}` |
| Sommaire | `sommaire` | `{{contact.custom.sommaire}}` |

Standards contact : `{{contact.first_name}}`, `{{contact.last_name}}`, `{{contact.email}}`, `{{contact.phone}}`

> Utilisez **Insert Custom Value** dans GHL — la syntaxe peut varier (`{{contact.custom_field.forfait_name}}`, etc.).

---

## Objet suggéré

```
Confirmation de votre demande — {{contact.custom.forfait_name}} | Voyage Fiesta
```

---

## Installation GHL

1. **Marketing** → **Templates** → **New** → **Code Editor** (ou coller le HTML dans un email d'automation).
2. Coller le contenu de `ghl-email-remerciement.html`.
3. Vérifier les merge tags avec **Preview** + un contact test ayant les custom fields remplis.
4. **Automation** → Trigger **Form submitted** (formulaire Réservation de forfait) → Action **Send Email**.

### Custom fields Contact requis

1. `forfait_slug`
2. `forfait_name`
3. `depot_total`
4. `nombre_personnes`
5. `nombre_adultes`
6. `nombre_enfants_2_12` — **total enfants, tous âges** (le nom de la clé GHL est historique)
7. `occupation`
8. `final_payment_date`
9. `sommaire`

---

## Couleurs (alignées sur le site)

| Rôle | Hex |
|------|-----|
| Bleu marque | `#025091` |
| Orange accent | `#F26522` |
| Texte foncé | `#1F2937` |
| Fond clair | `#F3F7FA` |
| Dépôt (fond) | `#FFF7ED` |

Police : Poppins (avec repli Arial / Helvetica pour clients courriel).

---

## Exemple valeurs — Melia Cozumel, 5 passagers

| Clé | Valeur |
|-----|--------|
| forfait_name | Melia Cozumel |
| occupation | Occ. double et 3 enfants |
| nombre_personnes | 5 |
| nombre_adultes | 2 |
| nombre_enfants_2_12 | 3 |
| depot_total | 1000 |
| final_payment_date | 11/01/2027 |
| sommaire | (texte multiligne du calcul) |

---

Voir aussi `config.js` → `GHL_FORM_IFRAME_KEYS`.
