from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_uri: str
    mongodb_db_name: str = "tiktok"
    mongodb_collection_name: str = "tiktok-userinfo-fr"
    mongodb_auth_db_name: str = "influtrack"
    mongodb_users_collection_name: str = "users"

    jwt_secret_key: str
    jwt_refresh_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    extension_api_key: str
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    password_reset_token_expire_minutes: int = 30
    password_reset_url_base: str = "http://localhost:3000/reset-password"
    password_reset_debug_return_token: bool = False
    smtp_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "InfluTrack"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    tiktok_scraper_enabled: bool = False
    tiktok_scraper_headless: bool = True
    tiktok_scraper_proxy_base: str = ""
    tiktok_scraper_proxy_ports: str = (
        "10001,10002,10003,10004,10005,10006,10007,10008,10009,10010,10011"
    )
    tiktok_scraper_chrome_bin: str = ""
    tiktok_scraper_user_agent: str = ""
    tiktok_scraper_navigation_timeout_ms: int = 60000
    tiktok_scraper_initial_wait_seconds: int = 12
    tiktok_scraper_post_scroll_wait_seconds: int = 12
    tiktok_scraper_collection_timeout_seconds: int = 45
    tiktok_scraper_single_scroll_pixels: int = 15000
    tiktok_scraper_single_scroll_pause_seconds: float = 2.0
    tiktok_scraper_response_retry_attempts: int = 8
    tiktok_scraper_response_retry_delay_seconds: float = 1.0
    tiktok_scraper_max_stored_items: int = 0
    tiktok_scraper_history_max_points: int = 180
    tiktok_subtitle_background_enabled: bool = True
    tiktok_subtitle_fetch_timeout_seconds: int = 8
    tiktok_subtitle_max_chars_per_video: int = 2000
    tiktok_subtitle_max_videos_per_run: int = 60
    tiktok_subtitle_user_agent: str = ""

    influencer_cache_ttl_seconds: int = 1800
    advanced_metrics_cache_compute_limit: int = 50

    insights_top_influencers_default_limit: int = 20
    insights_top_videos_default_limit: int = 20
    insights_top_growth_default_days: int = 30
    insights_top_growth_default_limit: int = 20
    insights_advanced_metrics_default_limit: int = 10
    influencers_list_default_limit: int = 20
    dashboard_recently_updated_days: int = 7

    cover_cache_ttl_seconds: int = 43200
    cover_fetch_timeout_seconds: int = 8
    cover_fetch_budget: int = 14
    cover_fetch_user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
    cover_fetch_accept_language: str = "en-US,en;q=0.9"

    ideas_rising_min_followers: int = 10000
    ideas_rising_max_followers: int = 500000
    ideas_rising_min_engagement_rate: float = 8.0
    ideas_undervalued_max_followers: int = 120000
    ideas_undervalued_min_average_views: int = 25000
    ideas_undervalued_min_engagement_rate: float = 10.0
    ideas_result_limit: int = 20

    metrics_weighted_engagement_comment_multiplier: float = 2.0
    metrics_weighted_engagement_share_multiplier: float = 3.0
    metrics_weighted_engagement_save_multiplier: float = 2.0
    metrics_window_short_days: int = 7
    metrics_window_medium_days: int = 30
    metrics_window_long_days: int = 90
    metrics_min_age_days: float = 0.5
    metrics_regularity_penalty_factor: float = 60.0
    metrics_regularity_two_posts_score: float = 50.0
    metrics_consistency_frequency_weight: float = 0.58
    metrics_consistency_regularity_weight: float = 0.42
    metrics_viral_threshold_multiplier: float = 2.0
    metrics_views_volatility_factor: float = 45.0
    metrics_views_volatility_cap: float = 60.0
    metrics_spike_risk_threshold_low: float = 2.0
    metrics_spike_risk_threshold_mid: float = 4.0
    metrics_spike_risk_threshold_high: float = 8.0
    metrics_spike_risk_score_low: float = 40.0
    metrics_spike_risk_score_mid: float = 25.0
    metrics_spike_risk_score_high: float = 12.0
    metrics_growth_score_multiplier: float = 5.0
    metrics_brandability_weight_engagement: float = 0.32
    metrics_brandability_weight_consistency: float = 0.28
    metrics_brandability_weight_stability: float = 0.2
    metrics_brandability_weight_growth: float = 0.2
    metrics_acceleration_ratio_scale: float = 1000000.0
    metrics_acceleration_score_multiplier: float = 2.0
    metrics_fresh_score_log_cap: float = 150000.0
    metrics_breakout_weight_acceleration: float = 0.4
    metrics_breakout_weight_fresh: float = 0.35
    metrics_breakout_weight_viral: float = 0.25

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
