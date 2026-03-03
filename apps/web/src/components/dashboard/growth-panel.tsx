"use client";

import { formatNumber, formatPercent } from "@/components/dashboard/format";
import type { InfluencerGrowth } from "@/lib/api";

type GrowthPanelProps = {
  items: InfluencerGrowth[];
  days: number;
  onDaysChange: (days: number) => void;
};

const DAY_OPTIONS = [7, 30, 60, 90];

function GrowthBars({ items }: { items: InfluencerGrowth[] }) {
  const top = items.slice(0, 8);
  const maxGrowth = Math.max(...top.map((item) => item.growth_abs), 1);

  return (
    <div className="space-y-2">
      {top.map((item) => {
        const width = Math.max((item.growth_abs / maxGrowth) * 100, 3);
        return (
          <div key={`${item.username}-${item.growth_abs}`}>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>@{item.username}</span>
              <span>+{formatNumber(item.growth_abs)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#14b8a6] to-[#22c55e]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GrowthPanel({ items, days, onDaysChange }: GrowthPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {DAY_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onDaysChange(value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
              days === value
                ? "bg-slate-900 text-white"
                : "border border-[#d8dce3] bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {value}d
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-[#eceef2] bg-[#fafbff] px-4 py-3 text-sm text-slate-600">
          No growth data for the selected period.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#eceef2] bg-[#f8fafc] text-left text-[11px] uppercase tracking-wide text-slate-500 sm:text-xs">
                <th className="px-2 py-2">Username</th>
                <th className="hidden px-2 py-2 md:table-cell">Followers then</th>
                <th className="hidden px-2 py-2 md:table-cell">Followers now</th>
                <th className="px-2 py-2">Growth</th>
                <th className="px-2 py-2">Growth %</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.username}-${item.followers_now}-${item.growth_abs}`}
                  className="border-b border-[#f0f2f6] text-slate-700 hover:bg-[#fcfcfd]"
                >
                  <td className="px-2 py-2 text-xs font-semibold sm:text-sm">@{item.username}</td>
                  <td className="hidden px-2 py-2 text-xs sm:text-sm md:table-cell">{formatNumber(item.followers_then)}</td>
                  <td className="hidden px-2 py-2 text-xs sm:text-sm md:table-cell">{formatNumber(item.followers_now)}</td>
                  <td className="px-2 py-2 text-xs text-emerald-700 sm:text-sm">+{formatNumber(item.growth_abs)}</td>
                  <td className="px-2 py-2 text-xs sm:text-sm">{formatPercent(item.growth_percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="rounded-xl border border-[#eceef2] bg-[#fafbff] p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-slate-800">Growth leaderboard</h3>
            <p className="mb-3 text-xs text-slate-500">Absolute follower growth</p>
            <GrowthBars items={items} />
          </div>
        </div>
      )}
    </div>
  );
}
