import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { RequireWallet } from "@/components/shared/RequireWallet";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

const Index    = lazy(() => import("./pages/Index"));
const Explorer = lazy(() => import("./pages/Explorer"));
const Admin    = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NetworkProvider>
          <Sonner />
          <BrowserRouter>
            <Suspense>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/explorer" element={<RequireWallet><Explorer /></RequireWallet>} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </NetworkProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);


export default App;