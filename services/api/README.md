# API Service (FastAPI)

API SaaS autonome (independante de l API extension historique), connectee directement a MongoDB.

## Features
- Register / login / refresh JWT
- Password hashing with bcrypt
- `users` collection support (existing)
- Protected route: `GET /users/me`
- Native extension ingest route: `POST /extension/influencers`
- Influencer analytics routes based on scraped TikTok payloads (`khalil.json` shape)
- Background post-scrape subtitle enrichment from `subtitleInfos` / `captionInfos`
- Influencer domain classification (`beauty`, `fitness`, `food`, `tech`, `fashion`, `travel`, `gaming`, `education`, `wellness`, `lifestyle`)
- Health route: `GET /health`

## Setup
1. Create and activate a virtualenv.
2. Install dependencies:
   `pip install -r requirements.txt`
3. Create `.env` from `.env.example` and set real secrets.

## Run
`uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## Docker

Build API image only:

```bash
docker build -t influtrack-api .
```

Run API container (example):

```bash
docker run --rm -p 8000:8000 --env-file .env influtrack-api
```

Recommended: use project root `docker-compose.yml` to run `web + api + mongo`.

## Endpoints
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /users/me` (Bearer token)
- `POST /extension/influencers` (header `X-Extension-Key`)
- `POST /influencers/import` (Bearer token)
- `GET /dashboard/overview` (Bearer token)
- `GET /influencers` (Bearer token)
- `GET /influencers/{username}` (Bearer token)
- `GET /insights/top-influencers` (Bearer token)
- `GET /insights/top-videos` (Bearer token)
- `GET /insights/top-growth` (Bearer token)
- `GET /insights/original-ideas` (Bearer token)
- `GET /insights/advanced-metrics` (Bearer token)
- `POST /scraper/tiktok/run` (Bearer token)
- `GET /health`

## Metrics exposed

### Dashboard overview
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

### Influencer summary/detail
- `followers`, `following`, `likes`
- `profile_video_count`, `scraped_video_count`
- `total_views`, `average_views`
- `engagement_rate`
- `latest_video_at`, `fetched_at`, `history_points`
- `domain`, `domain_confidence`
- `growth_followers`, `growth_likes` (detail endpoint)

### Video metrics
- `video_id`, `description`, `create_time`, `duration`
- `subtitle` (filled asynchronously in background after scraper run)
- `views`, `likes`, `comments`, `shares`, `saves`
- `engagement_count`
- `engagement_rate`
- `is_pinned`

### Growth metrics
- `followers_now`, `followers_then`
- `growth_abs`, `growth_percent`
- `reference_days`
- `fetched_at_now`, `fetched_at_then`

### Original ideas
- `rising_stars`
- `undervalued_creators`

### Advanced metrics (`/insights/advanced-metrics`)
- `growth_velocity_7d`
- `growth_velocity_30d`
- `growth_acceleration`
- `reach_efficiency`
- `engagement_quality_score`
- `consistency_score`
- `viral_hit_rate`
- `fresh_content_power`
- `evergreen_index`
- `audience_conversion_proxy`
- `stability_risk_score`
- `brandability_score`
- `breakout_score`

### Scraper run metrics
- `item_count`
- `new_items`
- `updated_items`
- `total_items`
- `batch_count`
- `duration_ms`
- `used_proxy`
- `fetched_at`

### Subtitle/domain background job controls
- `TIKTOK_SUBTITLE_BACKGROUND_ENABLED`
- `TIKTOK_SUBTITLE_FETCH_TIMEOUT_SECONDS`
- `TIKTOK_SUBTITLE_MAX_CHARS_PER_VIDEO`
- `TIKTOK_SUBTITLE_MAX_VIDEOS_PER_RUN`
- `TIKTOK_SUBTITLE_USER_AGENT`

## Shared storage model (extension + SaaS)

Mongo influencer documents now keep the same core shape as the extension backend:
- `username`
- `data`
- `latest`
- `history`
- `fetchedAt`

And one additional field to identify origin:
- `source` = `"extension"` or `"saas"`

## Notes
- Email is normalized to lowercase.
- Unique index is created on `users.email` at startup.
- Analytics data source is configured via:
  - `MONGODB_DB_NAME` (ex: `tiktok`)
  - `MONGODB_COLLECTION_NAME` (ex: `tiktok-userinfo-fr`)
- Auth data source is configured via:
  - `MONGODB_AUTH_DB_NAME` (ex: `influtrack`)
  - `MONGODB_USERS_COLLECTION_NAME` (ex: `users`)
- CORS is controlled by `CORS_ORIGINS` in `.env` (comma-separated).
- Password reset:
  - `PASSWORD_RESET_URL_BASE` controls the reset link domain.
  - `PASSWORD_RESET_DEBUG_RETURN_TOKEN=true` returns token in API response (dev only).
  - SMTP is optional via `SMTP_*` variables.
- TikTok scraper can be launched from API with:
  - `TIKTOK_SCRAPER_ENABLED=true`
  - `pydoll-python` installed
  - a valid Chrome/Chromium binary (auto-detected or `TIKTOK_SCRAPER_CHROME_BIN`)
