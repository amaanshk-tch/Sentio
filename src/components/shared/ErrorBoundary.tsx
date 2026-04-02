import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { AmbientLayer } from "@/components/landing/AmbientLayer";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
          <AmbientLayer />
          <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 shadow-[0_0_40px_-10px_hsl(var(--destructive)/0.3)]">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            
            <h1 className="text-display mb-4 font-bold">
              Something went <strong>wrong</strong>
            </h1>
            <p className="text-body-lg mb-8 max-w-md text-sentio-text-muted">
              An unexpected error occurred in the network module. Our diagnostics team has been alerted.
            </p>

            <button
              onClick={() => window.location.reload()}
              className="group flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sentio-glow transition hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180 duration-500" />
              Re-initialize Session
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
