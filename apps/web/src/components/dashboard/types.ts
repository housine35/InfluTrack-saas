import type {
  DashboardOverview,
  InfluencerGrowth,
  InfluencerSummary,
  OriginalIdeas,
  TopVideo,
} from "@/lib/api";

export type PlatformKey = "tiktok" | "instagram";

export type MenuKey =
  | "scraper"
  | "search"
  | "favorites"
  | "top_influencers"
  | "top_videos"
  | "growth"
  | "ideas";

export type SearchFilters = {
  minFollowers: number;
  minEngagement: number;
  verifiedOnly: boolean;
  updatedWithinDays: number | null;
  sortBy: "followers" | "views" | "engagement" | "fetched";
  order: "asc" | "desc";
};

export type DashboardState = {
  overview: DashboardOverview | null;
  searchResults: InfluencerSummary[];
  favoriteInfluencers: InfluencerSummary[];
  topInfluencers: InfluencerSummary[];
  topVideos: TopVideo[];
  topGrowth: InfluencerGrowth[];
  ideas: OriginalIdeas | null;
};
