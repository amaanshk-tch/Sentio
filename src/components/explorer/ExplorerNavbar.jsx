import { BookOpen, Github, HelpCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import { BrandMark } from "../../ui/BrandMark";
import { LINKS } from "./constants";

export function ExplorerNavbar({ onOpenHelp }) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-sentio-canvas/70 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-[3.75rem] max-w-[var(--container-max)] items-center justify-between gap-4 px-[var(--container-padding)]">
        <BrandMark to="/" size="sm" />
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-sentio-surface/50 px-2.5 py-1 text-[0.7rem] font-medium text-sentio-text-muted md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            Live
          </span>
          <a
            href={LINKS.stellarDocs}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-sentio-text-secondary",
              "transition hover:bg-white/[0.06] hover:text-sentio-text",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70"
            )}
          >
            <BookOpen className="h-4 w-4 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Docs</span>
          </a>
          <a
            href={LINKS.stellarGithub}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-sentio-text-secondary",
              "transition hover:bg-white/[0.06] hover:text-sentio-text",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70"
            )}
          >
            <Github className="h-4 w-4 opacity-80" aria-hidden />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <button
            type="button"
            onClick={onOpenHelp}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-sentio-text-secondary",
              "transition hover:bg-white/[0.06] hover:text-sentio-text",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70"
            )}
          >
            <HelpCircle className="h-4 w-4 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>
      </div>
    </div>
  );
}
