const STATE_KEY = "tabTimeTrackerState";
const elapsedEl = document.getElementById("elapsed");
const tabIdEl = document.getElementById("tabId");
const startedAtEl = document.getElementById("startedAt");
const statusTextEl = document.getElementById("statusText");
const tabTitleEl = document.getElementById("tabTitle");
const tabDomainEl = document.getElementById("tabDomain");
const progressBarEl = document.getElementById("progressBar");
const resetButton = document.getElementById("resetButton");
const refreshButton = document.getElementById("refreshButton");
const pauseWhenWindowBlurredEl = document.getElementById(
  "pauseWhenWindowBlurred"
);
const showBadgeEl = document.getElementById("showBadge");
let currentState = null;
let intervalId = null;
function pad(v) {
  return String(v).padStart(2, "0");
}
function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
function formatTime(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
function getElapsedMs() {
  if (!currentState || !currentState.startedAt) return 0;
  if (currentState.isPaused && currentState.pausedAt)
    return currentState.pausedAt - currentState.startedAt;
  return Date.now() - currentState.startedAt;
}
function render() {
  if (!currentState) {
    elapsedEl.textContent = "00:00";
    tabIdEl.textContent = "-";
    startedAtEl.textContent = "-";
    tabTitleEl.textContent = "Current tab";
    tabDomainEl.textContent = "-";
    statusTextEl.textContent = "Waiting for tab";
    progressBarEl.style.width = "0%";
    document.body.classList.remove("paused");
    return;
  }
  const elapsedMs = getElapsedMs();
  const sec = Math.floor(elapsedMs / 1000);
  elapsedEl.textContent = formatElapsed(elapsedMs);
  tabIdEl.textContent = String(currentState.tabId ?? "-");
  startedAtEl.textContent = formatTime(currentState.startedAt);
  tabTitleEl.textContent = currentState.title || "Current tab";
  tabDomainEl.textContent = currentState.domain || "Unknown";
  statusTextEl.textContent = currentState.isPaused
    ? "Paused"
    : "Tracking current tab";
  document.body.classList.toggle("paused", Boolean(currentState.isPaused));
  progressBarEl.style.width = `${Math.min(100, (sec % 60) * (100 / 60))}%`;
}
async function loadState() {
  try {
    currentState = await chrome.runtime.sendMessage({
      type: "GET_TIMER_STATE"
    });
  } catch {
    const r = await chrome.storage.local.get(STATE_KEY);
    currentState = r[STATE_KEY] || null;
  }
  render();
}
async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  pauseWhenWindowBlurredEl.checked = Boolean(settings.pauseWhenWindowBlurred);
  showBadgeEl.checked = Boolean(settings.showBadge);
}
async function saveSettings() {
  await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    settings: {
      pauseWhenWindowBlurred: pauseWhenWindowBlurredEl.checked,
      showBadge: showBadgeEl.checked
    }
  });
}
async function resetCurrentTimer() {
  currentState = await chrome.runtime.sendMessage({ type: "RESET_TIMER" });
  render();
}
function startTicker() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(render, 1000);
}
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STATE_KEY]) return;
  currentState = changes[STATE_KEY].newValue;
  render();
});
resetButton.addEventListener("click", resetCurrentTimer);
refreshButton.addEventListener("click", loadState);
pauseWhenWindowBlurredEl.addEventListener("change", saveSettings);
showBadgeEl.addEventListener("change", saveSettings);
loadState();
loadSettings();
startTicker();
