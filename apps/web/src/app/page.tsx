import Link from "next/link";
import { Activity, ArrowRight, ChartArea, Search, ShieldCheck, Sparkles } from "lucide-react";

const FEATURES = [
  {
    title: "Recherche multi-criteres",
    description: "Filtre tes influenceurs par audience, engagement, verification et activite recente.",
    icon: Search,
  },
  {
    title: "Rankings exploitables",
    description: "Identifie rapidement les meilleurs profils, videos et dynamiques de croissance.",
    icon: ChartArea,
  },
  {
    title: "Decisions plus rapides",
    description: "Passe d un username a une fiche complete avec insights actionnables.",
    icon: Activity,
  },
];

const QUICK_STATS = [
  { label: "Analyses en direct", value: "1 000+" },
  { label: "Vue detaillee", value: "Par profil" },
  { label: "Plateforme", value: "TikTok" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f7fb] p-3 md:p-6">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#dce7ff] blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-1/3 h-56 w-56 rounded-full bg-[#c7f0e6] blur-3xl" />

      <section className="relative mx-auto w-full max-w-[1380px] overflow-hidden rounded-3xl border border-[#e4e8f0] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <header className="flex items-center justify-between border-b border-[#edf0f5] px-5 py-4 md:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#334155] text-sm font-bold text-white">
              I
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">InfluTrack SaaS</span>
              <span className="block text-xs text-slate-500">Social analytics suite</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d7dde8] px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Se connecter
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Demarrer
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="grid gap-8 px-5 py-8 md:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10 lg:py-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#e5e9f1] bg-[#f8faff] px-3 py-1 text-xs font-semibold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1677ff]" />
              Plateforme pro pour agences et marques
            </p>

            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Pilote tes decisions influence avec un dashboard clair, rapide et oriente ROI.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Centralise la recherche d influenceurs, compare les performances videos et detecte les profils en acceleration en quelques clics.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Creer un compte
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#d7dde8] px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Voir le dashboard
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {QUICK_STATS.map((item) => (
                <article key={item.label} className="rounded-xl border border-[#e7ebf2] bg-[#fafbfe] p-4">
                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="rounded-xl border border-[#e7ebf2] bg-white p-4">
                  <feature.icon className="h-4 w-4 text-[#1677ff]" />
                  <p className="mt-2 text-sm font-semibold text-slate-900">{feature.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-[#e8ecf3] bg-[#f8faff] p-5 lg:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Apercu client</p>
              <Sparkles className="h-4 w-4 text-[#1677ff]" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
              <div className="rounded-xl border border-[#e3e9f5] bg-white p-3">
                <p className="text-xs text-slate-500">Top influenceur</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">@cznburak</p>
              </div>
              <div className="rounded-xl border border-[#e3e9f5] bg-white p-3">
                <p className="text-xs text-slate-500">Top video</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">7.0M vues</p>
              </div>
              <div className="rounded-xl border border-[#e3e9f5] bg-white p-3">
                <p className="text-xs text-slate-500">Croissance</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">+12.4%</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#e3e9f5] bg-white p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Creator</span>
                <span>Score</span>
              </div>

              <div className="mt-3 space-y-2">
                {[
                  { username: "@loane", score: "91 / 100", growth: "+8.2%" },
                  { username: "@sachaboz", score: "88 / 100", growth: "+6.7%" },
                  { username: "@popslay", score: "85 / 100", growth: "+5.9%" },
                ].map((item) => (
                  <article
                    key={item.username}
                    className="flex items-center justify-between rounded-lg border border-[#e7ebf3] bg-[#fbfcff] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.username}</p>
                      <p className="text-xs text-emerald-600">{item.growth}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{item.score}</p>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
