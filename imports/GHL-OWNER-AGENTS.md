# GHL Owner = Conseiller (ops)

Guide admin + conseillers pour les sous-boutiques Voyage Fiesta.

Live master: https://aubaineexpress.voyagefiesta.ca/  
Sous-boutique: `https://aubaineexpress.voyagefiesta.ca/?agent=<slug>`

---

## Admin seulement (vous)

1. **Inviter** chaque conseiller : Settings → Team / My Staff → invite location user.
2. **Permissions** : accès Custom Objects → Voyages (créer + modifier). Optionnel : **Assigned Data Only** pour ne voir que leurs dossiers.
3. **Owner** : champ natif sur chaque enregistrement Voyage — rien à créer.
4. **PIT (Private Integration)** : ajouter le scope **`users.readonly`** (en plus des scopes objets existants). Requis pour que le sync lise nom / téléphone / courriel du Owner.
5. Après le premier forfait syncé d’un agent, lui envoyer son lien : `?agent=<son-slug>` (slug auto depuis prénom+nom).

Pas besoin de : champ custom « conseiller », nouvel objet, sous-compte GHL par agent, liste manuelle d’agents sur le site.

---

## Conseillers (eux-mêmes)

1. Voyages → créer / éditer un forfait.
2. **Owner** = **moi-même** (utilisateur connecté).
3. Statut `actif` ou `pre_vente`.
4. Sauvegarder. Le site master se met à jour sous ~5–10 min ; la sous-boutique filtre sur leur Owner.

Sans Owner : visible sur le **master**, absent des sous-boutiques.

---

## Slugs

Générés au sync depuis le profil GHL User (`firstName` + `lastName` → `marie-tremblay`).  
Collision → suffixe id (`marie-tremblay-xh30`).  
Liste live : `agents.json` (généré, ne pas éditer à la main).

---

## Tags séquence (réservation / intérêt)

Quand un client réserve ou demande depuis une sous-boutique `?agent=<slug>` (ou un forfait dont l’Owner est ce conseiller), le contact GHL reçoit **en plus** du tag métier (`reservation-site` / `demande-prevente` / …) le tag :

`conseiller-<slug>`  
ex. `conseiller-marie-tremblay`

### Workflow GHL (par conseiller)

1. Créer le tag `conseiller-<slug>` (ou le laisser se créer à la 1re soumission).
2. Workflow / campagne : **Trigger = Tag Added** → `conseiller-marie-tremblay`.
3. Action : ajouter à la **séquence** (ou pipeline) de ce conseiller.

Le master sans `?agent=` n’ajoute le tag conseiller que si le forfait a un Owner (fallback product.owner).
