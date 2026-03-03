export type ApiUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  favorite_influencers: string[];
  created_at: string | null;
  updated_at: string | null;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: ApiUser;
};

export type RefreshResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  issued_at: string;
};

export type ForgotPasswordResponse = {
  message: string;
  reset_token?: string | null;
  reset_url?: string | null;
};

export type ResetPasswordResponse = {
  message: string;
};

export type InfluencerSummary = {
  id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
  verified: boolean;
  followers: number;
  following: number;
  likes: number;
  profile_video_count: number;
  scraped_video_count: number;
  total_views: number;
  average_views: number;
  engagement_rate: number;
  fetched_at: string | null;
  latest_video_at: string | null;
  history_points: number;
  domain: string | null;
  domain_confidence: number;
};

export type InfluencerVideo = {
  video_id: string;
  description: string;
  subtitle: string | null;
  cover_url: string | null;
  create_time: string | null;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_count: number;
  engagement_rate: number;
  is_pinned: boolean;
};

export type InfluencerHistoryPoint = {
  fetched_at: string | null;
  followers: number;
  following: number;
  likes: number;
  video_count: number;
};

export type InfluencerDetail = InfluencerSummary & {
  bio: string | null;
  top_videos: InfluencerVideo[];
  recent_videos: InfluencerVideo[];
  history: InfluencerHistoryPoint[];
  growth_followers: number;
  growth_likes: number;
};

export type InfluencerListResponse = {
  total: number;
  items: InfluencerSummary[];
};

export type FavoriteUsernamesResponse = {
  items: string[];
};

export type DashboardOverview = {
  total_influencers: number;
  total_followers: number;
  total_profile_likes: number;
  total_profile_videos: number;
  total_scraped_videos: number;
  total_views: number;
  average_engagement_rate: number;
  recently_updated: number;
  top_by_followers: InfluencerSummary | null;
  top_by_views: InfluencerSummary | null;
};

export type ImportInfluencersResponse = {
  imported: number;
  usernames: string[];
};

export type TopVideo = {
  influencer_username: string;
  influencer_nickname: string | null;
  video_id: string;
  description: string;
  create_time: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
};

export type InfluencerGrowth = {
  username: string;
  nickname: string | null;
  followers_now: number;
  followers_then: number;
  growth_abs: number;
  growth_percent: number;
  reference_days: number;
  fetched_at_now: string | null;
  fetched_at_then: string | null;
};

export type OriginalIdeas = {
  rising_stars: InfluencerSummary[];
  undervalued_creators: InfluencerSummary[];
};

export type InfluencerAdvancedMetrics = {
  username: string;
  nickname: string | null;
  followers: number;
  fetched_at: string | null;
  growth_velocity_7d: number;
  growth_velocity_30d: number;
  growth_acceleration: number;
  reach_efficiency: number;
  engagement_quality_score: number;
  consistency_score: number;
  viral_hit_rate: number;
  fresh_content_power: number;
  evergreen_index: number;
  audience_conversion_proxy: number;
  stability_risk_score: number;
  brandability_score: number;
  breakout_score: number;
};

export type AdvancedMetricsLeaders = {
  growth_velocity_7d: InfluencerAdvancedMetrics[];
  growth_velocity_30d: InfluencerAdvancedMetrics[];
  growth_acceleration: InfluencerAdvancedMetrics[];
  reach_efficiency: InfluencerAdvancedMetrics[];
  engagement_quality_score: InfluencerAdvancedMetrics[];
  consistency_score: InfluencerAdvancedMetrics[];
  viral_hit_rate: InfluencerAdvancedMetrics[];
  fresh_content_power: InfluencerAdvancedMetrics[];
  evergreen_index: InfluencerAdvancedMetrics[];
  audience_conversion_proxy: InfluencerAdvancedMetrics[];
  stability_risk_score: InfluencerAdvancedMetrics[];
  brandability_score: InfluencerAdvancedMetrics[];
  breakout_score: InfluencerAdvancedMetrics[];
};

export type AdvancedMetrics = {
  generated_at: string | null;
  leaders: AdvancedMetricsLeaders;
};

export type TikTokScrapeRunResponse = {
  success: boolean;
  username: string;
  message: string;
  item_count: number;
  new_items: number;
  updated_items: number;
  total_items: number;
  batch_count: number;
  used_proxy: string | null;
  duration_ms: number;
  fetched_at: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is required");
}

