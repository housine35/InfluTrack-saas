"use client";

import { Activity, Eye, Users, Video } from "lucide-react";

import { formatNumber, formatPercent } from "@/components/dashboard/format";
import type { DashboardOverview } from "@/lib/api";

type StatsCardsProps = {
  overview: DashboardOverview | null;
};

export function StatsCards({ overview }: StatsCardsProps) {
  if (!overview) return null;

  const cards = [
    {
      label: "Total influencers",
      value: formatNumber(overview.total_influencers),
      delta: "Live",
      icon: Users,
    },
    {
      label: "Total followers",
      value: formatNumber(overview.total_followers),
      delta: "Live",
      icon: Activity,
    },
    {
      label: "Total views",
      value: formatNumber(overview.total_views),
      delta: "Live",
      icon: Eye,
    },
    {
      label: "Avg engagement",
      value: formatPercent(overview.average_engagement_rate),
      delta: "Live",
      icon: Video,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[#e5e7eb] bg-white p-2.5 sm:gap-4 sm:p-4 lg:grid-cols-4 lg:gap-6 lg:p-6">
      {cards.map((card, index) => (
        <div key={card.label} className="flex items-start">
          <div className="flex-1 space-y-2 sm:space-y-4 lg:space-y-6">
            <div className="flex items-center gap-1.5 text-slate-500">
              <card.icon className="size-4 sm:size-[18px]" />
              <span className="truncate text-xs font-medium sm:text-sm">{card.label}</span>
            </div>
            <p className="text-lg font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl lg:text-[28px]">
              {card.value}
            </p>
            <div className="flex items-center gap-2 text-xs font-medium sm:text-sm">
              <span className="text-emerald-600">{card.delta}</span>
              <span className="hidden text-slate-400 sm:inline">updated now</span>
            </div>
          </div>
          {index < cards.length - 1 ? (
            <div className="mx-4 hidden h-full w-px bg-[#e5e7eb] lg:block xl:mx-6" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
