"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type Status = "idle" | "submitting" | "sent" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState("/app");

  // Read ?next=/app&error=... from the URL without a useSearchParams/Suspense
  // boundary — this page is inherently dynamic (auth), so a plain client-side
  // read is simplest.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) setNextPath(next);
    if (params.get("error") === "auth_failed") {
      setStatus("error");
      setMessage("That sign-in link didn't work. Please try again.");
    }
  }, []);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("submitting");

    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
      return;
    }

    setStatus("sent");
    setMessage(`We sent a sign-in link to ${trimmed}.`);
  }

  async function handleOAuthSignIn(provider: "google" | "apple") {
    const supabase = getSupabase();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
  }

  return (
    <div
      className="w-full max-w-sm p-8 rounded-xl flex flex-col items-center gap-6"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L18 10L10 18L2 10L10 2Z" fill="var(--accent)" />
          <path d="M10 5L15 10L10 15L5 10L10 5Z" fill="var(--bg-surface)" />
        </svg>
        <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          INCANTR
        </span>
      </div>

      {status === "sent" ? (
        <div
          className="w-full flex items-center gap-2 px-4 py-3 rounded text-[13px] text-center"
          style={{
            background: "var(--green-dim)",
            color: "var(--green)",
            border: "1px solid rgba(34,197,94,0.25)",
          }}
        >
          <span>✓</span>
          <span>{message}</span>
        </div>
      ) : (
        <>
          <div className="w-full text-center">
            <h1 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
              Sign in
            </h1>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Incantr is in closed beta — sign in to join the queue.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded text-[13px] font-medium transition-colors hover:brightness-110"
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.53H2.18v2.85A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.86 14.1a6.6 6.6 0 0 1 0-4.2V7.05H2.18a11 11 0 0 0 0 9.9l3.68-2.85z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.68 2.85C6.72 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-[11px] text-[var(--text-dim)]">or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          <form onSubmit={handleEmailSubmit} className="w-full flex flex-col gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="you@example.com"
              disabled={status === "submitting"}
              className="w-full px-4 py-3 rounded text-[13px] outline-none transition-colors"
              style={{
                background: "var(--bg-overlay)",
                border: `1px solid ${status === "error" ? "var(--red)" : "var(--border)"}`,
                color: "var(--text-primary)",
              }}
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full px-4 py-3 rounded text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {status === "submitting" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && (
              <span className="text-[12px] text-center" style={{ color: "var(--red)" }}>
                {message}
              </span>
            )}
          </form>
        </>
      )}
    </div>
  );
}
