"use client";

import type { ReactNode } from "react";

import { FavoritesPanel } from "@/components/dashboard/favorites-panel";
import { GrowthPanel } from "@/components/dashboard/growth-panel";
import { IdeasPanel } from "@/components/dashboard/ideas-panel";
import { ScraperPanel } from "@/components/dashboard/scraper-panel";
import { SearchPanel } from "@/components/dashboard/search-panel";
import { TopInfluencersPanel } from "@/components/dashboard/top-influencers-panel";
import { TopVideosPanel } from "@/components/dashboard/top-videos-panel";
import type { MenuKey, PlatformKey } from "@/components/dashboard/types";
import type {
  AdvancedMetrics,
  InfluencerGrowth,
  InfluencerSummary,
  OriginalIdeas,
  TikTokScrapeRunResponse,
  TopVideo,
} from "@/lib/api";

type DashboardContentProps = {
  activeMenu: MenuKey;
  activePlatform: PlatformKey;
  sectionTitle: string;
  loading: boolean;
  searchResults: InfluencerSummary[];
  favoriteInfluencers: InfluencerSummary[];
  topInfluencers: InfluencerSummary[];
  topVideos: TopVideo[];
  topGrowth: InfluencerGrowth[];
  growthDays: number;
  onGrowthDaysChange: (days: number) => void;
  ideas: OriginalIdeas | null;
  advancedMetrics: AdvancedMetrics | null;
  scrapeRunning: boolean;
  scrapeResult: TikTokScrapeRunResponse | null;
  onRunScrape: (input: { username: string; forceRefresh: boolean }) => Promise<void>;
  isFavorite: (username: string) => boolean;
  onToggleFavorite: (username: string) => void;
};

function SectionShell({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white sm:mt-6">
      <div className="border-b border-[#eceef2] px-3 py-2.5 sm:px-6 sm:py-3.5">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="overflow-x-auto p-2.5 sm:p-4">
        {loading ? <p className="mb-4 text-sm text-slate-500">Loading section...</p> : null}
        {children}
      </div>
    </div>
  );
}

function InstagramComingSoon() {
  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Instagram</p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">Module en cours de developpement</h3>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Le connecteur Instagram est en preparation. Cette section affichera bientot la recherche d&apos;influenceurs,
        les tops videos/reels, la croissance d&apos;audience et des recommandations avancees.
      </p>
    </div>
  );
}

export function DashboardContent({
  activeMenu,
  activePlatform,
  sectionTitle,
  loading,
  searchResults,
  favoriteInfluencers,
  topInfluencers,
  topVideos,
  topGrowth,
  growthDays,
  onGrowthDaysChange,
  ideas,
  advancedMetrics,
  scrapeRunning,
  scrapeResult,
  onRunScrape,
  isFavorite,
  onToggleFavorite,
}: DashboardContentProps) {
  if (activePlatform === "instagram") {
    return (
      <SectionShell title={sectionTitle} loading={false}>
        <InstagramComingSoon />
      </SectionShell>
    );
  }

  return (
    <SectionShell title={sectionTitle} loading={loading}>
      {activeMenu === "search" ? (
        <SearchPanel
          items={searchResults}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      ) : null}
      {activeMenu === "favorites" ? (
        <FavoritesPanel items={favoriteInfluencers} onToggleFavorite={onToggleFavorite} />
      ) : null}
      {activeMenu === "top_influencers" ? (
        <TopInfluencersPanel
          items={topInfluencers}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      ) : null}
      {activeMenu === "top_videos" ? <TopVideosPanel items={topVideos} /> : null}
      {activeMenu === "growth" ? (
        <GrowthPanel items={topGrowth} days={growthDays} onDaysChange={onGrowthDaysChange} />
      ) : null}
      {activeMenu === "scraper" ? (
        <ScraperPanel
          running={scrapeRunning}
          lastResult={scrapeResult}
          onRunScrape={onRunScrape}
        />
      ) : null}
      {activeMenu === "ideas" ? <IdeasPanel ideas={ideas} advancedMetrics={advancedMetrics} /> : null}
    </SectionShell>
  );
}

