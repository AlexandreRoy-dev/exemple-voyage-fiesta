# Questions à répliquer sur 3 autres formulaires GHL

**Statut :** À faire — noté le 8 juil. 2026  
**Contexte :** Ces 6 champs existent déjà sur un formulaire de référence (capture client). Les reproduire sur **3 autres formulaires** GHL.

---

## Champs requis (ordre suggéré — grille 2 colonnes)

| # | Libellé (FR) | Type | Placeholder / options |
|---|--------------|------|------------------------|
| 1 | Est-ce que vous ou tous les membres sur l'inscription possèdent une assurance voyage soins médicaux ? * | Liste déroulante | Choisissez une option |
| 2 | Est-ce que le passeport de tous les membres est valide pour plus de 6 mois après la date de votre retour ? * | Liste déroulante | Choisissez une option |
| 3 | Désirez-vous une assurance voyage Annulation ? * | Liste déroulante | Choisissez une option |
| 4 | Nom complet de la personne qui débourse pour le voyage * | Texte court | Entrez le nom |
| 5 | Aéroport de départ * | Liste déroulante | Choisissez une option |
| 6 | Mode de paiement * | Liste déroulante | Choisissez une option |

---

## Mise en page (référence visuelle)

```
[Ligne 1]  Assurance soins médicaux     |  Passeport valide 6 mois+
[Ligne 2]  Assurance annulation       |  Nom personne qui débourse
[Ligne 3]  Aéroport de départ         |  Mode de paiement
```

Tous les champs marqués **\*** (obligatoires).

---

## Formulaires concernés

- [ ] Formulaire 1 : ___________________
- [ ] Formulaire 2 : ___________________
- [ ] Formulaire 3 : ___________________

*(Remplir les noms/URLs des 3 formulaires GHL quand connus.)*

---

## Notes

- Pas de lien avec `GHL_FORM_IFRAME_KEYS` / prefill boutique pour l'instant — champs saisis par le client dans le formulaire.
- Si besoin de Query Keys plus tard, documenter les clés ici.
- Formulaire réservation forfait actuel : `config.js` → `GHL_FORM_EMBED_URL`
