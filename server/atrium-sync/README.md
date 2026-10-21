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

Fixture de développement:

```bash
node fixtures/build-fixture.mjs
ATRIUM_FIXTURE=fixtures/atrium-api.json ATRIUM_OUTPUT=../../groupes/data/groupes.json node sync.mjs
```

`groupes/data/groupes.json` est un catalogue d'exemple pour l'affichage local (`localhost` ou `?fixture=1`). Le site public lit l'URL de l'API, pas ce fichier.

Cron VPS (toutes les 2 heures, à la minute 17):

```cron
17 */2 * * * cd /opt/voyage-fiesta-reservation && /usr/bin/node atrium-sync/sync.mjs >> /var/log/atrium-sync.log 2>&1
```

La clé reste dans `/opt/voyage-fiesta-reservation/.env`. Le journal ne contient que le nombre de groupes et le chemin du fichier.
