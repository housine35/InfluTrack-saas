"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ExternalLink,
  Heart,
  MessageCircle,
  PlaySquare,
  Share2,
  Star,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import {
  addFavoriteInfluencer,
  getInfluencerDetail,
  removeFavoriteInfluencer,
  type InfluencerDetail,
} from "@/lib/api";
import { ensureAuthenticatedSession } from "@/lib/auth-session";
import { getSession, saveSession } from "@/lib/session";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatCompactNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${value}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function usernameInitial(username: string): string {
  return (username || "?").charAt(0).toUpperCase();
}

function buildTikTokVideoUrl(username: string, videoId: string): string {
  return `https://www.tiktok.com/@${encodeURIComponent(username)}/video/${encodeURIComponent(videoId)}`;
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

const DEFAULT_VIDEO_THUMBNAIL = "/video-placeholder.svg";

function handleThumbnailError(event: SyntheticEvent<HTMLImageElement>) {
  const target = event.currentTarget;
  if (target.dataset.fallbackApplied === "1") return;
  target.dataset.fallbackApplied = "1";
  target.src = DEFAULT_VIDEO_THUMBNAIL;
}

type HistoryRow = {
  fetched_at: string | null;
  followers: number;
  likes: number;
  video_count: number;
  followers_delta: number;
};

type RecentSortKey =
  | "create_time"
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "engagement_rate";

type RecentSortOrder = "asc" | "desc";

type ChartRow = HistoryRow & { ts: number };

const GROWTH_RANGES = [7, 15, 30] as const;
type GrowthRange = (typeof GROWTH_RANGES)[number];
const RECENT_VIDEOS_PAGE_SIZE = 10;
type RecentPaginationToken = number | "left-dots" | "right-dots";

function buildRecentPaginationTokens(totalPages: number, currentPage: number): RecentPaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "right-dots", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "left-dots", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "left-dots", currentPage - 1, currentPage, currentPage + 1, "right-dots", totalPages];
}

function normalizeHistorySeries(items: HistoryRow[]): ChartRow[] {
  return items
    .map((item) => {
      const ts = parseTimestamp(item.fetched_at);
      if (ts === null) return null;
      return { ...item, ts };
    })
    .filter((item): item is ChartRow => item !== null)
    .sort((a, b) => a.ts - b.ts);
}

function growthDeltaForDays(series: ChartRow[], days: number): number | null {
  if (series.length < 2) return null;

  const latest = series[series.length - 1];
  const targetTs = latest.ts - days * 24 * 60 * 60 * 1000;
  let baseline = series[0];

  for (let i = series.length - 2; i >= 0; i -= 1) {
    const candidate = series[i];
    if (candidate.ts <= targetTs) {
      baseline = candidate;
      break;
    }
  }

  return latest.followers - baseline.followers;
}

function seriesForDays(series: ChartRow[], days: number): ChartRow[] {
  if (series.length < 2) return series;

  const latest = series[series.length - 1];
  const targetTs = latest.ts - days * 24 * 60 * 60 * 1000;
  const firstIndex = series.findIndex((point) => point.ts >= targetTs);
  if (firstIndex <= 0) return series;
  return series.slice(firstIndex - 1);
}

