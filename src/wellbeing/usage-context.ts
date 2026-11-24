import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { create } from "zustand";
import { getUsageStatus, readUsage, type UsageDay } from "./usage";

type UsageState = {
  days: UsageDay[];
  status: Awaited<ReturnType<typeof getUsageStatus>> | null;
  loading: boolean;
  error: string | null;
};
const useSnapshot = create<UsageState>(() => ({
  days: [], status: null, loading: true, error: null,
}));
let pending: Promise<void> | undefined;
export function refreshUsage(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const status = await getUsageStatus();
      const days = status.supported ? await readUsage(90) : [];
      useSnapshot.setState({status: status.supported ? await getUsageStatus() : status, days, loading:false, error:null});
    } catch (error) {
      useSnapshot.setState({loading:false, error:String(error)});
    }
  })().finally(() => { pending = undefined; });
  return pending;
}
let subscribers = 0;
let stop: (() => void) | undefined;
export function useWellbeingUsage() {
  const snapshot = useSnapshot();
  useEffect(() => {
    if (++subscribers === 1) {
      void refreshUsage();
      const sub = AppState.addEventListener("change", state => { if (state === "active") void refreshUsage(); });
      if (Platform.OS === "web") window.addEventListener("focus", refreshUsage);
      stop = () => {
        sub.remove();
        if (Platform.OS === "web") window.removeEventListener("focus", refreshUsage);
      };
    }
    return () => { if (--subscribers === 0) stop?.(); };
  }, []);
  return {...snapshot, refresh:refreshUsage};
}
