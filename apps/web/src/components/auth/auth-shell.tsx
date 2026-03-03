"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, ChartArea, ShieldCheck, Sparkles } from "lucide-react";

type AuthShellProps = {
  badge: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

const FEATURE_ITEMS = [
  {
    title: "Recherche instantanee",
    description: "Trouve rapidement un profil, trie les resultats et ouvre une fiche detaillee en un clic.",
    icon: ChartArea,
  },
  {
    title: "Acces securise",
    description: "Authentification robuste, sessions protegees et gestion client fiable.",
    icon: ShieldCheck,
  },
  {
    title: "Insights operationnels",
    description: "Visualise top videos, dynamique audience et signaux de progression exploitables.",
    icon: Activity,
  },
];

export function AuthShell({
  badge,
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f7fb] p-3 md:p-6">
      <div className="pointer-events-none absolute -left-16 top-8 h-72 w-72 rounded-full bg-[#dbe9ff] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#c8efe2] blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1360px] overflow-hidden rounded-3xl border border-[#e4e8f0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden overflow-hidden border-r border-[#1f2937] bg-slate-900 p-8 text-slate-100 lg:flex lg:flex-col">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#1d4ed8]/30 blur-2xl" />
          <div className="absolute -bottom-16 left-8 h-56 w-56 rounded-full bg-[#0ea5e9]/25 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white">
              I
            </div>
            <div>
              <p className="text-base font-semibold">InfluTrack SaaS</p>
              <p className="text-xs text-slate-300">Plateforme social analytics</p>
            </div>
          </div>

          <div className="relative mt-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
              <Sparkles className="h-3.5 w-3.5" />
              TikTok aujourd hui, Instagram ensuite
            </p>
            <h2 className="mt-5 text-3xl font-semibold leading-tight">
              Un acces client professionnel pour analyser les influenceurs plus vite.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Connecte-toi a un espace de travail clair, rapide et pense pour les equipes marketing et agences.
            </p>
          </div>

          <div className="relative mt-8 space-y-3">
            {FEATURE_ITEMS.map((item) => (
              <article key={item.title} className="rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-blue-200" />
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">{item.description}</p>
              </article>
            ))}
          </div>
        </aside>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[470px]">
            <div className="rounded-xl border border-[#e5e9f1] bg-[#f8faff] p-4 lg:hidden">
              <p className="text-sm font-semibold text-slate-900">InfluTrack SaaS</p>
              <p className="mt-1 text-xs text-slate-600">Experience d authentification optimisee pour tes clients.</p>
            </div>

            <Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 lg:mt-0">
              <span className="h-2 w-2 rounded-full bg-[#1677ff]" />
              Retour a l accueil
            </Link>

            <p className="mt-6 inline-flex rounded-full border border-[#dce4f3] bg-[#f3f7ff] px-3 py-1 text-xs font-semibold text-[#1556b6]">
              {badge}
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-900">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>

            <div className="mt-8">{children}</div>
            <div className="mt-6 text-sm text-slate-600">{footer}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
