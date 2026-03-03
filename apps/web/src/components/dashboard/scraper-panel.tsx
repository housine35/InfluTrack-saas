"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";

import { formatDate, formatNumber } from "@/components/dashboard/format";
import type { TikTokScrapeRunResponse } from "@/lib/api";

type ScraperPanelProps = {
  running: boolean;
  lastResult: TikTokScrapeRunResponse | null;
  onRunScrape: (input: { username: string; forceRefresh: boolean }) => Promise<void>;
};

type ScrapeProgressStage = "idle" | "starting" | "collecting" | "processing" | "saving" | "done" | "error";

function resolveStageFromElapsedMs(elapsedMs: number): ScrapeProgressStage {
  if (elapsedMs < 3_000) return "starting";
  if (elapsedMs < 12_000) return "collecting";
  if (elapsedMs < 22_000) return "processing";
  return "saving";
}

function resolveStageCap(stage: ScrapeProgressStage): number {
  if (stage === "starting") return 20;
  if (stage === "collecting") return 58;
  if (stage === "processing") return 82;
  if (stage === "saving") return 94;
  if (stage === "done" || stage === "error") return 100;
  return 0;
}

function getStageLabel(stage: ScrapeProgressStage): string {
  if (stage === "starting") return "Initialisation";
  if (stage === "collecting") return "Collecte TikTok";
  if (stage === "processing") return "Traitement";
  if (stage === "saving") return "Sauvegarde";
  if (stage === "done") return "Termine";
  if (stage === "error") return "Echec";
  return "Pret";
}

function getStageDescription(stage: ScrapeProgressStage): string {
  if (stage === "starting") return "Connexion au scraper et preparation des parametres...";
  if (stage === "collecting") return "Recuperation des videos et statistiques du profil...";
  if (stage === "processing") return "Normalisation des donnees et calcul des metriques...";
  if (stage === "saving") return "Insertion MongoDB et rafraichissement des insights...";
  if (stage === "done") return "Scraping termine, donnees mises a jour.";
  if (stage === "error") return "Le scraping a echoue. Corrige puis relance.";
  return "Pret a lancer un scraping.";
}

function getProgressBarClasses(stage: ScrapeProgressStage): string {
  if (stage === "error") return "bg-gradient-to-r from-rose-500 to-red-600";
  if (stage === "done") return "bg-gradient-to-r from-emerald-500 to-green-600";
  return "bg-gradient-to-r from-indigo-500 to-violet-500";
}

