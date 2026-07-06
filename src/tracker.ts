export type TabUsage = {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
  accumulatedMs: number;
  lastActivatedAt: number | null;
};

export type UsageState = {
  activeTabId: number | null;
  tabs: Record<string, TabUsage>;
};

export type TabSnapshot = {
  tabId: number;
  windowId: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
};

export type LimitStatus = "normal" | "warning" | "exceeded";

export type UsageSettings = {
  maxTabMs: number;
  warningBeforeMs: number;
};

export type PopupTabUsage = TabUsage & {
  displayMs: number;
  isActive: boolean;
  limitStatus: LimitStatus;
  limitPercent: number;
  remainingMs: number;
};

export const DEFAULT_USAGE_SETTINGS: UsageSettings = {
  maxTabMs: 60 * 60 * 1000,
  warningBeforeMs: 10 * 60 * 1000
};

export const createInitialState = (): UsageState => ({
  activeTabId: null,
  tabs: {}
});

export const normalizeSettings = (settings?: Partial<UsageSettings>): UsageSettings => {
  const maxTabMs = Math.max(
    60_000,
    Math.round(settings?.maxTabMs ?? DEFAULT_USAGE_SETTINGS.maxTabMs)
  );
  const warningBeforeMs = Math.min(
    maxTabMs,
    Math.max(0, Math.round(settings?.warningBeforeMs ?? DEFAULT_USAGE_SETTINGS.warningBeforeMs))
  );

  return {
    maxTabMs,
    warningBeforeMs
  };
};

export const activateTab = (
  state: UsageState,
  snapshot: TabSnapshot,
  activatedAt: number
): UsageState => {
  const tabs = { ...state.tabs };

  if (state.activeTabId !== null) {
    const activeKey = String(state.activeTabId);
    const activeTab = tabs[activeKey];

    if (activeTab?.lastActivatedAt !== null && activeTab.lastActivatedAt <= activatedAt) {
      tabs[activeKey] = {
        ...activeTab,
        accumulatedMs: activeTab.accumulatedMs + activatedAt - activeTab.lastActivatedAt,
        lastActivatedAt: null
      };
    }
  }

  const key = String(snapshot.tabId);
  const existing = tabs[key];

  tabs[key] = {
    tabId: snapshot.tabId,
    windowId: snapshot.windowId,
    title: snapshot.title?.trim() || "Untitled tab",
    url: snapshot.url ?? "",
    favIconUrl: snapshot.favIconUrl,
    accumulatedMs: existing?.accumulatedMs ?? 0,
    lastActivatedAt: activatedAt
  };

  return {
    activeTabId: snapshot.tabId,
    tabs
  };
};

export const removeTabsFromState = (state: UsageState, tabIds: number[]): UsageState => {
  const tabs = { ...state.tabs };

  for (const tabId of tabIds) {
    delete tabs[String(tabId)];
  }

  return {
    activeTabId:
      state.activeTabId !== null && tabIds.includes(state.activeTabId) ? null : state.activeTabId,
    tabs
  };
};

export const keepOnlyOpenTabs = (state: UsageState, openTabIds: number[]): UsageState => {
  const openTabIdSet = new Set(openTabIds);
  const tabs = Object.fromEntries(
    Object.entries(state.tabs).filter(([, tab]) => openTabIdSet.has(tab.tabId))
  );

  return {
    activeTabId:
      state.activeTabId !== null && openTabIdSet.has(state.activeTabId) ? state.activeTabId : null,
    tabs
  };
};

export const resetState = (): UsageState => createInitialState();

export const resetStateToActiveTab = (
  _state: UsageState,
  snapshot: TabSnapshot,
  activatedAt: number
): UsageState => activateTab(resetState(), snapshot, activatedAt);

export const getLimitStatus = (displayMs: number, settings: UsageSettings): LimitStatus => {
  if (displayMs >= settings.maxTabMs) {
    return "exceeded";
  }

  if (displayMs >= settings.maxTabMs - settings.warningBeforeMs) {
    return "warning";
  }

  return "normal";
};

export const getSortedUsage = (
  state: UsageState,
  now: number,
  settings: UsageSettings = DEFAULT_USAGE_SETTINGS
): PopupTabUsage[] => {
  const normalizedSettings = normalizeSettings(settings);

  return Object.values(state.tabs)
    .map((tab) => {
      const activeElapsed =
        tab.lastActivatedAt !== null && tab.lastActivatedAt <= now ? now - tab.lastActivatedAt : 0;
      const displayMs = tab.accumulatedMs + activeElapsed;

      return {
        ...tab,
        displayMs,
        isActive: tab.tabId === state.activeTabId,
        limitStatus: getLimitStatus(displayMs, normalizedSettings),
        limitPercent: Math.min(100, Math.round((displayMs / normalizedSettings.maxTabMs) * 100)),
        remainingMs: Math.max(0, normalizedSettings.maxTabMs - displayMs)
      };
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      return b.displayMs - a.displayMs || a.title.localeCompare(b.title);
    });
};

export const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }

  return `${seconds}s`;
};
