# Correctifs temporaires products.json — 20 juin 2026

**À faire demain :** corriger à la source dans GHL + resync.  
**Ne pas** laisser ce fichier comme référence permanente.

## Ce qui a été hardcodé dans `products.json`

| Produit | Changement |
|---------|------------|
| Tous (sauf Gran Muthu déjà OK) | `taxesAmount` = ancien `taxesOccDouble ÷ 2` ($ / pers.) |
| Gran Muthu | `taxesAmount` 390 → **195** (390 était probablement le total occ. double, pas /pers.) |
| Viva Fortuna | `taxesOccDouble` supprimé (doublon avec `taxesAmount` 240) |
| Sandos Playacar | `taxesAmount` **265.5** (531 ÷ 2) — carte rouge ≈ 2 459 $ total |
| RIU Playa Blanca | `destination1` bahamas → **panama** |
| Plusieurs | `carrier` WESTJET → **WestJet** (logo vol) |
| RIU | `departureAirport` Montreal → **Montréal (YUL)** |

## Conservé volontairement (legacy taxes_occ par occupation)

Ces totaux restent pour les occupations où le total ≠ `taxesAmount × voyageurs` :

- `taxesOccDouble1Child`, `taxesOccDouble2Child` (ex. Henry Morgan, Melia, RIU, Royalton)

Demain : soit entrer des `taxes_amount` cohérents par forfait, soit garder des overrides par occupation si les taxes diffèrent.

## Demain — causes racines

1. **GHL** — remplir `taxes_amount` en **$/personne** sur chaque forfait
2. **GHL** — supprimer les champs `taxes_occ_*` (déjà retirés côté client)
3. **Sync** — vérifier slug auto, return_date, location
4. **Resync** — remplacer le hardcode ; retirer clé `weekendHardcode` du JSON
5. **Vérifier** Sandos, Gran Muthu, RIU destination dans GHL

## Deploy weekend

Uploader `products.json` + fichiers site déjà modifiés (`api.js`, `index.html`, `product.html`).
