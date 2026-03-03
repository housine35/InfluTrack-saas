"use client";

import { formatDate, formatNumber, formatPercent } from "@/components/dashboard/format";
import type { TopVideo } from "@/lib/api";

type TopVideosPanelProps = {
  items: TopVideo[];
};

export function TopVideosPanel({ items }: TopVideosPanelProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-[#eceef2] bg-[#fafbff] px-4 py-3 text-sm text-slate-600">
        No video ranking data available.
      </p>
    );
  }

  return (
    <table className="min-w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[#eceef2] bg-[#f8fafc] text-left text-[11px] uppercase tracking-wide text-slate-500 sm:text-xs">
          <th className="px-2 py-2">Influencer</th>
          <th className="px-2 py-2">Video ID</th>
          <th className="px-2 py-2">Views</th>
          <th className="hidden px-2 py-2 md:table-cell">Likes</th>
          <th className="hidden px-2 py-2 lg:table-cell">Comments</th>
          <th className="hidden px-2 py-2 lg:table-cell">Shares</th>
          <th className="px-2 py-2">Engagement</th>
          <th className="hidden px-2 py-2 md:table-cell">Date</th>
        </tr>
      </thead>
      <tbody>
        {items.map((video) => (
          <tr
            key={`${video.influencer_username}-${video.video_id}`}
            className="border-b border-[#f0f2f6] text-slate-700 hover:bg-[#fcfcfd]"
          >
            <td className="px-2 py-2 text-xs font-semibold sm:text-sm">@{video.influencer_username}</td>
            <td className="max-w-[140px] truncate px-2 py-2 text-xs sm:text-sm">{video.video_id}</td>
            <td className="px-2 py-2 text-xs sm:text-sm">{formatNumber(video.views)}</td>
            <td className="hidden px-2 py-2 text-xs sm:text-sm md:table-cell">{formatNumber(video.likes)}</td>
            <td className="hidden px-2 py-2 text-xs sm:text-sm lg:table-cell">{formatNumber(video.comments)}</td>
            <td className="hidden px-2 py-2 text-xs sm:text-sm lg:table-cell">{formatNumber(video.shares)}</td>
            <td className="px-2 py-2 text-xs sm:text-sm">{formatPercent(video.engagement_rate)}</td>
            <td className="hidden px-2 py-2 text-xs sm:text-sm md:table-cell">{formatDate(video.create_time)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
