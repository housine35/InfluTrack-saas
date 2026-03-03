"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, TriangleAlert, User } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { registerUser } from "@/lib/api";
import { saveSession } from "@/lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordScore = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const passwordStrengthLabel =
    passwordScore <= 1 ? "Faible" : passwordScore <= 3 ? "Moyen" : "Fort";

  const passwordStrengthColor =
    passwordScore <= 1 ? "text-red-600" : passwordScore <= 3 ? "text-amber-600" : "text-emerald-600";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    if (!acceptTerms) {
      setError("Tu dois accepter les conditions pour creer un compte.");
      return;
    }

    setLoading(true);

    try {
      const auth = await registerUser({
        full_name: fullName.trim() || undefined,
        email,
        password,
      });
      saveSession({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        user: auth.user,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge="Inscription"
      title="Cree ton espace client InfluTrack"
      subtitle="Active un compte en quelques secondes et accede a un dashboard d analyse professionnel."
      footer={
        <>
          Tu as deja un compte ?{" "}
          <Link href="/login" className="font-semibold text-[#1556b6] hover:underline">
            Connexion
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 rounded-2xl border border-[#e5e9f1] bg-white p-5 shadow-[0_10px_25px_rgba(15,23,42,0.05)] sm:p-6">
          <div>
            <label htmlFor="fullName" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nom complet (optionnel)
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d8deea] bg-white pl-10 pr-3 text-sm text-slate-700 outline-none ring-2 ring-transparent transition focus:border-[#abc6f8] focus:ring-[#eaf1ff]"
                placeholder="Ex: Khalil Ben..."
              />
            </div>
          </div>

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
            {password ? (
              <p className={`mt-2 text-xs font-semibold ${passwordStrengthColor}`}>
                Force du mot de passe: {passwordStrengthLabel}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
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

          <label className="flex items-start gap-2 rounded-xl border border-[#e5e9f1] bg-[#f8faff] px-3 py-2 text-xs leading-5 text-slate-600">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#c7d2e5] text-slate-900"
            />
            <span>J accepte les conditions d utilisation et la politique de confidentialite.</span>
          </label>

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
            {loading ? "Creation..." : "Creer mon compte"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          <div className="rounded-xl border border-[#e6eaf2] bg-[#f8faff] px-3 py-2 text-xs text-slate-600">
            <p className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1677ff]" />
              Protection des acces et gestion securisee des comptes clients.
            </p>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
