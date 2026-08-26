# Infolettre générique — conseiller assigné

Template : [`ghl-email-infolettre-generique.html`](./ghl-email-infolettre-generique.html)

Une **seule** infolettre pour toute l’équipe. Le nom, courriel, téléphone et photo du conseiller viennent du **user assigné** au contact (pas de copie Barbara / Éric).

---

## Installation GHL

1. **Marketing** → **Templates** → **New** → coller le HTML.
2. **Objet** (ex.) : `{{contact.custom.nom_du_forfait}} — pour vous, {{contact.first_name}}`
3. **From name** : `{{user.name}}` ou `Voyage Fiesta`
4. **Reply-to** : `{{user.email}}`
5. Dans la **séquence / workflow**, envoyer depuis une action où le contact a déjà un **Assigned User** (voir ci-dessous).

---

## Merge fields utilisés

### Contact

| Champ | Merge field |
|-------|-------------|
| Prénom | `{{contact.first_name}}` |
| Photo conseiller (URL) | `{{contact.custom.conseiller_photo}}` |
| Nom du forfait | `{{contact.custom.nom_du_forfait}}` |
| Sommaire tarifs | `{{contact.custom.sommaire}}` |
| Dépôt total | `{{contact.custom.depot_total}}` |
| Paiement final (texte FR) | `{{contact.custom.paiement_final}}` |
| Désabonnement | `{{unsubscribe_link}}` |

### User assigné (automatique si contact assigné)

| Champ | Merge field |
|-------|-------------|
| Nom complet | `{{user.name}}` |
| Prénom | `{{user.first_name}}` |
| Courriel | `{{user.email}}` |
| Téléphone | `{{user.phone}}` |
| Téléphone (lien tel:) | `{{user.phone_raw}}` |
| Signature | `{{user.email_signature}}` |

> GHL ne propose **pas** de merge field natif pour la **photo du user**. D’où le champ contact `conseiller_photo` (URL).

---

## Photo du conseiller

### Option A — Champ contact (recommandé)

1. **Settings** → **Custom Fields** → Contact → créer **`conseiller_photo`** (Single line, URL).
2. Dans le workflow **Tag Added → `lead-conseiller`** (après assignation du contact) :
   - Action **Update Contact Field** → `conseiller_photo` = URL de la photo du conseiller.
   - GHL ne remplit pas toujours la photo automatiquement : copier l’URL depuis **Settings → My Staff** → profil user → photo de profil (clic droit → copier l’adresse de l’image), ou héberger sur le site.

### Option B — URL fixe par conseiller sur le site

Héberger `assets/agents/<slug>.jpg` et, dans le workflow, mettre l’URL complète selon le slug (Make / webhook si plusieurs agents).

### Option C — Sans photo

Laisser `conseiller_photo` vide : l’image sera cassée dans certains clients — préférer une photo par défaut générique dans le template si besoin.

---

## Workflow (rappel)

Aligné avec [`GHL-OWNER-AGENTS.md`](./GHL-OWNER-AGENTS.md) :

1. Réservation / lead depuis sous-boutique → tag **`lead-conseiller`** + **`assignedTo`** = Owner.
2. Workflow **Tag Added** → `lead-conseiller`
3. Actions : assign user (si pas déjà fait) → remplir `conseiller_photo` → **Send Email** (cette template) ou **Add to Sequence**.

Pour une **infolettre promo** (broadcast), filtrer les contacts **assignés à** chaque conseiller et envoyer la même template : chaque destinataire verra **son** conseiller via `{{user.*}}`.

---

## Personnalisation par campagne

À modifier dans le template avant envoi (ou dupliquer le template) :

- **Image hero** (ligne ~70) : URL photo du forfait
- **Paragraphes** sous « Bonjour {{contact.first_name}} »
- Les blocs sommaire / dépôt se remplissent seuls si les custom fields contact sont renseignés (réservation site).

---

## Comparaison avec les templates dédiés

| Fichier | Usage |
|---------|--------|
| `ghl-email-infolettre-generique.html` | Toute l’équipe, merge `{{user.*}}` |
| `ghl-email-infolettre-barbara-riu-flamingos.html` | Campagne one-off Barbara (hardcodé) |
| `ghl-email-infolettre-eric-riu-flamingos.html` | Campagne one-off Éric (hardcodé) |

Pour les nouveaux conseillers : **pas** de nouvelle template — assignation + champs user suffisent.
