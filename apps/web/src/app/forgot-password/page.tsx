"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck, TriangleAlert } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { requestPasswordReset, type ForgotPasswordResponse } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ForgotPasswordResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResponse(null);
    setLoading(true);

    try {
      const result = await requestPasswordReset(email);
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d envoyer la demande.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge="Recuperation"
      title="Mot de passe oublie"
      subtitle="Entre ton email pour recevoir un lien de reinitialisation."
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

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-[var(--danger)]">
              <p className="inline-flex items-center gap-2">
                <TriangleAlert className="h-4 w-4" />
                {error}
              </p>
            </div>
          ) : null}

          {response ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <p className="inline-flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {response.message}
              </p>
              {response.reset_url ? (
                <div className="mt-2 text-xs">
                  <p className="font-semibold">Lien de reset (mode debug):</p>
                  <Link href={response.reset_url} className="break-all text-[#1556b6] hover:underline">
                    {response.reset_url}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Envoi..." : "Envoyer le lien"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          <div className="rounded-xl border border-[#e6eaf2] bg-[#f8faff] px-3 py-2 text-xs text-slate-600">
            <p className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1677ff]" />
              Pour securite, la reponse reste identique meme si l email n existe pas.
            </p>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
