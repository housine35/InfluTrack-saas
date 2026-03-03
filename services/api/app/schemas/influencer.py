from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class InfluencerSummary(BaseModel):
    id: str
    username: str
    nickname: str | None = None
    avatar_url: str | None = None
    verified: bool = False
    followers: int = 0
    following: int = 0
    likes: int = 0
    profile_video_count: int = 0
    scraped_video_count: int = 0
    total_views: int = 0
    average_views: float = 0.0
    engagement_rate: float = 0.0
    fetched_at: datetime | None = None
    latest_video_at: datetime | None = None
    history_points: int = 0
    domain: str | None = None
    domain_confidence: float = 0.0


class InfluencerVideo(BaseModel):
    video_id: str
    description: str = ""
    subtitle: str | None = None
    cover_url: str | None = None
    create_time: datetime | None = None
    duration: int = 0
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    engagement_count: int = 0
    engagement_rate: float = 0.0
    is_pinned: bool = False


class InfluencerHistoryPoint(BaseModel):
    fetched_at: datetime | None = None
    followers: int = 0
    following: int = 0
    likes: int = 0
    video_count: int = 0


class InfluencerDetail(InfluencerSummary):
    bio: str | None = None
    top_videos: list[InfluencerVideo] = Field(default_factory=list)
    recent_videos: list[InfluencerVideo] = Field(default_factory=list)
    history: list[InfluencerHistoryPoint] = Field(default_factory=list)
    growth_followers: int = 0
    growth_likes: int = 0


class InfluencerListResponse(BaseModel):
    total: int
    items: list[InfluencerSummary] = Field(default_factory=list)


class DashboardOverview(BaseModel):
    total_influencers: int = 0
    total_followers: int = 0
    total_profile_likes: int = 0
    total_profile_videos: int = 0
    total_scraped_videos: int = 0
    total_views: int = 0
    average_engagement_rate: float = 0.0
    recently_updated: int = 0
    top_by_followers: InfluencerSummary | None = None
    top_by_views: InfluencerSummary | None = None


class InfluencerImportRequest(BaseModel):
    documents: list[dict[str, Any]] = Field(default_factory=list)


class InfluencerImportResponse(BaseModel):
    imported: int = 0
    usernames: list[str] = Field(default_factory=list)


class TopVideo(BaseModel):
    influencer_username: str
    influencer_nickname: str | None = None
    video_id: str
    description: str = ""
    create_time: datetime | None = None
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    engagement_rate: float = 0.0


class InfluencerGrowth(BaseModel):
    username: str
    nickname: str | None = None
    followers_now: int = 0
    followers_then: int = 0
    growth_abs: int = 0
    growth_percent: float = 0.0
    reference_days: int = 30
    fetched_at_now: datetime | None = None
    fetched_at_then: datetime | None = None


class TopInfluencersResponse(BaseModel):
    items: list[InfluencerSummary] = Field(default_factory=list)


class TopVideosResponse(BaseModel):
    items: list[TopVideo] = Field(default_factory=list)


class TopGrowthResponse(BaseModel):
    items: list[InfluencerGrowth] = Field(default_factory=list)


class OriginalIdeasResponse(BaseModel):
    rising_stars: list[InfluencerSummary] = Field(default_factory=list)
    undervalued_creators: list[InfluencerSummary] = Field(default_factory=list)


class InfluencerAdvancedMetrics(BaseModel):
    username: str
    nickname: str | None = None
    followers: int = 0
    fetched_at: datetime | None = None
    growth_velocity_7d: float = 0.0
    growth_velocity_30d: float = 0.0
    growth_acceleration: float = 0.0
    reach_efficiency: float = 0.0
    engagement_quality_score: float = 0.0
    consistency_score: float = 0.0
    viral_hit_rate: float = 0.0
    fresh_content_power: float = 0.0
    evergreen_index: float = 0.0
    audience_conversion_proxy: float = 0.0
    stability_risk_score: float = 0.0
    brandability_score: float = 0.0
    breakout_score: float = 0.0


class AdvancedMetricsLeaders(BaseModel):
    growth_velocity_7d: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    growth_velocity_30d: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    growth_acceleration: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    reach_efficiency: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    engagement_quality_score: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    consistency_score: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    viral_hit_rate: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    fresh_content_power: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    evergreen_index: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    audience_conversion_proxy: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    stability_risk_score: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    brandability_score: list[InfluencerAdvancedMetrics] = Field(default_factory=list)
    breakout_score: list[InfluencerAdvancedMetrics] = Field(default_factory=list)


class AdvancedMetricsResponse(BaseModel):
    generated_at: datetime | None = None
    leaders: AdvancedMetricsLeaders = Field(default_factory=AdvancedMetricsLeaders)
