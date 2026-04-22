import { ReactNode } from "react";
import { AmbientLayer } from "@/components/landing/AmbientLayer";

interface PageLayoutProps {
  children: ReactNode;
  centered?: boolean;
  className?: string;
}

export function PageLayout({ 
  children, 
  centered = false, 
  className = "" 
}: PageLayoutProps) {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-background text-foreground ${className}`}>
      <AmbientLayer />

      <main
        className={`relative z-10 mx-auto px-4 sm:px-8 ${
          centered 
            ? "flex min-h-screen flex-col items-center justify-center text-center" 
            : "max-w-6xl pb-20 pt-2"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