export function ScraperPanel({ running, lastResult, onRunScrape }: ScraperPanelProps) {
  const [username, setUsername] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState<ScrapeProgressStage>("idle");
  const [showProgress, setShowProgress] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanedUsername = useMemo(() => username.trim().replace(/^@+/, ""), [username]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const startedAt = Date.now();
    intervalRef.current = setInterval(() => {
      const stage = resolveStageFromElapsedMs(Date.now() - startedAt);
      const cap = resolveStageCap(stage);

      setProgressStage(stage);
      setProgressPercent((current) => {
        if (current >= cap) return current;
        const delta = Math.max(1, Math.round((cap - current) * 0.15));
        return Math.min(cap, current + delta);
      });
    }, 350);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!cleanedUsername) {
      setError("Username is required.");
      return;
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    setShowProgress(true);
    setProgressStage("starting");
    setProgressPercent(8);

    try {
      await onRunScrape({ username: cleanedUsername, forceRefresh });
      setUsername(cleanedUsername);
      setProgressStage("done");
      setProgressPercent(100);

      hideTimerRef.current = setTimeout(() => {
        setShowProgress(false);
        setProgressStage("idle");
        setProgressPercent(0);
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run scraper.");
      setProgressStage("error");
      setProgressPercent(100);
      setShowProgress(true);
    }
  }

  const progressLabel = getStageLabel(progressStage);
  const progressDescription = getStageDescription(progressStage);
  const stepOrder: ScrapeProgressStage[] = ["starting", "collecting", "processing", "saving"];
  const currentStepIndex = stepOrder.indexOf(
    progressStage === "done" || progressStage === "error" ? "saving" : progressStage
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e6e9f0] bg-[#f8faff] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">TikTok scraper runner</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">Launch scraping from the SaaS platform</h3>
        <p className="mt-1 text-sm text-slate-600">
          Enter a TikTok username to trigger scraping, save data into MongoDB, and refresh analytics in one flow.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <label htmlFor="scrape-username" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              TikTok username
            </label>
            <input
              id="scrape-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@username"
              disabled={running}
              className="h-10 w-full rounded-lg border border-[#d8dce3] bg-white px-3 text-sm text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#b8bfcf] focus:ring-[#eceef8] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(event) => setForceRefresh(event.target.checked)}
                disabled={running}
                className="h-4 w-4 rounded border-[#cfd5e3]"
              />
              Force refresh mode
            </label>
          </div>

          <button
            type="submit"
            disabled={running}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 md:self-end"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Scraping..." : "Run scraper"}
          </button>
        </form>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="mt-3 rounded-lg border border-[#e1e6f0] bg-white px-3 py-2 text-xs text-slate-600">
          <p className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-[#5b35d5]" />
            Endpoint protected by JWT. Only authenticated users can launch scraping.
          </p>
        </div>

        {showProgress ? (
          <div className="mt-4 rounded-xl border border-[#dde3ef] bg-white/95 p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scraping progress</p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  progressStage === "error"
                    ? "bg-red-100 text-red-700"
                    : progressStage === "done"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-violet-100 text-violet-700"
                }`}
              >
                {progressLabel}
              </span>
            </div>

            <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
              <span>{progressDescription}</span>
              <span className="font-semibold text-slate-800">{progressPercent}%</span>
            </div>

            <div
              className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label="Scraping progress"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${getProgressBarClasses(progressStage)} ${
                  running ? "animate-pulse" : ""
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {stepOrder.map((step, index) => {
                const reached = currentStepIndex >= index;
                const isCurrent = progressStage === step;

                return (
                  <div
                    key={step}
                    className={`rounded-md border px-2 py-1 text-center text-[11px] font-medium ${
                      isCurrent
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : reached
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {getStageLabel(step)}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {lastResult ? (
        <div className="rounded-xl border border-[#e6e9f0] bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last run</p>
              <h4 className="text-base font-semibold text-slate-900">@{lastResult.username}</h4>
              <p className="text-sm text-slate-600">{lastResult.message}</p>
            </div>
            <Link
              href={`/influencers/${encodeURIComponent(lastResult.username)}`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d8dce3] bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open profile
            </Link>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[#e9edf4] bg-[#fafbff] p-3">
              <p className="text-xs text-slate-500">Videos collected</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(lastResult.item_count)}</p>
            </div>
            <div className="rounded-lg border border-[#e9edf4] bg-[#fafbff] p-3">
              <p className="text-xs text-slate-500">New items</p>
              <p className="mt-1 text-lg font-semibold text-emerald-600">{formatNumber(lastResult.new_items)}</p>
            </div>
            <div className="rounded-lg border border-[#e9edf4] bg-[#fafbff] p-3">
              <p className="text-xs text-slate-500">Updated items</p>
              <p className="mt-1 text-lg font-semibold text-[#5b35d5]">{formatNumber(lastResult.updated_items)}</p>
            </div>
            <div className="rounded-lg border border-[#e9edf4] bg-[#fafbff] p-3">
              <p className="text-xs text-slate-500">Duration</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatNumber(Math.round(lastResult.duration_ms / 1000))}s
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e4e8f0] bg-[#f8faff] px-2.5 py-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Batches: {formatNumber(lastResult.batch_count)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e4e8f0] bg-[#f8faff] px-2.5 py-1">
              Total stored: {formatNumber(lastResult.total_items)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e4e8f0] bg-[#f8faff] px-2.5 py-1">
              Updated at: {formatDate(lastResult.fetched_at)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
