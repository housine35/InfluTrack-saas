"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useEffect } from "react";

import {
  addFavoriteInfluencer,
  getAdvancedMetrics,
  getDashboardOverview,
  getFavoriteInfluencers,
  getOriginalIdeas,
  getTopGrowth,
  getTopInfluencers,
  getTopVideos,
  getUserFavorites,
  listInfluencers,
  removeFavoriteInfluencer,
  runTikTokScrape,
  type AdvancedMetrics,
  type DashboardOverview,
  type InfluencerGrowth,
  type InfluencerSummary,
  type OriginalIdeas,
  type TikTokScrapeRunResponse,
  type TopVideo,
} from "@/lib/api";
import { DashboardContent } from "@/components/dashboard/content";
import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { StatsCards } from "@/components/dashboard/stats-cards";
import type { MenuKey, PlatformKey, SearchFilters } from "@/components/dashboard/types";
import { ensureAuthenticatedSession } from "@/lib/auth-session";
import { clearSession, getSession, saveSession } from "@/lib/session";

const TIKTOK_SECTION_TITLES: Record<MenuKey, string> = {
  scraper: "TikTok scraper launcher",
  search: "Search creators",
  favorites: "Favorite influencers",
  top_influencers: "Top influencers",
  top_videos: "Top videos by views",
  growth: "Top audience growth",
  ideas: "Advanced insights",
};

const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  minFollowers: 0,
  minEngagement: 0,
  verifiedOnly: false,
  updatedWithinDays: null,
  sortBy: "followers",
  order: "desc",
};

function normalizeFavoriteList(items: string[] | undefined): string[] {
  if (!items || items.length === 0) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}

