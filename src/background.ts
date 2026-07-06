import type { RuntimeRequest, RuntimeResponse, UsageSummary } from "./messages";
import {
  activateTab,
  createInitialState,
  DEFAULT_USAGE_SETTINGS,
  getSortedUsage,
  keepOnlyOpenTabs,
  normalizeSettings,
  removeTabsFromState,
  resetState,
  resetStateToActiveTab,
  type TabSnapshot,
  type UsageSettings,
  type UsageState
} from "./tracker";

const STORAGE_KEY = "tab-times-state";
const SETTINGS_KEY = "tab-times-settings";

const readState = async (): Promise<UsageState> => {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as UsageState | undefined) ?? createInitialState();
};

const writeState = async (state: UsageState): Promise<void> => {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
};

const readSettings = async (): Promise<UsageSettings> => {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(
    (result[SETTINGS_KEY] as Partial<UsageSettings> | undefined) ?? DEFAULT_USAGE_SETTINGS
  );
};

const writeSettings = async (settings: Partial<UsageSettings>): Promise<UsageSettings> => {
  const nextSettings = normalizeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: nextSettings });
  return nextSettings;
};

const toSnapshot = (tab: chrome.tabs.Tab): TabSnapshot | null => {
  if (tab.id === undefined || tab.windowId === undefined) {
    return null;
  }

  return {
    tabId: tab.id,
    windowId: tab.windowId,
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl
  };
};

const captureActiveTab = async (tabId: number, windowId?: number): Promise<void> => {
  const tab = await chrome.tabs.get(tabId);
  const snapshot = toSnapshot({ ...tab, windowId: windowId ?? tab.windowId });

  if (snapshot === null) {
    return;
  }

  const state = await readState();
  await writeState(activateTab(state, snapshot, Date.now()));
};

const summarize = (state: UsageState, settings: UsageSettings): UsageSummary => {
  const tabs = getSortedUsage(state, Date.now(), settings);
  return {
    tabs,
    totalMs: tabs.reduce((sum, tab) => sum + tab.displayMs, 0),
    activeTabCount: tabs.length,
    settings
  };
};

const getCurrentActiveSnapshot = async (): Promise<TabSnapshot | null> => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab === undefined ? null : toSnapshot(activeTab);
};

const reconcileStateForPopup = async (state: UsageState): Promise<UsageState> => {
  const openTabs = await chrome.tabs.query({});
  const openTabIds = openTabs
    .map((tab) => tab.id)
    .filter((tabId): tabId is number => tabId !== undefined);
  const activeSnapshot = await getCurrentActiveSnapshot();
  const prunedState = keepOnlyOpenTabs(state, openTabIds);

  return activeSnapshot === null
    ? prunedState
    : activateTab(prunedState, activeSnapshot, Date.now());
};

chrome.tabs.onActivated.addListener((activeInfo) => {
  void captureActiveTab(activeInfo.tabId, activeInfo.windowId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.title === undefined &&
    changeInfo.url === undefined &&
    changeInfo.favIconUrl === undefined
  ) {
    return;
  }

  if (!tab.active) {
    return;
  }

  void captureActiveTab(tabId, tab.windowId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const state = await readState();
    await writeState(removeTabsFromState(state, [tabId]));
  })();
});

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (activeTab?.id !== undefined) {
      await captureActiveTab(activeTab.id, activeTab.windowId);
    }
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (activeTab?.id !== undefined) {
      await captureActiveTab(activeTab.id, activeTab.windowId);
    }
  })();
});

chrome.runtime.onMessage.addListener(
  (request: RuntimeRequest, _sender, sendResponse: (response: RuntimeResponse) => void) => {
    void (async () => {
      try {
        if (request.type === "GET_USAGE") {
          const state = await readState();
          const reconciledState = await reconcileStateForPopup(state);
          const settings = await readSettings();
          await writeState(reconciledState);
          sendResponse({ ok: true, summary: summarize(reconciledState, settings) });
          return;
        }

        if (request.type === "UPDATE_SETTINGS") {
          const settings = await writeSettings(request.settings);
          sendResponse({ ok: true, settings });
          return;
        }

        if (request.type === "FOCUS_TAB") {
          await chrome.tabs.update(request.tabId, { active: true });
          await chrome.windows.update(request.windowId, { focused: true });
          await captureActiveTab(request.tabId, request.windowId);
          sendResponse({ ok: true, focused: true, tabId: request.tabId });
          return;
        }

        if (request.type === "CLOSE_TAB") {
          const state = await readState();
          await writeState(removeTabsFromState(state, [request.tabId]));
          await chrome.tabs.remove(request.tabId);
          sendResponse({ ok: true, closed: true, tabId: request.tabId });
          return;
        }

        const state = await readState();
        const activeSnapshot = await getCurrentActiveSnapshot();
        const nextState =
          activeSnapshot === null
            ? resetState()
            : resetStateToActiveTab(state, activeSnapshot, Date.now());

        await writeState(nextState);

        sendResponse({ ok: true, reset: true });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unexpected extension error"
        });
      }
    })();

    return true;
  }
);