type ApiErrorPayload = {
  detail?: string;
};

type RequestOptions = RequestInit & {
  accessToken?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, headers, ...init } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(headers ?? {}),
    },
    cache: "no-store",
  });

  const isJson = response.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("application/json");

  const payload = isJson ? ((await response.json()) as ApiErrorPayload) : null;

  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : `API error (${response.status})`;
    throw new Error(detail);
  }

  return payload as T;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function registerUser(input: {
  email: string;
  password: string;
  full_name?: string;
}) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginUser(input: { email: string; password: string }) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function refreshAccessToken(refreshToken: string) {
  return request<RefreshResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function requestPasswordReset(email: string) {
  return request<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(input: { token: string; new_password: string }) {
  return request<ResetPasswordResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCurrentUser(accessToken: string) {
  return request<ApiUser>("/users/me", {
    method: "GET",
    accessToken,
  });
}

export function getUserFavorites(accessToken: string) {
  return request<FavoriteUsernamesResponse>("/users/favorites", {
    method: "GET",
    accessToken,
  });
}

export function getFavoriteInfluencers(accessToken: string) {
  return request<InfluencerListResponse>("/users/favorites/influencers", {
    method: "GET",
    accessToken,
  });
}

export function addFavoriteInfluencer(accessToken: string, username: string) {
  return request<ApiUser>(`/users/favorites/${encodeURIComponent(username)}`, {
    method: "POST",
    accessToken,
  });
}

export function removeFavoriteInfluencer(accessToken: string, username: string) {
  return request<ApiUser>(`/users/favorites/${encodeURIComponent(username)}`, {
    method: "DELETE",
    accessToken,
  });
}

export function getDashboardOverview(accessToken: string) {
  return request<DashboardOverview>("/dashboard/overview", {
    method: "GET",
    accessToken,
  });
}

export function listInfluencers(
  accessToken: string,
  params: {
    q?: string;
    min_followers?: number;
    min_engagement?: number;
    verified_only?: boolean;
    updated_within_days?: number;
    sort_by?: "followers" | "views" | "engagement" | "fetched";
    order?: "asc" | "desc";
    skip?: number;
    limit?: number;
  } = {}
) {
  const query = buildQuery(params);
  return request<InfluencerListResponse>(`/influencers${query}`, {
    method: "GET",
    accessToken,
  });
}

export function getInfluencerDetail(accessToken: string, username: string) {
  return request<InfluencerDetail>(`/influencers/${encodeURIComponent(username)}`, {
    method: "GET",
    accessToken,
  });
}

export function importInfluencerDocuments(
  accessToken: string,
  documents: Record<string, unknown>[]
) {
  return request<ImportInfluencersResponse>("/influencers/import", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ documents }),
  });
}

export function getTopInfluencers(
  accessToken: string,
  params: {
    metric?: "followers" | "views" | "engagement";
    limit?: number;
  } = {}
) {
  const query = buildQuery(params);
  return request<{ items: InfluencerSummary[] }>(`/insights/top-influencers${query}`, {
    method: "GET",
    accessToken,
  });
}

export function getTopVideos(accessToken: string, limit?: number) {
  const query = buildQuery({ limit });
  return request<{ items: TopVideo[] }>(`/insights/top-videos${query}`, {
    method: "GET",
    accessToken,
  });
}

export function getTopGrowth(accessToken: string, days?: number, limit?: number) {
  const query = buildQuery({ days, limit });
  return request<{ items: InfluencerGrowth[] }>(`/insights/top-growth${query}`, {
    method: "GET",
    accessToken,
  });
}

export function getOriginalIdeas(accessToken: string) {
  return request<OriginalIdeas>("/insights/original-ideas", {
    method: "GET",
    accessToken,
  });
}

export function getAdvancedMetrics(accessToken: string, limit?: number) {
  const query = buildQuery({ limit });
  return request<AdvancedMetrics>(`/insights/advanced-metrics${query}`, {
    method: "GET",
    accessToken,
  });
}

export function runTikTokScrape(
  accessToken: string,
  input: { username: string; force_refresh?: boolean }
) {
  return request<TikTokScrapeRunResponse>("/scraper/tiktok/run", {
    method: "POST",
    accessToken,
    body: JSON.stringify(input),
  });
}
