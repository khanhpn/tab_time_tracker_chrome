const STATE_KEY = "currentTabTimer";

function now() {
  return Date.now();
}

async function getCurrentActiveTabId() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  const tab = tabs[0];

  if (!tab || typeof tab.id !== "number") {
    return null;
  }

  return tab.id;
}

async function setCurrentTab(tabId) {
  const state = {
    tabId,
    startedAt: now()
  };

  await chrome.storage.local.set({
    [STATE_KEY]: state
  });

  await chrome.action.setBadgeText({
    text: "0s"
  });
}

async function ensureInitialState() {
  const existing = await chrome.storage.local.get(STATE_KEY);

  if (existing[STATE_KEY]) {
    return existing[STATE_KEY];
  }

  const tabId = await getCurrentActiveTabId();

  if (tabId === null) {
    return null;
  }

  await setCurrentTab(tabId);

  return {
    tabId,
    startedAt: now()
  };
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInitialState();
});

chrome.runtime.onStartup.addListener(() => {
  ensureInitialState();
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  setCurrentTab(activeInfo.tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  const tabs = await chrome.tabs.query({
    active: true,
    windowId
  });

  const tab = tabs[0];

  if (!tab || typeof tab.id !== "number") {
    return;
  }

  setCurrentTab(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "GET_TIMER_STATE") {
    return;
  }

  ensureInitialState().then((state) => {
    sendResponse(state);
  });

  return true;
});
