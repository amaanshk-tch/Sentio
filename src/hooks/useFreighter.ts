import { useState, useCallback, useEffect } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
} from "@stellar/freighter-api";

export type FreighterStatus = "idle" | "checking" | "not_installed" | "connecting" | "connected" | "error";

interface FreighterState {
  status: FreighterStatus;
  publicKey: string | null;
  error: string | null;
}

export function useFreighter() {
  const [state, setState] = useState<FreighterState>({
    status: "idle",
    publicKey: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const connected = await isConnected();
        if (!connected?.isConnected || cancelled) return;
        const result = await getAddress();
        if (result?.address && !cancelled) {
          setState({ status: "connected", publicKey: result.address, error: null });
        }
      } catch {
        // Silently ignore session restoration failures
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleUnload() {
      setState({ status: "idle", publicKey: null, error: null });
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  const connect = useCallback(async () => {
    setState(s => ({ ...s, status: "connecting", error: null }));
    try {
      const connected = await isConnected();
      if (!connected?.isConnected) {
        setState({ status: "not_installed", publicKey: null, error: "Freighter not installed" });
        return null;
      }

      await requestAccess();
      const result = await getAddress();

      if (!result?.address) {
        setState({ status: "error", publicKey: null, error: "Could not get address from Freighter." });
        return null;
      }

      setState({ status: "connected", publicKey: result.address, error: null });
      return result.address;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setState({ status: "error", publicKey: null, error: msg });
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ status: "idle", publicKey: null, error: null });
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    isConnected: state.status === "connected",
  };
}