function FollowersGrowthChart({ items }: { items: HistoryRow[] }) {
  const [activeRange, setActiveRange] = useState<GrowthRange>(30);
  const series = useMemo(() => normalizeHistorySeries(items), [items]);

  const growthByRange = useMemo(
    () => ({
      7: growthDeltaForDays(series, 7),
      15: growthDeltaForDays(series, 15),
      30: growthDeltaForDays(series, 30),
    }),
    [series]
  );

  const displayed = useMemo(() => seriesForDays(series, activeRange), [series, activeRange]);
  if (displayed.length < 2) return null;

  const width = 860;
  const height = 220;
  const padding = 22;
  const values = displayed.map((item) => item.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = displayed.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(displayed.length - 1, 1);
    const y = height - padding - ((item.followers - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x} ${height - padding} L ${firstPoint.x} ${height - padding} Z`;

  const firstFollowers = displayed[0].followers;
  const lastFollowers = displayed[displayed.length - 1].followers;
  const delta = lastFollowers - firstFollowers;

  return (
    <div className="mt-4 rounded-xl border border-[#e6eaf2] bg-[#fafcff] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700">Audience growth chart</span>
        <span className={`font-semibold ${delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
          {delta >= 0 ? "+" : ""}
          {formatNumber(delta)} followers
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {GROWTH_RANGES.map((days) => {
          const value = growthByRange[days];
          const selected = activeRange === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => setActiveRange(days)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                selected
                  ? "border-[#5b35d5] bg-[#f3f0fe] text-[#5b35d5]"
                  : "border-[#d8dce3] bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {days}d: {value === null ? "-" : `${value >= 0 ? "+" : ""}${formatCompactNumber(value)}`}
            </button>
          );
        })}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full">
        <defs>
          <linearGradient id="followers-growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5bf7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#7c5bf7" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#d8deea"
          strokeWidth="1"
        />
        <path d={areaPath} fill="url(#followers-growth-fill)" />
        <path d={linePath} fill="none" stroke="#6e3ff3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 4.5 : 3}
            fill="#6e3ff3"
            opacity={index === points.length - 1 ? 1 : 0.75}
          />
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Range {activeRange}d | Start {formatNumber(firstFollowers)} | End {formatNumber(lastFollowers)}
        </span>
        <span>
          Min {formatNumber(min)} | Max {formatNumber(max)}
        </span>
      </div>
    </div>
  );
}

export default function InfluencerDetailPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const usernameParam = typeof params.username === "string" ? params.username : "";

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [detail, setDetail] = useState<InfluencerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [avatarFallback, setAvatarFallback] = useState(false);
  const [recentSortKey, setRecentSortKey] = useState<RecentSortKey>("create_time");
  const [recentSortOrder, setRecentSortOrder] = useState<RecentSortOrder>("desc");
  const [recentPage, setRecentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setError(null);

      try {
        const session = await ensureAuthenticatedSession();
        if (cancelled) return;

        setAccessToken(session.accessToken);
        const influencer = await getInfluencerDetail(session.accessToken, usernameParam);
        if (cancelled) return;

        setDetail(influencer);

        const userFavorites = Array.isArray(session.user.favorite_influencers)
          ? session.user.favorite_influencers
          : [];
        const isFavorite = userFavorites.some(
          (value) => value.toLowerCase() === influencer.username.toLowerCase()
        );
        setFavorite(isFavorite);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Influencer detail error.";
        setError(message);
        if (message === "NO_SESSION" || message === "SESSION_EXPIRED") {
          router.replace("/login");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (usernameParam) {
      void loadDetail();
    }

    return () => {
      cancelled = true;
    };
  }, [router, usernameParam]);

  useEffect(() => {
    setAvatarFallback(false);
  }, [detail?.avatar_url]);

  useEffect(() => {
    setRecentPage(1);
  }, [detail?.username]);

  const historyRows = useMemo<HistoryRow[]>(() => {
    if (!detail || detail.history.length === 0) return [];

    return detail.history.map((point, index) => {
      const prev = index > 0 ? detail.history[index - 1] : null;
      return {
        fetched_at: point.fetched_at,
        followers: point.followers,
        likes: point.likes,
        video_count: point.video_count,
        followers_delta: prev ? point.followers - prev.followers : 0,
      };
    });
  }, [detail]);

  const trendMessage = useMemo(() => {
    if (!detail || detail.history.length < 2) return "Not enough history";
    const first = detail.history[0];
    const last = detail.history[detail.history.length - 1];
    const delta = last.followers - first.followers;
    if (delta > 0) return `+${formatNumber(delta)} followers`;
    if (delta < 0) return `${formatNumber(delta)} followers`;
    return "No change";
  }, [detail]);

  const sortedRecentVideos = useMemo(() => {
    if (!detail) return [];

    const items = [...detail.recent_videos];
    const direction = recentSortOrder === "asc" ? 1 : -1;

    const asTime = (value: string | null): number => {
      const ts = parseTimestamp(value);
      return ts ?? 0;
    };

    const metric = (video: (typeof items)[number]): number => {
      if (recentSortKey === "create_time") return asTime(video.create_time);
      if (recentSortKey === "views") return video.views;
      if (recentSortKey === "likes") return video.likes;
      if (recentSortKey === "comments") return video.comments;
      if (recentSortKey === "shares") return video.shares;
      return video.engagement_rate;
    };

    items.sort((a, b) => {
      const va = metric(a);
      const vb = metric(b);
      if (va === vb) return 0;
      return va > vb ? direction : -direction;
    });

    return items;
  }, [detail, recentSortKey, recentSortOrder]);

  const totalRecentPages = useMemo(() => {
    if (sortedRecentVideos.length === 0) return 1;
    return Math.ceil(sortedRecentVideos.length / RECENT_VIDEOS_PAGE_SIZE);
  }, [sortedRecentVideos.length]);

  const paginatedRecentVideos = useMemo(() => {
    const start = (recentPage - 1) * RECENT_VIDEOS_PAGE_SIZE;
    return sortedRecentVideos.slice(start, start + RECENT_VIDEOS_PAGE_SIZE);
  }, [sortedRecentVideos, recentPage]);

  const recentPageTokens = useMemo(
    () => buildRecentPaginationTokens(totalRecentPages, recentPage),
    [totalRecentPages, recentPage]
  );

  const recentShowingLabel = useMemo(() => {
    if (sortedRecentVideos.length === 0) return "0-0";
    const start = (recentPage - 1) * RECENT_VIDEOS_PAGE_SIZE + 1;
    const end = Math.min(recentPage * RECENT_VIDEOS_PAGE_SIZE, sortedRecentVideos.length);
    return `${start}-${end}`;
  }, [recentPage, sortedRecentVideos.length]);

  useEffect(() => {
    if (recentPage > totalRecentPages) {
      setRecentPage(totalRecentPages);
    }
  }, [recentPage, totalRecentPages]);

  function toggleRecentSort(key: RecentSortKey) {
    setRecentPage(1);

    if (recentSortKey === key) {
      setRecentSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setRecentSortKey(key);
    setRecentSortOrder("desc");
  }

  function recentSortIndicator(key: RecentSortKey): string {
    if (recentSortKey !== key) return "";
    return recentSortOrder === "asc" ? "(asc)" : "(desc)";
  }

  function goToRecentPage(page: number) {
    if (page < 1 || page > totalRecentPages || page === recentPage) return;
    setRecentPage(page);
  }

  async function handleToggleFavorite() {
    if (!accessToken || !detail) return;

    setFavoriteLoading(true);
    setError(null);
    try {
      const nextUser = favorite
        ? await removeFavoriteInfluencer(accessToken, detail.username)
        : await addFavoriteInfluencer(accessToken, detail.username);

      const nextFavorites = Array.isArray(nextUser.favorite_influencers)
        ? nextUser.favorite_influencers
        : [];
      const nextIsFavorite = nextFavorites.some(
        (value) => value.toLowerCase() === detail.username.toLowerCase()
      );
      setFavorite(nextIsFavorite);

      const currentSession = getSession();
      if (currentSession) {
        saveSession({ ...currentSession, user: nextUser });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update favorite.");
    } finally {
      setFavoriteLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dfe8ff_0%,_#eef3fb_40%,_#f5f8fc_100%)] px-2 pb-8 pt-3 md:px-6 md:pt-6">
      <section className="mx-auto w-full max-w-[1880px] rounded-[26px] border border-[#e4e9f3] bg-white/95 p-4 shadow-[0_14px_50px_rgba(15,23,42,0.08)] backdrop-blur md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8dff0] bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f7f9ff]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          {detail ? (
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={favoriteLoading}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-70 ${
                favorite
                  ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-[#d8dff0] bg-white text-slate-700 hover:bg-[#f7f9ff]"
              }`}
            >
              <Star className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
              {favorite ? "Remove from favorites" : "Add to favorites"}
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-6 rounded-lg border border-[#eceef2] bg-[#fafbff] px-4 py-3 text-sm text-slate-600">
            Loading profile...
          </p>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        {detail ? (
          <>
            <article className="mt-6 overflow-hidden rounded-3xl border border-[#dde4f4] bg-[linear-gradient(125deg,#f6f8ff_0%,#ffffff_45%,#eef4ff_100%)] p-5 shadow-[0_8px_28px_rgba(30,64,175,0.08)] md:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#dbe0ea] bg-white shadow-sm">
                    {detail.avatar_url && !avatarFallback ? (
                      <img
                        src={detail.avatar_url}
                        alt={`@${detail.username}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarFallback(true)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#6e3ff3] to-[#aa8ef9] text-xl font-bold text-white">
                        {usernameInitial(detail.username)}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">@{detail.username}</h1>
                      {detail.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-600">{detail.nickname || "-"}</p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe0ea] bg-white px-2.5 py-1 text-slate-600 shadow-sm">
                        <Users className="h-3.5 w-3.5" />
                        Followers {formatNumber(detail.followers)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe0ea] bg-white px-2.5 py-1 text-slate-600 shadow-sm">
                        <UserPlus className="h-3.5 w-3.5" />
                        Following {formatNumber(detail.following)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe0ea] bg-white px-2.5 py-1 text-slate-600 shadow-sm">
                        <PlaySquare className="h-3.5 w-3.5" />
                        Profile videos {formatNumber(detail.profile_video_count)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-slate-600">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-[#dbe0ea] bg-white px-3 py-2 shadow-sm">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    Last update: {formatDateTime(detail.fetched_at)}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-[#dbe0ea] bg-white px-3 py-2 shadow-sm">
                    <PlaySquare className="h-4 w-4 text-slate-400" />
                    Latest video: {formatDateTime(detail.latest_video_at)}
                  </div>
                </div>
              </div>

              {detail.bio ? (
                <p className="mt-4 rounded-2xl border border-[#dde2ee] bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  {detail.bio}
                </p>
              ) : null}
            </article>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <article className="rounded-2xl border border-[#e8edf7] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Users className="h-4 w-4 text-slate-400" />Followers</div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(detail.followers)}</p>
              </article>
              <article className="rounded-2xl border border-[#e8edf7] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Heart className="h-4 w-4 text-slate-400" />Profile likes</div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(detail.likes)}</p>
              </article>
              <article className="rounded-2xl border border-[#e8edf7] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Eye className="h-4 w-4 text-slate-400" />Total views</div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(detail.total_views)}</p>
              </article>
              <article className="rounded-2xl border border-[#e8edf7] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><BarChart3 className="h-4 w-4 text-slate-400" />Avg views</div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(detail.average_views)}</p>
              </article>
              <article className="rounded-2xl border border-[#e8edf7] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><TrendingUp className="h-4 w-4 text-slate-400" />Engagement</div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPercent(detail.engagement_rate)}</p>
              </article>
              <article className="rounded-2xl border border-[#e8edf7] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><TrendingUp className="h-4 w-4 text-slate-400" />Followers growth</div>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{detail.growth_followers >= 0 ? "+" : ""}{formatNumber(detail.growth_followers)}</p>
              </article>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
              <article className="rounded-2xl border border-[#e8edf7] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-[#eceef2] pb-3">
                  <h2 className="text-base font-semibold text-slate-900">Audience history</h2>
                  <span className="rounded-full border border-[#dde2ee] bg-[#fafbff] px-2.5 py-1 text-xs font-semibold text-slate-600">{trendMessage}</span>
                </div>

                {historyRows.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-[#eceef2] bg-[#fafbff] px-3 py-2 text-sm text-slate-600">No history data available.</p>
                ) : (
                  <>
                    <FollowersGrowthChart items={historyRows} />
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[#eceef2] text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-2 py-2">Date</th><th className="px-2 py-2">Followers</th><th className="px-2 py-2">Delta</th><th className="px-2 py-2">Likes</th><th className="px-2 py-2">Videos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyRows.map((row, index) => (
                            <tr key={`${row.fetched_at}-${index}`} className="border-b border-[#f0f2f6] text-slate-700">
                              <td className="px-2 py-2">{formatDateTime(row.fetched_at)}</td>
                              <td className="px-2 py-2 font-semibold">{formatNumber(row.followers)}</td>
                              <td className={`px-2 py-2 ${row.followers_delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{row.followers_delta > 0 ? "+" : ""}{formatNumber(row.followers_delta)}</td>
                              <td className="px-2 py-2">{formatNumber(row.likes)}</td>
                              <td className="px-2 py-2">{formatNumber(row.video_count)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </article>

              <article className="rounded-2xl border border-[#e8edf7] bg-white p-4 shadow-sm">
                <div className="border-b border-[#eceef2] pb-3">
                  <h2 className="text-base font-semibold text-slate-900">Top videos</h2>
                  <p className="mt-1 text-xs text-slate-500">Best performing videos by views</p>
                </div>

                <div className="mt-4 space-y-2">
                  {detail.top_videos.length === 0 ? (
                    <p className="rounded-lg border border-[#eceef2] bg-[#fafbff] px-3 py-2 text-sm text-slate-600">No top videos available.</p>
                  ) : (
                    detail.top_videos.slice(0, 8).map((video, index) => {
                      const videoUrl = buildTikTokVideoUrl(detail.username, video.video_id);
                      const primaryText = video.description?.trim() || video.video_id;

                      return (
                        <a key={`${video.video_id}-${index}`} href={videoUrl} target="_blank" rel="noreferrer" className="group block rounded-lg border border-[#eceef2] bg-[#fafbff] p-3 transition hover:border-[#d7dcf0] hover:bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md border border-[#e2e6f0] bg-white">
                                <img
                                  src={video.cover_url || DEFAULT_VIDEO_THUMBNAIL}
                                  alt={primaryText}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={handleThumbnailError}
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="line-clamp-2 text-sm font-semibold text-slate-800 transition group-hover:text-[#5b35d5]">{primaryText}</p>
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><span>{formatDateTime(video.create_time)}</span><span>|</span><ExternalLink className="h-3.5 w-3.5" /><span>Open video</span></div>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">{formatPercent(video.engagement_rate)}</span>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#e5e9f3] bg-white px-2 py-1"><Eye className="h-3.5 w-3.5 text-slate-500" />{formatCompactNumber(video.views)}</span>
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#ffe0e4] bg-white px-2 py-1"><Heart className="h-3.5 w-3.5 text-rose-500" />{formatCompactNumber(video.likes)}</span>
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#dfe9ff] bg-white px-2 py-1"><MessageCircle className="h-3.5 w-3.5 text-blue-500" />{formatCompactNumber(video.comments)}</span>
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#dcf6ea] bg-white px-2 py-1"><Share2 className="h-3.5 w-3.5 text-emerald-600" />{formatCompactNumber(video.shares)}</span>
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </article>
            </div>

            <article className="mt-5 overflow-hidden rounded-2xl border border-[#e8edf7] bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf7] bg-[linear-gradient(180deg,#f9fbff_0%,#ffffff_100%)] px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Recent videos</h2>
                  <p className="mt-1 text-xs text-slate-500">Click views, likes, comments, shares or engagement to sort.</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-[#dde3f2] bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  Showing {recentShowingLabel} of {formatNumber(sortedRecentVideos.length)}
                </span>
              </div>

              {sortedRecentVideos.length === 0 ? (
                <div className="p-4">
                  <p className="rounded-lg border border-[#eceef2] bg-[#fafbff] px-3 py-2 text-sm text-slate-600">No recent videos available.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto px-4 py-3">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[#e8edf7] text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-2 py-2.5">Video</th>
                          <th className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleRecentSort("create_time")}
                              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Published {recentSortIndicator("create_time")}
                            </button>
                          </th>
                          <th className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleRecentSort("views")}
                              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Views {recentSortIndicator("views")}
                            </button>
                          </th>
                          <th className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleRecentSort("likes")}
                              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Likes {recentSortIndicator("likes")}
                            </button>
                          </th>
                          <th className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleRecentSort("comments")}
                              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Comments {recentSortIndicator("comments")}
                            </button>
                          </th>
                          <th className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleRecentSort("shares")}
                              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Shares {recentSortIndicator("shares")}
                            </button>
                          </th>
                          <th className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleRecentSort("engagement_rate")}
                              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Engagement {recentSortIndicator("engagement_rate")}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRecentVideos.map((video, index) => {
                          const videoUrl = buildTikTokVideoUrl(detail.username, video.video_id);
                          const primaryText = video.description?.trim() || video.video_id;

                          return (
                            <tr
                              key={`${video.video_id}-${video.create_time ?? index}`}
                              className="border-b border-[#edf1f7] text-slate-700 transition hover:bg-[#f8faff] last:border-b-0"
                            >
                              <td className="px-2 py-2.5">
                                <div className="flex items-start gap-2.5">
                                  <a
                                    href={videoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="relative block h-12 w-10 shrink-0 overflow-hidden rounded-md border border-[#e2e6f0] bg-white"
                                  >
                                    <img
                                      src={video.cover_url || DEFAULT_VIDEO_THUMBNAIL}
                                      alt={primaryText}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                      onError={handleThumbnailError}
                                    />
                                  </a>

                                  <div className="min-w-0">
                                    <a
                                      href={videoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="line-clamp-2 text-sm font-semibold text-slate-800 hover:text-[#5b35d5]"
                                    >
                                      {primaryText}
                                    </a>
                                    <p className="truncate text-xs text-slate-500">{video.video_id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-2.5">{formatDateTime(video.create_time)}</td>
                              <td className="px-2 py-2.5"><span className="inline-flex items-center gap-1 text-slate-700"><Eye className="h-3.5 w-3.5 text-slate-500" />{formatCompactNumber(video.views)}</span></td>
                              <td className="px-2 py-2.5"><span className="inline-flex items-center gap-1 text-slate-700"><Heart className="h-3.5 w-3.5 text-rose-500" />{formatCompactNumber(video.likes)}</span></td>
                              <td className="px-2 py-2.5"><span className="inline-flex items-center gap-1 text-slate-700"><MessageCircle className="h-3.5 w-3.5 text-blue-500" />{formatCompactNumber(video.comments)}</span></td>
                              <td className="px-2 py-2.5"><span className="inline-flex items-center gap-1 text-slate-700"><Share2 className="h-3.5 w-3.5 text-emerald-600" />{formatCompactNumber(video.shares)}</span></td>
                              <td className="px-2 py-2.5">{formatPercent(video.engagement_rate)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf7] bg-[#fbfcff] px-4 py-3">
                    <p className="text-xs font-medium text-slate-600">
                      Page {recentPage} / {totalRecentPages}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => goToRecentPage(recentPage - 1)}
                        disabled={recentPage === 1}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d8deeb] bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Prev
                      </button>

                      {recentPageTokens.map((token) => {
                        if (typeof token !== "number") {
                          return (
                            <span key={token} className="px-2 text-xs font-semibold text-slate-400">
                              ...
                            </span>
                          );
                        }

                        const active = token === recentPage;
                        return (
                          <button
                            key={token}
                            type="button"
                            onClick={() => goToRecentPage(token)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                              active
                                ? "border-[#5b35d5] bg-[#f1ecff] text-[#5b35d5]"
                                : "border-[#d8deeb] bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {token}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => goToRecentPage(recentPage + 1)}
                        disabled={recentPage === totalRecentPages}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d8deeb] bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}
