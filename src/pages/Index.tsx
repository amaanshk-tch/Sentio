import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/layout/PageLayout";
import { LandingHero } from "@/components/landing/LandingHero";
import { BrandMark } from "@/components/landing/BrandMark";
import { HowItWorks } from "@/components/landing/HowItWorks";

export default function Index() {
  const [shown, setShown] = useState(false);

  function handleReveal() {
    setShown(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById("how-it-works")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      )
    );
  }

  return (
    <PageLayout>
      <LandingHero onReveal={handleReveal} />

      <AnimatePresence>
        {shown && (
          <motion.div
            key="how-it-works"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <HowItWorks />
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-24 border-t border-foreground/6 pt-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <BrandMark to="/" size="xs" />
          <p className="text-sm text-sentio-text-muted">
            © {new Date().getFullYear()} Sentio
          </p>
        </div>
      </footer>
    </PageLayout>
  );
}
