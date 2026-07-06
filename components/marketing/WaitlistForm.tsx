"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  source: string;
  className?: string;
};

export function WaitlistForm({ source, className = "" }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("submitting");

    const supabase = getSupabase();
    const { error } = await supabase.from("waitlist").insert({ email: trimmed, source });

    if (error) {
      // Unique violation — this email is already on the list. Treat as success,
      // not an error: the user's intent (get on the waitlist) is already satisfied.
      if (error.code === "23505") {
        setStatus("success");
        setMessage("You're already on the list — we'll be in touch.");
        return;
      }
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
      return;
    }

    setStatus("success");
    setMessage("You're on the list — we'll be in touch soon.");
  }

  if (status === "success") {
    return (
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded text-[13px] ${className}`}
        style={{
          background: "var(--green-dim)",
          color: "var(--green)",
          border: "1px solid rgba(34,197,94,0.25)",
        }}
      >
        <span>✓</span>
        <span>{message}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="you@example.com"
          disabled={status === "submitting"}
          className="flex-1 px-4 py-3 rounded text-[13px] outline-none transition-colors"
          style={{
            background: "var(--bg-overlay)",
            border: `1px solid ${status === "error" ? "var(--red)" : "var(--border)"}`,
            color: "var(--text-primary)",
          }}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-5 py-3 rounded text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          style={{ background: "var(--accent)" }}
        >
          {status === "submitting" ? "Joining…" : "Join the beta"}
        </button>
      </div>
      {status === "error" && (
        <span className="text-[12px]" style={{ color: "var(--red)" }}>
          {message}
        </span>
      )}
    </form>
  );
}
