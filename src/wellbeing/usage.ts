import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export interface UsageApp {
  packageName: string;
  label: string;
  category: string;
  durationMs: number;
  launches: number;
}

export interface UsageDay {
  date: string;
  totalMs: number;
  unlocks: number;
  coverage: "complete" | "partial" | "unavailable";
  coverageEnd: number | null;
  matchedTotalMs: number | null;
  apps: UsageApp[];
}

export interface UsageStatus {
  supported: boolean;
  granted: boolean;
  enabled: boolean;
  notificationsGranted: boolean;
  locked: boolean;
  lastRefresh: number | null;
}

export interface UsagePolicy {
  warningsEnabled: boolean;
  limits: {
    id: string;
    targetType: "app" | "category";
    target: string;
    minutes: number;
    warnAt80: boolean;
    extensionDay?: string;
  }[];
  focusSessions?: { id: string; startAt: number; endAt: number; apps: string[]; categories: string[] }[];
  focusSchedules?: {
    id: string; days: number[]; startMinute: number; durationMinutes: number;
    startsAfter: number; apps: string[]; categories: string[];
  }[];
  suppressions?: string[];
}

interface NativeUsage {
  status(): Promise<UsageStatus>;
  openSettings(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  readDays(days: number): Promise<UsageDay[]>;
  clearHistory(): Promise<void>;
  syncPolicy(json: string): Promise<void>;
}

const native = Platform.OS === "android"
  ? requireOptionalNativeModule<NativeUsage>("WellbeingUsage")
  : null;

const unsupported: UsageStatus = {
  supported: false, granted: false, enabled: false, notificationsGranted: false,
  locked: false, lastRefresh: null,
};

export async function getUsageStatus(): Promise<UsageStatus> {
  return native ? native.status() : { ...unsupported };
}

export async function openUsageSettings(): Promise<boolean> {
  return native ? native.openSettings() : false;
}

export async function setUsageEnabled(enabled: boolean): Promise<void> {
  await native?.setEnabled(enabled);
}

export async function readUsage(days = 7): Promise<UsageDay[]> {
  const count = Number.isFinite(days) ? Math.max(1, Math.min(90, Math.floor(days))) : 7;
  return native ? native.readDays(count) : [];
}

export async function clearUsageHistory(): Promise<void> {
  await native?.clearHistory();
}

export async function syncUsagePolicy(policy: UsagePolicy): Promise<void> {
  await native?.syncPolicy(JSON.stringify(policy));
}
