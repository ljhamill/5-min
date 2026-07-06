import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Hero } from "@/components/marketing/Hero";
import { ValueProps } from "@/components/marketing/ValueProps";
import { ClosedBetaBand } from "@/components/marketing/ClosedBetaBand";
import { PricingScaffold } from "@/components/marketing/PricingScaffold";
import { FinalCta } from "@/components/marketing/FinalCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <ValueProps />
        <ClosedBetaBand />
        <PricingScaffold />
        <FinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}
