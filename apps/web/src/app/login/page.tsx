"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, TriangleAlert } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { loginUser } from "@/lib/api";
import { saveSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const auth = await loginUser({ email, password });
      saveSession({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        user: auth.user,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge="Connexion"
      title="Accede a ton espace client"
      subtitle="Connecte-toi pour piloter les recherches influenceurs et les insights de performance."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/register" className="font-semibold text-[#1556b6] hover:underline">
            Inscription
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 rounded-2xl border border-[#e5e9f1] bg-white p-5 shadow-[0_10px_25px_rgba(15,23,42,0.05)] sm:p-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d8deea] bg-white pl-10 pr-3 text-sm text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#abc6f8] focus:ring-[#eaf1ff]"
                placeholder="toi@entreprise.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d8deea] bg-white pl-10 pr-11 text-sm text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#abc6f8] focus:ring-[#eaf1ff]"
                placeholder="Minimum 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link href="/forgot-password" className="text-xs font-semibold text-[#1556b6] hover:underline">
                Mot de passe oublie ?
              </Link>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-[var(--danger)]">
              <p className="inline-flex items-center gap-2">
                <TriangleAlert className="h-4 w-4" />
                {error}
              </p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Connexion..." : "Se connecter"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          <div className="rounded-xl border border-[#e6eaf2] bg-[#f8faff] px-3 py-2 text-xs text-slate-600">
            <p className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1677ff]" />
              Connexion securisee pour proteger les acces clients.
            </p>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