export default function DashboardPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("tiktok");
  const [activeMenu, setActiveMenu] = useState<MenuKey>("search");
  const [query, setQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [growthDays, setGrowthDays] = useState(30);

  const [searchResults, setSearchResults] = useState<InfluencerSummary[]>([]);
  const [favoriteInfluencers, setFavoriteInfluencers] = useState<InfluencerSummary[]>([]);
  const [favoriteUsernames, setFavoriteUsernames] = useState<string[]>([]);
  const [topInfluencers, setTopInfluencers] = useState<InfluencerSummary[]>([]);
  const [topVideos, setTopVideos] = useState<TopVideo[]>([]);
  const [topGrowth, setTopGrowth] = useState<InfluencerGrowth[]>([]);
  const [ideas, setIdeas] = useState<OriginalIdeas | null>(null);
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedMetrics | null>(null);
  const [scrapeResult, setScrapeResult] = useState<TikTokScrapeRunResponse | null>(null);
  const [scrapeRunning, setScrapeRunning] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const favoriteLookup = useMemo(() => {
    const set = new Set<string>();
    for (const username of favoriteUsernames) {
      set.add(username.toLowerCase());
    }
    return set;
  }, [favoriteUsernames]);

  const currentTitle = useMemo(() => {
    if (activePlatform === "instagram") {
      return "Instagram analytics";
    }
    return TIKTOK_SECTION_TITLES[activeMenu];
  }, [activeMenu, activePlatform]);

  async function loadSectionData(
    menu: MenuKey,
    accessToken: string,
    options?: { q?: string; growthDays?: number; filters?: SearchFilters }
  ) {
    if (menu === "search") {
      const filters = options?.filters ?? searchFilters;
      const result = await listInfluencers(accessToken, {
        q: options?.q?.trim() || undefined,
        min_followers: filters.minFollowers || undefined,
        min_engagement: filters.minEngagement || undefined,
        verified_only: filters.verifiedOnly ? true : undefined,
        updated_within_days: filters.updatedWithinDays ?? undefined,
        sort_by: filters.sortBy,
        order: filters.order,
        limit: 40,
      });
      setSearchResults(result.items);
      return;
    }

    if (menu === "favorites") {
      const result = await getFavoriteInfluencers(accessToken);
      setFavoriteInfluencers(result.items);
      return;
    }

    if (menu === "top_influencers") {
      const result = await getTopInfluencers(accessToken, { metric: "followers", limit: 40 });
      setTopInfluencers(result.items);
      return;
    }

    if (menu === "top_videos") {
      const result = await getTopVideos(accessToken, 40);
      setTopVideos(result.items);
      return;
    }

    if (menu === "growth") {
      const result = await getTopGrowth(accessToken, options?.growthDays ?? growthDays, 40);
      setTopGrowth(result.items);
      return;
    }

    if (menu === "ideas") {
      const [ideasResult, advancedResult] = await Promise.all([
        getOriginalIdeas(accessToken),
        getAdvancedMetrics(accessToken, 10),
      ]);
      setIdeas(ideasResult);
      setAdvancedMetrics(advancedResult);
    }
  }

  function syncFavoriteSession(nextFavorites: string[]) {
    const session = getSession();
    if (!session) return;

    saveSession({
      ...session,
      user: {
        ...session.user,
        favorite_influencers: nextFavorites,
      },
    });
  }

  function isFavorite(username: string): boolean {
    return favoriteLookup.has(username.toLowerCase());
  }

  async function handleToggleFavorite(username: string) {
    if (!token || activePlatform !== "tiktok") return;

    setError(null);
    try {
      const nextUser = isFavorite(username)
        ? await removeFavoriteInfluencer(token, username)
        : await addFavoriteInfluencer(token, username);

      const nextFavorites = normalizeFavoriteList(nextUser.favorite_influencers);
      setFavoriteUsernames(nextFavorites);
      syncFavoriteSession(nextFavorites);

      if (activeMenu === "favorites") {
        const favoritesData = await getFavoriteInfluencers(token);
        setFavoriteInfluencers(favoritesData.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update favorites.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);

      try {
        const session = await ensureAuthenticatedSession();
        if (cancelled) return;

        setToken(session.accessToken);
        setUserEmail(session.user.email);

        const [overviewData, searchData, favoritesData] = await Promise.all([
          getDashboardOverview(session.accessToken),
          listInfluencers(session.accessToken, {
            limit: 40,
            sort_by: DEFAULT_SEARCH_FILTERS.sortBy,
            order: DEFAULT_SEARCH_FILTERS.order,
          }),
          getUserFavorites(session.accessToken),
        ]);

        if (cancelled) return;

        setOverview(overviewData);
        setSearchResults(searchData.items);
        const normalizedFavorites = normalizeFavoriteList(favoritesData.items);
        setFavoriteUsernames(normalizedFavorites);
        syncFavoriteSession(normalizedFavorites);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Erreur dashboard";
        setError(
          message === "NO_SESSION" || message === "SESSION_EXPIRED"
            ? "Session invalide. Reconnecte-toi."
            : message
        );
        router.replace("/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || activePlatform !== "tiktok") return;

    setActiveMenu("search");
    setSectionLoading(true);
    setError(null);
    try {
      await loadSectionData("search", token, { q: query, filters: searchFilters });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSectionLoading(false);
    }
  }

  function handleFiltersChange(next: Partial<SearchFilters>) {
    setSearchFilters((prev) => ({ ...prev, ...next }));
  }

  function handleResetFilters() {
    const nextFilters = { ...DEFAULT_SEARCH_FILTERS };
    setSearchFilters(nextFilters);

    if (!token || activePlatform !== "tiktok" || activeMenu !== "search") return;

    setSectionLoading(true);
    setError(null);
    void loadSectionData("search", token, { q: query, filters: nextFilters })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to reset filters.");
      })
      .finally(() => setSectionLoading(false));
  }

  async function handleMenuClick(menu: MenuKey) {
    setActiveMenu(menu);

    if (!token || activePlatform !== "tiktok") return;
    if (menu === "scraper") return;

    if (
      (menu === "top_influencers" && topInfluencers.length > 0) ||
      (menu === "top_videos" && topVideos.length > 0) ||
      (menu === "growth" && topGrowth.length > 0) ||
      (menu === "ideas" && ideas !== null && advancedMetrics !== null)
    ) {
      return;
    }

    setSectionLoading(true);
    setError(null);
    try {
      await loadSectionData(menu, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load section.");
    } finally {
      setSectionLoading(false);
    }
  }

  function handlePlatformSelect(platform: PlatformKey) {
    setActivePlatform(platform);
    setError(null);
  }

  async function handleGrowthDaysChange(days: number) {
    if (!token || activePlatform !== "tiktok") return;

    setGrowthDays(days);
    setActiveMenu("growth");
    setSectionLoading(true);
    setError(null);
    try {
      await loadSectionData("growth", token, { growthDays: days });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load growth data.");
    } finally {
      setSectionLoading(false);
    }
  }

  async function refreshAll() {
    if (!token || activePlatform !== "tiktok") return;

    setSectionLoading(true);
    setError(null);
    try {
      const [overviewData, favoritesData] = await Promise.all([
        getDashboardOverview(token),
        getUserFavorites(token),
        activeMenu === "scraper"
          ? Promise.resolve()
          : loadSectionData(activeMenu, token, { q: query, growthDays, filters: searchFilters }),
      ]);
      setOverview(overviewData);
      const normalizedFavorites = normalizeFavoriteList(favoritesData.items);
      setFavoriteUsernames(normalizedFavorites);
      syncFavoriteSession(normalizedFavorites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh impossible.");
    } finally {
      setSectionLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  async function resolveFreshAccessToken(): Promise<string> {
    const session = await ensureAuthenticatedSession();
    if (session.accessToken !== token) {
      setToken(session.accessToken);
    }
    if (session.user.email !== userEmail) {
      setUserEmail(session.user.email);
    }
    return session.accessToken;
  }

  async function handleRunScrape(input: { username: string; forceRefresh: boolean }) {
    setScrapeRunning(true);
    setError(null);

    try {
      const accessToken = await resolveFreshAccessToken();
      const result = await runTikTokScrape(accessToken, {
        username: input.username,
        force_refresh: input.forceRefresh,
      });
      setScrapeResult(result);

      const [overviewData, favoritesData] = await Promise.all([
        getDashboardOverview(accessToken),
        getUserFavorites(accessToken),
      ]);
      setOverview(overviewData);

      const normalizedFavorites = normalizeFavoriteList(favoritesData.items);
      setFavoriteUsernames(normalizedFavorites);
      syncFavoriteSession(normalizedFavorites);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to run scraper.";
      if (message === "NO_SESSION" || message === "SESSION_EXPIRED") {
        clearSession();
        router.replace("/login");
        throw new Error("Session invalide ou expiree. Reconnecte-toi puis relance le scraping.");
      }
      throw (err instanceof Error ? err : new Error("Unable to run scraper."));
    } finally {
      setScrapeRunning(false);
    }
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#fafafa]">
      <div className="flex h-full w-full overflow-hidden">
        <DashboardSidebar
          activeMenu={activeMenu}
          activePlatform={activePlatform}
          onMenuSelect={handleMenuClick}
          onPlatformSelect={handlePlatformSelect}
          onLogout={handleLogout}
          userEmail={userEmail}
          mobileOpen={mobileSidebarOpen}
          setMobileOpen={setMobileSidebarOpen}
        />

        <div className="h-full w-full overflow-hidden lg:p-2">
          <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white lg:rounded-md lg:border lg:border-[#e5e7eb]">
            <DashboardHeader
              sectionTitle={currentTitle}
              activePlatform={activePlatform}
              onPlatformSelect={handlePlatformSelect}
              query={query}
              onQueryChange={setQuery}
              filters={searchFilters}
              onFiltersChange={handleFiltersChange}
              onResetFilters={handleResetFilters}
              onSearch={handleSearchSubmit}
              onOpenSidebar={() => setMobileSidebarOpen(true)}
              onRefresh={refreshAll}
              loading={sectionLoading}
              showSearchFilters={activeMenu === "search"}
            />

            <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa] p-2 sm:p-4 md:p-6">
              {loading ? (
                <p className="rounded-lg border border-[#eceef2] bg-white px-4 py-3 text-sm text-slate-600">
                  Loading dashboard...
                </p>
              ) : null}

              {error ? (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-[var(--danger)]">
                  {error}
                </p>
              ) : null}

              {activePlatform === "tiktok" ? <StatsCards overview={overview} /> : null}

              <DashboardContent
                activeMenu={activeMenu}
                activePlatform={activePlatform}
                sectionTitle={currentTitle}
                loading={sectionLoading}
                searchResults={searchResults}
                favoriteInfluencers={favoriteInfluencers}
                topInfluencers={topInfluencers}
                topVideos={topVideos}
                topGrowth={topGrowth}
                growthDays={growthDays}
                onGrowthDaysChange={handleGrowthDaysChange}
                ideas={ideas}
                advancedMetrics={advancedMetrics}
                scrapeRunning={scrapeRunning}
                scrapeResult={scrapeResult}
                onRunScrape={handleRunScrape}
                isFavorite={isFavorite}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
