"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck, TriangleAlert } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialToken = params.get("token");
    if (initialToken) {
      setToken(initialToken);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token.trim()) {
      setError("Le token de reinitialisation est requis.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword({
        token: token.trim(),
        new_password: password,
      });
      setSuccessMessage(response.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de reinitialiser le mot de passe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge="Reset"
      title="Definir un nouveau mot de passe"
      subtitle="Utilise ton token de reinitialisation et choisis un mot de passe fort."
      footer={
        <>
          Retour a la{" "}
          <Link href="/login" className="font-semibold text-[#1556b6] hover:underline">
            connexion
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 rounded-2xl border border-[#e5e9f1] bg-white p-5 shadow-[0_10px_25px_rgba(15,23,42,0.05)] sm:p-6">
          <div>
            <label htmlFor="token" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Token de reset
            </label>
            <input
              id="token"
              type="text"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#d8deea] bg-white px-3 text-sm text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#abc6f8] focus:ring-[#eaf1ff]"
              placeholder="Colle ton token ici"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d8deea] bg-white pl-10 pr-11 text-sm text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#abc6f8] focus:ring-[#eaf1ff]"
                placeholder="Retape ton mot de passe"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100"
                aria-label={showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
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

          {successMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <p className="inline-flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {successMessage}
              </p>
              <Link href="/login" className="mt-1 inline-block text-xs font-semibold text-[#1556b6] hover:underline">
                Aller a la connexion
              </Link>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Mise a jour..." : "Reinitialiser le mot de passe"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          <div className="rounded-xl border border-[#e6eaf2] bg-[#f8faff] px-3 py-2 text-xs text-slate-600">
            <p className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1677ff]" />
              Le token est a usage unique et expire automatiquement.
            </p>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
