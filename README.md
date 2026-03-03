# InfluTrack SAAS

Plateforme SAAS pour analyser des influenceurs TikTok avec:
- frontend `Next.js` (`apps/web`)
- API `FastAPI` independante (`services/api`)
- base `MongoDB`

Le projet inclut maintenant un setup Docker complet pour deploiement.

## Architecture

```text
SAAS/
  apps/
    web/                  # Frontend Next.js
  services/
    api/                  # API FastAPI
  infra/
    nginx/prod.conf       # Reverse proxy prod
  docker-compose.yml      # Stack Docker locale (web/api/mongo)
  docker-compose.prod.yml # Stack Docker production
```

## Features principales

- Auth: register/login/refresh
- Password reset: forgot-password + reset-password
- Dashboard analytics TikTok
- Fiche influenceur detaillee
- Favoris utilisateur
- Endpoint de scraping TikTok lance depuis le dashboard
- Ingestion extension -> API SAAS

## Metrics TikTok disponibles

### Dashboard global (`GET /dashboard/overview`)

- `total_influencers`
- `total_followers`
- `total_profile_likes`
- `total_profile_videos`
- `total_scraped_videos`
- `total_views`
- `average_engagement_rate`
- `recently_updated`
- `top_by_followers`
- `top_by_views`

### Listing / recherche (`GET /influencers`)

Par influenceur:
- `followers`, `following`, `likes`
- `profile_video_count`, `scraped_video_count`
- `total_views`, `average_views`
- `engagement_rate`
- `latest_video_at`, `fetched_at`, `history_points`
- `domain`, `domain_confidence`

Filtres/tri disponibles:
- `q`
- `min_followers`, `max_followers`
- `min_engagement`
- `sort_by=followers|views|engagement|fetched`
- `order=asc|desc`

### Fiche influenceur (`GET /influencers/{username}`)

Metriques profil:
- toutes les metriques du listing
- `growth_followers`
- `growth_likes`

Historique audience:
- `history[].fetched_at`
- `history[].followers`
- `history[].following`
- `history[].likes`
- `history[].video_count`

Metriques video (top/recent):
- `video_id`, `description`, `create_time`, `duration`
- `subtitle` (enrichi en background apres scraping)
- `views`, `likes`, `comments`, `shares`, `saves`
- `engagement_count`
- `engagement_rate`
- `is_pinned`

### Insights ranking

`GET /insights/top-influencers`
- ranking par `metric=followers|views|engagement`

`GET /insights/top-videos`
- `views`, `likes`, `comments`, `shares`, `engagement_rate`

`GET /insights/top-growth`
- `followers_now`, `followers_then`
- `growth_abs`, `growth_percent`
- `reference_days`

`GET /insights/original-ideas`
- `rising_stars`
- `undervalued_creators`

`GET /insights/advanced-metrics` (13 metriques)
- `growth_velocity_7d`: followers gagnes/jour sur 7 jours
- `growth_velocity_30d`: followers gagnes/jour sur 30 jours
- `growth_acceleration`: delta vitesse 7j vs 30j
- `reach_efficiency`: vues moyennes 30j / followers
- `engagement_quality_score`: engagement pondere par vue
- `consistency_score`: frequence + regularite de publication
- `viral_hit_rate`: part de videos au-dessus du seuil viral
- `fresh_content_power`: vues/jour sur videos recentes
- `evergreen_index`: performance continue des anciennes videos
- `audience_conversion_proxy`: gain followers par 1k engagements
- `stability_risk_score`: volatilite + risque de spike suspect
- `brandability_score`: score composite "campaign ready"
- `breakout_score`: potentiel de croissance explosive

### Scraper run (`POST /scraper/tiktok/run`)

- `item_count`
- `new_items`
- `updated_items`
- `total_items`
- `batch_count`
- `duration_ms`
- `used_proxy`
- `fetched_at`

Apres un run scraper, une tache background complete:
- extraction des sous-titres depuis `subtitleInfos` / `captionInfos`
- classification du compte dans un domaine (`beauty`, `fitness`, `food`, `tech`, `fashion`, `travel`, `gaming`, `education`, `wellness`, `lifestyle`)

## Prerequis

- Docker + Docker Compose plugin
- (optionnel, hors Docker) Node.js 20+ et Python 3.13

## Deploiement Docker local (recommande)

### 1. Configurer l API

Depuis `D:\USA\SAAS`:

```powershell
Copy-Item services/api/.env.docker.example services/api/.env
Copy-Item .env.docker.example .env
```

Ensuite, edite `services/api/.env` et change au minimum:
- `JWT_SECRET_KEY`
- `JWT_REFRESH_SECRET_KEY`
- `EXTENSION_API_KEY`
- `PASSWORD_RESET_DEBUG_RETURN_TOKEN=false` en prod
- variables `SMTP_*` si tu veux un vrai envoi mail reset password

Note:
- Dans Docker, `MONGODB_URI` sera force a `mongodb://mongo:27017` par `docker-compose.yml`.
- Le fichier `.env` (racine) pilote les variables compose comme `NEXT_PUBLIC_API_BASE_URL`.

