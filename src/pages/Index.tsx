import { PageLayout } from "@/components/layout/PageLayout";
import { LandingHero } from "@/components/landing/LandingHero";
import { BrandMark } from "@/components/landing/BrandMark";

export default function Index() {
  return (
    <PageLayout>
      <LandingHero />

      <footer className="mt-16 border-t border-foreground/6 pt-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <BrandMark size="sm" />
          <p className="text-sm text-sentio-text-muted">
            © {new Date().getFullYear()} Sentio
          </p>
        </div>
      </footer>
    </PageLayout>
  );
}
