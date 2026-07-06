import { WaitlistForm } from "@/components/marketing/WaitlistForm";

export function FinalCta() {
  return (
    <section className="px-4 sm:px-8 py-16 sm:py-24 border-t border-[var(--border)]">
      <div className="max-w-xl mx-auto text-center flex flex-col items-center gap-5">
        <h2 className="text-[24px] sm:text-[32px] font-semibold text-[var(--text-primary)] tracking-tight">
          Trade Polymarket like a sharp
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Join the waitlist and we'll let you know when a beta spot opens up.
        </p>
        <div className="w-full max-w-md">
          <WaitlistForm source="footer" />
        </div>
      </div>
    </section>
  );
}
