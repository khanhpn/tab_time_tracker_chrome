const STATE_KEY = "tabTimeTrackerState";
const SETTINGS_KEY = "tabTimeTrackerSettings";

const DEFAULT_SETTINGS = {
  pauseWhenWindowBlurred: true,
  showBadge: true
};

function now() {
  return Date.now();
}

function getDomain(url) {
  if (!url) return "Unknown";
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "chrome:" ||
      parsed.protocol === "chrome-extension:"
    ) {
      return parsed.protocol.replace(":", "");
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

function formatBadge(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
}

async function getState() {
  const result = await chrome.storage.local.get(STATE_KEY);
  return result[STATE_KEY] || null;
}

async function saveState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

async function updateBadge(state) {
  const settings = await getSettings();

  if (!settings.showBadge) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  if (!state || state.isPaused) {
    await chrome.action.setBadgeText({ text: "PA" });
    await chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
    return;
  }

  await chrome.action.setBadgeText({
    text: formatBadge(now() - state.startedAt)
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
}

async function getCurrentActiveTab(windowId) {
  const query = { active: true };
  if (typeof windowId === "number") query.windowId = windowId;
  else query.lastFocusedWindow = true;
  const tabs = await chrome.tabs.query(query);
  return tabs[0] || null;
}

async function startTrackingTab(tab) {
  if (!tab || typeof tab.id !== "number") return null;

  const state = {
    tabId: tab.id,
    title: tab.title || "Current tab",
    url: tab.url || "",
    domain: getDomain(tab.url),
    startedAt: now(),
    isPaused: false
  };

  await saveState(state);
  await updateBadge(state);
  return state;
}

async function ensureInitialState() {
  const existing = await getState();
  if (existing) {
    await updateBadge(existing);
    return existing;
  }

  const tab = await getCurrentActiveTab();
  return startTrackingTab(tab);
}

async function pauseTracking() {
  const state = await getState();
  if (!state || state.isPaused) return;

  const pausedState = {
    ...state,
    pausedAt: now(),
    isPaused: true
  };

  await saveState(pausedState);
  await updateBadge(pausedState);
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInitialState();
});

chrome.runtime.onStartup.addListener(() => {
  ensureInitialState();
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await startTrackingTab(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.title && !changeInfo.url) return;

  const state = await getState();
  if (!state || state.tabId !== tabId) return;

  const updatedState = {
    ...state,
    title: tab.title || state.title,
    url: tab.url || state.url,
    domain: getDomain(tab.url || state.url)
  };

  await saveState(updatedState);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (!state || state.tabId !== tabId) return;

  const tab = await getCurrentActiveTab();
  await startTrackingTab(tab);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const settings = await getSettings();

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (settings.pauseWhenWindowBlurred) await pauseTracking();
    return;
  }

  const tab = await getCurrentActiveTab(windowId);
  await startTrackingTab(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TIMER_STATE") {
    ensureInitialState().then(sendResponse);
    return true;
  }

  if (message.type === "RESET_TIMER") {
    getCurrentActiveTab().then(startTrackingTab).then(sendResponse);
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    const settings = { ...DEFAULT_SETTINGS, ...(message.settings || {}) };
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }).then(async () => {
      await updateBadge(await getState());
      sendResponse(settings);
    });
    return true;
  }

  return false;
});
