# GHL Owner = Conseiller (ops)

Guide admin + conseillers pour les sous-boutiques Voyage Fiesta.

Live master: https://aubaineexpress.voyagefiesta.ca/  
Sous-boutique: `https://aubaineexpress.voyagefiesta.ca/?agent=<slug>`

---

## Admin seulement (vous)

1. **Inviter** chaque conseiller : Settings → Team / My Staff → invite location user.
2. **Permissions** : accès Custom Objects → Voyages (créer + modifier). Optionnel : **Assigned Data Only** pour ne voir que leurs dossiers.
3. **Owner** : champ natif sur chaque enregistrement Voyage — rien à créer.
4. **PIT (Private Integration)** : ajouter le scope **`users.readonly`** (en plus des scopes objets / contacts existants). Requis pour que le sync lise nom / téléphone / courriel du Owner.
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

## Séquence : **1 seule automation** (pas une par conseiller)

À la réservation / demande depuis une sous-boutique (ou un forfait avec Owner), le site :

1. Applique le tag partagé **`lead-conseiller`** (+ le tag métier `reservation-site` / `demande-prevente` / …)
2. **Assigne le contact** au user GHL du conseiller (`assignedTo` = Owner id)

### Workflow GHL (une fois pour toute l’équipe)

1. Trigger : **Tag Added** → `lead-conseiller`
2. Action : **Add to sequence / campaign** (une séquence commune)
3. Dans les emails : utilisez le **user assigné** (nom, téléphone, courriel du conseiller) — pas besoin d’une séquence par agent

Les nouveaux conseillers n’exigent **aucune** nouvelle automation : invite → Owner sur un Voyage → sync → leur `?agent=` fonctionne.

Ne créez **pas** de tags `conseiller-marie-tremblay`, `conseiller-jean-…`, etc.
