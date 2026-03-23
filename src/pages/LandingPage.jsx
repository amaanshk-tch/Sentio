import { motion, useReducedMotion } from "framer-motion";
import { BrandMark } from "../ui/BrandMark";
import { AmbientLayer } from "../components/landing/AmbientLayer";
import { LandingHero } from "../components/landing/LandingHero";
import { LandingSections } from "../components/landing/LandingSections";

export default function LandingPage() {
  const reduced = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden bg-sentio-canvas text-sentio-text">
      <AmbientLayer reduced={reduced} />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-(--container-max) flex-col px-(--container-padding) pb-20 pt-2">
        <LandingHero />
        <LandingSections reduced={reduced} />

        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 border-t border-white/6 pt-10"
        >
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <BrandMark to="/" size="sm" />
            <p className="text-sm text-sentio-text-muted">© {new Date().getFullYear()} Sentio</p>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
