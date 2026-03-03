"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import { formatDate, formatNumber, formatPercent } from "@/components/dashboard/format";
import type { InfluencerSummary } from "@/lib/api";

type SearchPanelProps = {
  items: InfluencerSummary[];
  isFavorite: (username: string) => boolean;
  onToggleFavorite: (username: string) => void;
};

export function SearchPanel({ items, isFavorite, onToggleFavorite }: SearchPanelProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-[#eceef2] bg-[#fafbff] px-4 py-3 text-sm text-slate-600">
        No influencer found for this query.
      </p>
    );
  }

  return (
    <table className="min-w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[#eceef2] bg-[#f8fafc] text-left text-[11px] uppercase tracking-wide text-slate-500 sm:text-xs">
          <th className="px-2 py-2">Fav</th>
          <th className="px-2 py-2">Username</th>
          <th className="px-2 py-2">Followers</th>
          <th className="hidden px-2 py-2 md:table-cell">Views</th>
          <th className="hidden px-2 py-2 md:table-cell">Engagement</th>
          <th className="hidden px-2 py-2 md:table-cell">Updated</th>
          <th className="px-2 py-2">Action</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const favorite = isFavorite(item.username);
          return (
            <tr key={item.id || item.username} className="border-b border-[#f0f2f6] text-slate-700 hover:bg-[#fcfcfd]">
              <td className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(item.username)}
                  className={`rounded-md border p-1.5 transition ${
                    favorite
                      ? "border-amber-300 bg-amber-50 text-amber-600"
                      : "border-[#d8dce3] bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                  aria-label={favorite ? `Remove @${item.username} from favorites` : `Add @${item.username} to favorites`}
                >
                  <Star className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${favorite ? "fill-current" : ""}`} />
                </button>
              </td>
              <td className="px-2 py-2 text-xs font-semibold sm:text-sm">@{item.username}</td>
              <td className="px-2 py-2 text-xs sm:text-sm">{formatNumber(item.followers)}</td>
              <td className="hidden px-2 py-2 text-xs sm:text-sm md:table-cell">{formatNumber(item.total_views)}</td>
              <td className="hidden px-2 py-2 text-xs sm:text-sm md:table-cell">{formatPercent(item.engagement_rate)}</td>
              <td className="hidden px-2 py-2 text-xs sm:text-sm md:table-cell">{formatDate(item.fetched_at)}</td>
              <td className="px-2 py-2">
                <Link
                  href={`/influencers/${encodeURIComponent(item.username)}`}
                  className="text-xs font-semibold text-[#5b35d5] hover:underline sm:text-sm"
                >
                  Open
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