### 2. Lancer la stack

```powershell
docker compose up -d --build
```

Services exposes:
- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017`

### 3. Stop / logs / restart

```powershell
docker compose logs -f
docker compose restart api
docker compose down
```

Pour supprimer aussi le volume Mongo:

```powershell
docker compose down -v
```

## Deploiement Docker production

### 1. Preparer les variables

Depuis `D:\USA\SAAS`:

```powershell
Copy-Item services/api/.env.docker.example services/api/.env
Copy-Item .env.prod.example .env.prod
```

Puis:
- edite `services/api/.env` (secrets JWT, SMTP, etc.)
- edite `.env.prod` (domaines publics)

### 2. Lancer la stack prod

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Acces:
- App via proxy Nginx: `http://<ton-serveur>` (port `80`)
- API publique via proxy: `http://<ton-serveur>/api/...`

### 3. Operer la stack prod

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f
docker compose -f docker-compose.prod.yml --env-file .env.prod restart api
docker compose -f docker-compose.prod.yml --env-file .env.prod down
```

## Variables importantes

### API (`services/api/.env`)

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `MONGODB_COLLECTION_NAME`
- `MONGODB_AUTH_DB_NAME`
- `MONGODB_USERS_COLLECTION_NAME`
- `JWT_SECRET_KEY`
- `JWT_REFRESH_SECRET_KEY`
- `EXTENSION_API_KEY`
- `CORS_ORIGINS`

Password reset:
- `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES`
- `PASSWORD_RESET_URL_BASE`
- `PASSWORD_RESET_DEBUG_RETURN_TOKEN`
- `SMTP_ENABLED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`

TikTok scraper:
- `TIKTOK_SCRAPER_ENABLED`
- `TIKTOK_SCRAPER_HEADLESS`
- `TIKTOK_SCRAPER_CHROME_BIN`
- `TIKTOK_SCRAPER_PROXY_BASE`
- `TIKTOK_SCRAPER_PROXY_PORTS`

### Web

Le frontend utilise `NEXT_PUBLIC_API_BASE_URL`.

Dans `docker-compose.yml`, cette valeur vient du `.env` racine:
- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`)
- `CORS_ORIGINS` (default local)
- `PASSWORD_RESET_URL_BASE` (default local)

Dans `docker-compose.prod.yml`, ces variables viennent de `.env.prod`:
- `NEXT_PUBLIC_API_BASE_URL` (recommande: `/api`)
- `CORS_ORIGINS` (ex: `https://app.example.com`)
- `PASSWORD_RESET_URL_BASE` (ex: `https://app.example.com/reset-password`)

## Endpoints API

Auth:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /users/me` (Bearer)

Influenceurs:
- `POST /extension/influencers` (`X-Extension-Key`)
- `POST /influencers/import` (Bearer)
- `GET /dashboard/overview` (Bearer)
- `GET /influencers` (Bearer)
- `GET /influencers/{username}` (Bearer)
- `GET /insights/top-influencers` (Bearer)
- `GET /insights/top-videos` (Bearer)
- `GET /insights/top-growth` (Bearer)
- `GET /insights/original-ideas` (Bearer)
- `GET /insights/advanced-metrics` (Bearer)

Scraper:
- `POST /scraper/tiktok/run` (Bearer)

Systeme:
- `GET /health`

## Lancer sans Docker (dev)

### API

```powershell
cd services/api
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Web

```powershell
cd apps/web
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

## Notes production

- Desactive `PASSWORD_RESET_DEBUG_RETURN_TOKEN`.
- Configure SMTP pour le reset password.
- Mets des secrets JWT forts.
- Restreins `CORS_ORIGINS` a tes domaines reels.
- Garde `NEXT_PUBLIC_API_BASE_URL=/api` si tu passes par le proxy Nginx.

## Ameliorations recommandees

### Priorite haute

- Activer TLS (HTTPS) en frontal:
  - soit Nginx + Certbot
  - soit reverse proxy managé (Cloudflare, Traefik, Caddy)
- Ajouter rate limiting sur auth/scraper.
- Activer backup Mongo automatique (snapshot quotidien + retention).
- Mettre rotation des secrets (`JWT_*`, `EXTENSION_API_KEY`) tous les 60-90 jours.

### Priorite moyenne

- Ajouter observabilite:
  - logs structurees JSON
  - healthcheck metiers (DB + scraping deps)
  - Sentry / OpenTelemetry
- Ajouter file de jobs pour scraping (Celery/RQ) au lieu de run synchrone.
- Ajouter cache Redis pour endpoints analytics lourds.
- Ajouter tests API automatises (auth, forgot/reset password, scraper, insights).

### Produit / UX

- Historique des runs scraping (qui, quand, statut, duree, erreur).
- Notifications email/slack quand un scraping echoue.
- Onboarding client (wizard + checklist).
- RBAC multi-tenant (owner/admin/analyst/viewer).
