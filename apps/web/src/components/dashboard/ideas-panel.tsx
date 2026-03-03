"use client";

import { formatNumber, formatPercent } from "@/components/dashboard/format";
import type {
  AdvancedMetrics,
  AdvancedMetricsLeaders,
  InfluencerAdvancedMetrics,
  OriginalIdeas,
} from "@/lib/api";

type IdeasPanelProps = {
  ideas: OriginalIdeas | null;
  advancedMetrics: AdvancedMetrics | null;
};

type MetricCardConfig = {
  key: keyof AdvancedMetricsLeaders;
  title: string;
  hint: string;
  format: (value: number) => string;
  danger?: boolean;
};

const METRIC_CARDS: MetricCardConfig[] = [
  {
    key: "growth_velocity_7d",
    title: "Growth velocity 7d",
    hint: "Followers gained per day (7d)",
    format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}/day`,
  },
  {
    key: "growth_velocity_30d",
    title: "Growth velocity 30d",
    hint: "Followers gained per day (30d)",
    format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}/day`,
  },
  {
    key: "growth_acceleration",
    title: "Growth acceleration",
    hint: "7d velocity minus 30d velocity",
    format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`,
  },
  {
    key: "reach_efficiency",
    title: "Reach efficiency",
    hint: "Avg views 30d / followers",
    format: (value) => `${value.toFixed(3)}x`,
  },
  {
    key: "engagement_quality_score",
    title: "Engagement quality",
    hint: "Weighted engagement per view",
    format: (value) => `${value.toFixed(2)} pts`,
  },
  {
    key: "consistency_score",
    title: "Consistency score",
    hint: "Posting frequency + regularity",
    format: (value) => `${value.toFixed(1)}/100`,
  },
  {
    key: "viral_hit_rate",
    title: "Viral hit rate",
    hint: "Share of videos above viral threshold",
    format: (value) => `${value.toFixed(1)}%`,
  },
  {
    key: "fresh_content_power",
    title: "Fresh content power",
    hint: "Views/day on recent videos (7d)",
    format: (value) => `${Math.round(value).toLocaleString("fr-FR")} v/day`,
  },
  {
    key: "evergreen_index",
    title: "Evergreen index",
    hint: "Old videos still performing",
    format: (value) => `${value.toFixed(1)}%`,
  },
  {
    key: "audience_conversion_proxy",
    title: "Audience conversion",
    hint: "Followers gain per 1k engagements",
    format: (value) => `${value.toFixed(3)}`,
  },
  {
    key: "stability_risk_score",
    title: "Stability risk",
    hint: "Volatility and suspicious growth",
    format: (value) => `${value.toFixed(1)}/100`,
    danger: true,
  },
  {
    key: "brandability_score",
    title: "Brandability score",
    hint: "Campaign readiness composite",
    format: (value) => `${value.toFixed(1)}/100`,
  },
  {
    key: "breakout_score",
    title: "Breakout score",
    hint: "Potential to explode soon",
    format: (value) => `${value.toFixed(1)}/100`,
  },
];

function metricValue(item: InfluencerAdvancedMetrics, key: keyof AdvancedMetricsLeaders): number {
  return item[key] as number;
}

export function IdeasPanel({ ideas, advancedMetrics }: IdeasPanelProps) {
  const rising = ideas?.rising_stars ?? [];
  const undervalued = ideas?.undervalued_creators ?? [];
  const leaders = advancedMetrics?.leaders ?? null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-[#eceef2] bg-[#fafbff] p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-slate-800">Rising stars</h3>
          <p className="mt-1 text-xs text-slate-500">
            Mid-size creators with strong engagement and view depth.
          </p>
          <div className="mt-3 space-y-2">
            {rising.slice(0, 12).map((item) => (
              <div
                key={item.id || item.username}
                className="rounded-md border border-[#eceef2] bg-white px-2.5 py-2 text-sm text-slate-700 sm:px-3"
              >
                <p className="font-semibold">@{item.username}</p>
                <p className="text-xs text-slate-500">
                  {formatPercent(item.engagement_rate)} | {formatNumber(item.followers)} followers
                </p>
              </div>
            ))}
            {rising.length === 0 ? (
              <p className="text-sm text-slate-500">No rising stars detected.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-lg border border-[#eceef2] bg-[#fafbff] p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-slate-800">Undervalued creators</h3>
          <p className="mt-1 text-xs text-slate-500">
            Low follower profiles with high average video performance.
          </p>
          <div className="mt-3 space-y-2">
            {undervalued.slice(0, 12).map((item) => (
              <div
                key={item.id || item.username}
                className="rounded-md border border-[#eceef2] bg-white px-2.5 py-2 text-sm text-slate-700 sm:px-3"
              >
                <p className="font-semibold">@{item.username}</p>
                <p className="text-xs text-slate-500">
                  {formatPercent(item.engagement_rate)} | {formatNumber(item.average_views)} avg views
                </p>
              </div>
            ))}
            {undervalued.length === 0 ? (
              <p className="text-sm text-slate-500">No undervalued creators detected.</p>
            ) : null}
          </div>
        </article>
      </div>

      <article className="rounded-lg border border-[#eceef2] bg-[#fafbff] p-3 sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Advanced TikTok metrics</h3>
            <p className="mt-1 text-xs text-slate-500">
              12 strategic indicators built from followers, history and video performance.
            </p>
          </div>
          <span className="rounded-full border border-[#d8dce3] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {advancedMetrics?.generated_at ? "Updated" : "No data"}
          </span>
        </div>

        {!leaders ? (
          <p className="mt-3 text-sm text-slate-500">Advanced metrics unavailable.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {METRIC_CARDS.map((card) => {
              const topItems = leaders[card.key]?.slice(0, 5) ?? [];
              return (
                <div key={card.key} className="rounded-md border border-[#e5e8ef] bg-white p-3">
                  <h4 className="text-sm font-semibold text-slate-800">{card.title}</h4>
                  <p className="mt-0.5 text-[11px] text-slate-500">{card.hint}</p>

                  <div className="mt-2.5 space-y-1.5">
                    {topItems.length === 0 ? (
                      <p className="text-xs text-slate-500">No ranking data.</p>
                    ) : (
                      topItems.map((item, index) => (
                        <div key={`${card.key}-${item.username}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-semibold text-slate-700">
                            {index + 1}. @{item.username}
                          </span>
                          <span className={`shrink-0 font-semibold ${card.danger ? "text-rose-700" : "text-[#5b35d5]"}`}>
                            {card.format(metricValue(item, card.key))}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </div>
  );
}
