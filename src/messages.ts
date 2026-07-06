import type { PopupTabUsage, UsageSettings } from "./tracker";

export type UsageSummary = {
  tabs: PopupTabUsage[];
  totalMs: number;
  activeTabCount: number;
  settings: UsageSettings;
};

export type RuntimeRequest =
  | { type: "GET_USAGE" }
  | { type: "RESET_USAGE" }
  | { type: "FOCUS_TAB"; tabId: number; windowId: number }
  | { type: "CLOSE_TAB"; tabId: number }
  | { type: "UPDATE_SETTINGS"; settings: Partial<UsageSettings> };

export type RuntimeResponse =
  | { ok: true; summary: UsageSummary }
  | { ok: true; reset: true }
  | { ok: true; focused: true; tabId: number }
  | { ok: true; closed: true; tabId: number }
  | { ok: true; settings: UsageSettings }
  | { ok: false; error: string };
