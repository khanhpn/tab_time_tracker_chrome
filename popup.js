const STATE_KEY = "currentTabTimer";

const elapsedEl = document.getElementById("elapsed");
const tabIdEl = document.getElementById("tabId");
const startedAtEl = document.getElementById("startedAt");
const resetButton = document.getElementById("resetButton");

let currentState = null;
let intervalId = null;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "-";
  }

  return new Date(timestamp).toLocaleTimeString();
}

function render() {
  if (!currentState || !currentState.startedAt) {
    elapsedEl.textContent = "00:00";
    tabIdEl.textContent = "-";
    startedAtEl.textContent = "-";
    return;
  }

  const elapsedMs = Date.now() - currentState.startedAt;

  elapsedEl.textContent = formatElapsed(elapsedMs);
  tabIdEl.textContent = String(currentState.tabId ?? "-");
  startedAtEl.textContent = formatTime(currentState.startedAt);
}

async function loadState() {
  const response = await chrome.runtime.sendMessage({
    type: "GET_TIMER_STATE"
  });

  currentState = response;
  render();
}

async function resetCurrentTimer() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  const tab = tabs[0];

  if (!tab || typeof tab.id !== "number") {
    return;
  }

  currentState = {
    tabId: tab.id,
    startedAt: Date.now()
  };

  await chrome.storage.local.set({
    [STATE_KEY]: currentState
  });

  await chrome.action.setBadgeText({
    text: "0s"
  });

  render();
}

function startTicker() {
  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(render, 1000);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (!changes[STATE_KEY]) {
    return;
  }

  currentState = changes[STATE_KEY].newValue;
  render();
});

resetButton.addEventListener("click", resetCurrentTimer);

loadState();
startTicker();
