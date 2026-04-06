import { ReactNode } from "react";
import { AmbientLayer } from "@/components/landing/AmbientLayer";

interface PageLayoutProps {
  children: ReactNode;
  variant?: "default" | "centered" | "narrow";
  className?: string;
}

export function PageLayout({ 
  children, 
  variant = "default", 
  className = "" 
}: PageLayoutProps) {
  const isCentered = variant === "centered";
  const isNarrow = variant === "narrow";

  return (
    <div className={`relative min-h-screen overflow-hidden bg-background text-foreground ${className}`}>
      <AmbientLayer />

      <main
        className={`relative z-10 mx-auto px-4 sm:px-8 ${
          isCentered 
            ? "flex min-h-screen flex-col items-center justify-center text-center" 
            : `pb-20 pt-2 ${isNarrow ? "max-w-4xl" : "max-w-6xl"}`
        }`}
      >
        {children}
      </main>
    </div>
  );
}
