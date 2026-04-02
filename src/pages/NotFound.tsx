import { Link } from "react-router-dom";
import { ArrowLeft, HardDrive } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { BrandMark } from "@/components/landing/BrandMark";

export default function NotFound() {
  return (
    <PageLayout variant="centered">
      <div className="mb-8 animate-fade-in-up">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-foreground/10 bg-sentio-elevated/80 shadow-sentio-glow-accent backdrop-blur-xl">
          <HardDrive className="h-10 w-10 text-primary" />
        </div>
        
        <h1 className="text-display mb-4">
          404 <strong>Not Found</strong>
        </h1>
        <p className="text-body-lg mx-auto max-w-md">
          The page you're looking for has been moved or doesn't exist in the network.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Link
          to="/"
          className="group flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sentio-glow transition hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </Link>
        
        <BrandMark size="sm" />
      </div>
    </PageLayout>
  );
}
