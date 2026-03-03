"use client";

import type { ComponentType, Dispatch, SetStateAction } from "react";
import {
  Bot,
  ChevronRight,
  Clapperboard,
  Crown,
  Instagram,
  LogOut,
  PlaySquare,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  X,
} from "lucide-react";

import type { MenuKey, PlatformKey } from "@/components/dashboard/types";

const MENU_ITEMS: Array<{
  key: MenuKey;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "scraper", label: "Scraper", hint: "Launch TikTok scrape", icon: Bot },
  { key: "search", label: "Search", hint: "Find creators", icon: Search },
  {
    key: "favorites",
    label: "Favorites",
    hint: "Your saved creators",
    icon: Star,
  },
  {
    key: "top_influencers",
    label: "Top Influencers",
    hint: "Followers leaderboard",
    icon: Crown,
  },
  {
    key: "top_videos",
    label: "Top Videos",
    hint: "Most viewed videos",
    icon: PlaySquare,
  },
  {
    key: "growth",
    label: "Top Growth",
    hint: "Audience growth 30d",
    icon: TrendingUp,
  },
  {
    key: "ideas",
    label: "Original Ideas",
    hint: "12 strategic metrics",
    icon: Sparkles,
  },
];

type DashboardSidebarProps = {
  activeMenu: MenuKey;
  activePlatform: PlatformKey;
  onMenuSelect: (menu: MenuKey) => void;
  onPlatformSelect: (platform: PlatformKey) => void;
  onLogout: () => void;
  userEmail: string;
  mobileOpen: boolean;
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
};

export function DashboardSidebar({
  activeMenu,
  activePlatform,
  onMenuSelect,
  onPlatformSelect,
  onLogout,
  userEmail,
  mobileOpen,
  setMobileOpen,
}: DashboardSidebarProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[#eceef2] bg-white shadow-lg transition-transform sm:w-[290px] lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 pb-3 sm:p-5 sm:pb-4 lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-[#6e3ff3] to-[#aa8ef9] text-sm font-bold text-white">
              I
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">InfluTrack</p>
              <p className="text-xs text-slate-500">Social Analytics SaaS</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pb-3 sm:px-5 sm:pb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Platform</p>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#e5e7eb] bg-white p-2">
            <button
              type="button"
              onClick={() => onPlatformSelect("tiktok")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition ${
                activePlatform === "tiktok"
                  ? "border-[#5b35d5] bg-[#f3f0fe] text-[#5b35d5]"
                  : "border-[#d8dce3] bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Clapperboard className="h-3.5 w-3.5" />
              TikTok
            </button>
            <button
              type="button"
              onClick={() => onPlatformSelect("instagram")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition ${
                activePlatform === "instagram"
                  ? "border-[#5b35d5] bg-[#f3f0fe] text-[#5b35d5]"
                  : "border-[#d8dce3] bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Instagram className="h-3.5 w-3.5" />
              Instagram
            </button>
          </div>
        </div>

        <div className="px-4 pb-3 sm:px-5 sm:pb-4">
          <div className="rounded-lg border border-[#eceef2] bg-[#fafbff] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Workspace
            </p>
            {activePlatform === "tiktok" ? (
              <>
                <p className="mt-1 text-sm font-semibold text-slate-900">TikTok Analytics</p>
                <p className="text-xs text-slate-500">Live creator insights and rankings</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm font-semibold text-slate-900">Instagram Analytics</p>
                <p className="text-xs text-slate-500">In progress</p>
              </>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-3 pb-3 sm:px-4 sm:pb-4">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Menu
          </p>
          <div className="space-y-1.5">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeMenu === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onMenuSelect(item.key);
                    setMobileOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${
                    active
                      ? "bg-[#f3f0fe] text-[#5b35d5]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <p className="text-sm font-semibold">{item.label}</p>
                    {active ? <ChevronRight className="ml-auto h-4 w-4 text-slate-400" /> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#eceef2] p-3 sm:p-4">
          <p className="mb-3 truncate text-xs text-slate-500">{userEmail || "-"}</p>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#d6d9df] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
