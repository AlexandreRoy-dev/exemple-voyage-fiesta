# Sync Groupe Atrium

Lecture seule de l'API Groupe Atrium v3. Écrit un catalogue public sans clé et sans champs inconnus.

```bash
# Depuis ce dossier, avec la clé déjà dans l'environnement ou dans
# server/reservation-api/.env (jamais dans git):
node sync.mjs
```

Variables:

| Variable | Rôle |
|----------|------|
| `ATRIUM_API_KEY` | En-tête `Api-Key`. Obligatoire hors mode fixture. |
| `ATRIUM_API_BASE` | Défaut `https://api.groupeatrium.com/v3`. |
| `ATRIUM_OUTPUT` | Fichier JSON public. Défaut: `server/reservation-api/groupes.json`. Sur le VPS, le service est à plat: le défaut devient `/opt/voyage-fiesta-reservation/groupes.json` si `server.mjs` est le parent. |
| `ATRIUM_FIXTURE` | Fichier d'enveloppes locales. Aucun appel réseau. |

Le script charge, sans écraser l'environnement déjà défini: `atrium-sync/.env`, puis le `.env` du dossier parent, puis `reservation-api/.env`.

Le JSON est servi par reservation-api: `GET /groupes.json` (`Cache-Control: public, max-age=300`). Chemin lu: `GROUPES_JSON_PATH`, sinon `groupes.json` à côté de `server.mjs`.

Les photos sont des URL publiques du CDN Vasco, hotlink direct, sans proxy:

| Dossier | Exemple | Origine dans l'API |
|---------|---------|--------------------|
| `https://vascoinc.com/upimg/hotel/` | `hotel_00000287_00002560.jpg` | `id_hotel` + `id_photo` (ou nom de fichier) sur l'hôtel: `list_photo`, `url_img` |
| `https://vascoinc.com/upimg/bateau/` | `5914_Bateau.jpg` | `GET /cruise/photo`, champ `image`, relié au groupe par `id_navire` ou par le nom du navire |
| `https://vascoinc.com/upimg/cabine/` et `/pont/` | `7448_IB.jpg` | `GET /cruise/cabine` et `GET /cruise/pont` |
| `https://vascoinc.com/upimg/groupenew/` | `00000723_3411_Qnf8ejco.jpeg` | `list_image` du groupe (`fichier` ou URL) |

Le sync lit aussi `/cruise/photo`, `/cruise/cabine` et `/cruise/pont`. Si une de ces trois routes manque, le catalogue est quand même écrit. Une fiche sans aucune photo reste sans image: la page montre un bloc neutre, pas une photo de stock.

Fixture de développement:

```bash
node fixtures/build-fixture.mjs
ATRIUM_FIXTURE=fixtures/atrium-api.json ATRIUM_OUTPUT=../../groupes/data/groupes.json node sync.mjs
```

`groupes/data/groupes.json` est un catalogue d'exemple pour l'affichage local (`localhost` ou `?fixture=1`). Le site public lit l'URL de l'API, pas ce fichier.

Miroir des images distantes (groupes et voyages). Ne change pas le cron tant que ce n'est pas voulu. `ATRIUM_MIRROR_DRY_RUN=1` compte les URL sans les télécharger. Sans `ATRIUM_MEDIA_PUBLIC_BASE`, les URL du catalogue restent les URL d'origine.

```bash
ATRIUM_CATALOG=/opt/voyage-fiesta-reservation/groupes.json \
ATRIUM_PRODUCTS=/opt/voyage-fiesta-reservation/products.json \
ATRIUM_MEDIA_DIR=/opt/voyage-fiesta-reservation/media \
node mirror-images.mjs
```

Le journal affiche le nombre d'URL, les fichiers copiés, les fichiers inchangés, les échecs, les octets écrits et la taille totale. Une image qui échoue garde son URL distante. Pour publier les copies, servir `media/` et définir `ATRIUM_MEDIA_PUBLIC_BASE`, puis écrire le catalogue avec `ATRIUM_CATALOG_OUTPUT`. Le fichier public est remplacé par un renommage, pas par une écriture au milieu du téléchargement.

Le miroir parcourt les objets imbriqués (`navireDetail`, `hotelDetail`, galerie). Une clé `image` ou `url` est réécrite à n'importe quelle profondeur. L'URL d'origine reste dans `imageSource` (champ `image`) ou `source` (champ `url`), pour que le site reprenne la photo distante si la copie locale ne charge pas.

Pour éviter qu'un `groupes.json` tout neuf expose les URL distantes pendant le téléchargement (environ 15 s), le sync peut n'écrire que le fichier d'attente. Le miroir publie ensuite le JSON final.

```bash
ATRIUM_DEFER_PUBLISH=1 \
ATRIUM_OUTPUT=/opt/voyage-fiesta-reservation/groupes.json \
node atrium-sync/sync.mjs

ATRIUM_CATALOG=/opt/voyage-fiesta-reservation/groupes.json.incoming \
ATRIUM_CATALOG_OUTPUT=/opt/voyage-fiesta-reservation/groupes.json \
ATRIUM_MEDIA_DIR=/opt/voyage-fiesta-reservation/media \
ATRIUM_MEDIA_PUBLIC_BASE=https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/media \
node atrium-sync/mirror-images.mjs
```

Sans `ATRIUM_DEFER_PUBLISH`, `sync.mjs` publie `groupes.json` directement, comme avant. Les visiteurs continuent alors de voir les URL distantes jusqu'au passage du miroir.

Pousser le catalogue vers l'objet GHL **déjà créé** `custom_objects.groupes`. Le script ne crée pas l'objet et ne supprime pas de fiches. Une fiche déjà présente pour le même `atrium_id` est mise à jour. Une fiche absente du catalogue passe à `archivé`.

Le mode sec est le défaut. `DRY_RUN=0` dans le `.env` de l'API ne lance pas l'écriture. L'écriture réelle demande `GHL_GROUPE_DRY_RUN=0`. `DRY_RUN=1` force le mode sec.

```bash
ATRIUM_CATALOG=/opt/voyage-fiesta-reservation/groupes.json \
GHL_GROUPE_DRY_RUN=1 \
node push-ghl.mjs
```

Le schéma est lu à l'exécution (`GET /objects/custom_objects.groupes`). Les champs sont reliés par leur étiquette. `description_groupe` reçoit le texte. La clé réservée `description` n'est pas utilisée. La photo principale est envoyée au téléversement de fichier quand le champ est un fichier, sinon seule l'URL est écrite.

Cron VPS (toutes les 2 heures, à la minute 17):

```cron
17 */2 * * * cd /opt/voyage-fiesta-reservation && /usr/bin/node atrium-sync/sync.mjs >> /var/log/atrium-sync.log 2>&1
```

La clé reste dans `/opt/voyage-fiesta-reservation/.env`. Le journal ne contient que le nombre de groupes et le chemin du fichier.
