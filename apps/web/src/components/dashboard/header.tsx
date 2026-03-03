"use client";

import type { FormEvent } from "react";
import { Clapperboard, Instagram, Menu, RefreshCw, Search } from "lucide-react";

import type { PlatformKey, SearchFilters } from "@/components/dashboard/types";

type DashboardHeaderProps = {
  sectionTitle: string;
  activePlatform: PlatformKey;
  onPlatformSelect: (platform: PlatformKey) => void;
  query: string;
  onQueryChange: (value: string) => void;
  filters: SearchFilters;
  onFiltersChange: (next: Partial<SearchFilters>) => void;
  onResetFilters: () => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onOpenSidebar: () => void;
  onRefresh: () => void;
  loading: boolean;
  showSearchFilters: boolean;
};

function parsePositiveNumber(value: string, max?: number, integer = false): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const normalized = max ? Math.min(max, parsed) : parsed;
  return integer ? Math.floor(normalized) : normalized;
}

export function DashboardHeader({
  sectionTitle,
  activePlatform,
  onPlatformSelect,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  onResetFilters,
  onSearch,
  onOpenSidebar,
  onRefresh,
  loading,
  showSearchFilters,
}: DashboardHeaderProps) {
  const instagramMode = activePlatform === "instagram";

  return (
    <header className="sticky top-0 z-10 border-b border-[#eceef2] bg-white px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-[#dfe3eb] p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
              onClick={onOpenSidebar}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Dashboard
              </p>
              <h1 className="text-sm font-medium text-slate-900 sm:text-lg">{sectionTitle}</h1>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-auto">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-[#d8dce3] bg-white p-1">
                <button
                  type="button"
                  onClick={() => onPlatformSelect("tiktok")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                    activePlatform === "tiktok"
                      ? "bg-[#f3f0fe] text-[#5b35d5]"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Clapperboard className="h-3.5 w-3.5" />
                  TikTok
                </button>
                <button
                  type="button"
                  onClick={() => onPlatformSelect("instagram")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                    activePlatform === "instagram"
                      ? "bg-[#f3f0fe] text-[#5b35d5]"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Instagram className="h-3.5 w-3.5" />
                  Instagram
                </button>
              </div>

              {instagramMode ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  En cours de developpement
                </span>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <form
                onSubmit={onSearch}
                className="flex w-full items-center gap-2 sm:flex-1 lg:w-[460px]"
              >
                <div className="relative min-w-0 flex-1 md:w-[220px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder={
                      instagramMode
                        ? "Instagram module coming soon"
                        : "Search by username or nickname"
                    }
                    disabled={instagramMode}
                    className="h-9 w-full rounded-lg border border-[#d8dce3] bg-white px-9 pr-10 text-sm text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#b8bfcf] focus:ring-[#eceef8] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:pr-14"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded bg-[#f1f2f5] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 md:inline-flex">
                    Ctrl K
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={loading || instagramMode}
                  className="h-9 rounded-lg border border-[#d8dce3] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
                >
                  Search
                </button>
              </form>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading || instagramMode}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {!instagramMode && showSearchFilters ? (
          <div className="grid gap-2 rounded-xl border border-[#eceef2] bg-[#fafbff] p-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Min followers
              <input
                type="number"
                min={0}
                value={filters.minFollowers === 0 ? "" : filters.minFollowers}
                onChange={(event) =>
                  onFiltersChange({
                    minFollowers: parsePositiveNumber(event.target.value, undefined, true),
                  })
                }
                placeholder="Any"
                className="h-9 rounded-lg border border-[#d8dce3] bg-white px-2.5 text-sm font-medium text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#b8bfcf] focus:ring-[#eceef8]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Min engagement %
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={filters.minEngagement === 0 ? "" : filters.minEngagement}
                onChange={(event) =>
                  onFiltersChange({
                    minEngagement: parsePositiveNumber(event.target.value, 100, false),
                  })
                }
                placeholder="Any"
                className="h-9 rounded-lg border border-[#d8dce3] bg-white px-2.5 text-sm font-medium text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#b8bfcf] focus:ring-[#eceef8]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Verified
              <select
                value={filters.verifiedOnly ? "yes" : "any"}
                onChange={(event) => onFiltersChange({ verifiedOnly: event.target.value === "yes" })}
                className="h-9 rounded-lg border border-[#d8dce3] bg-white px-2.5 text-sm font-medium text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#b8bfcf] focus:ring-[#eceef8]"
              >
                <option value="any">Any account</option>
                <option value="yes">Verified only</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Updated
              <select
                value={filters.updatedWithinDays === null ? "any" : String(filters.updatedWithinDays)}
                onChange={(event) =>
                  onFiltersChange({
                    updatedWithinDays:
                      event.target.value === "any" ? null : Number(event.target.value),
                  })
                }
                className="h-9 rounded-lg border border-[#d8dce3] bg-white px-2.5 text-sm font-medium text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#b8bfcf] focus:ring-[#eceef8]"
              >
                <option value="any">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Sort by
              <select
                value={filters.sortBy}
                onChange={(event) =>
                  onFiltersChange({
                    sortBy: event.target.value as SearchFilters["sortBy"],
                  })
                }
                className="h-9 rounded-lg border border-[#d8dce3] bg-white px-2.5 text-sm font-medium text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#b8bfcf] focus:ring-[#eceef8]"
              >
                <option value="followers">Followers</option>
                <option value="views">Views</option>
                <option value="engagement">Engagement</option>
                <option value="fetched">Last update</option>
              </select>
            </label>

            <div className="flex items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
                Order
                <select
                  value={filters.order}
                  onChange={(event) =>
                    onFiltersChange({
                      order: event.target.value as SearchFilters["order"],
                    })
                  }
                  className="h-9 rounded-lg border border-[#d8dce3] bg-white px-2.5 text-sm font-medium text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#b8bfcf] focus:ring-[#eceef8]"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
              <button
                type="button"
                onClick={onResetFilters}
                className="h-9 rounded-lg border border-[#d8dce3] bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
