from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_auth import router as auth_router
from app.api.routes_extension import router as extension_router
from app.api.routes_health import router as health_router
from app.api.routes_influencers import router as influencers_router
from app.api.routes_influencers import warm_influencer_cache
from app.api.routes_scraper import router as scraper_router
from app.api.routes_users import router as users_router
from app.core.config import get_settings
from app.db.mongodb import ensure_indexes


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_indexes()
    warm_influencer_cache()
    yield


app = FastAPI(title="InfluTrack SaaS API", version="0.1.0", lifespan=lifespan)
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(extension_router)
app.include_router(influencers_router)
app.include_router(scraper_router)
