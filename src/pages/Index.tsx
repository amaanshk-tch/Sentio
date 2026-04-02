import { motion } from "framer-motion";
import { AmbientLayer } from "@/components/landing/AmbientLayer";
import { LandingHero } from "@/components/landing/LandingHero";
import { BrandMark } from "@/components/landing/BrandMark";

export default function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AmbientLayer />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-20 pt-2 sm:px-8">
        <LandingHero />

        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 border-t border-foreground/6 pt-10"
        >
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <BrandMark size="sm" />
            <p className="text-sm text-sentio-text-muted">
              © {new Date().getFullYear()} Sentio
            </p>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
