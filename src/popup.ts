import type { RuntimeRequest, RuntimeResponse, UsageSummary } from "./messages";
import type { LimitStatus, PopupTabUsage, UsageSettings } from "./tracker";
import { formatDuration } from "./tracker";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("Popup root element is missing");
}

const sendMessage = async (request: RuntimeRequest): Promise<RuntimeResponse> =>
  await chrome.runtime.sendMessage(request);

const hostnameFromUrl = (url: string): string => {
  if (url.length === 0) {
    return "chrome tab";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const percentOfLongest = (durationMs: number, longestMs: number): number => {
  if (longestMs <= 0) {
    return 0;
  }

  return Math.max(6, Math.round((durationMs / longestMs) * 100));
};

const minutesFromMs = (durationMs: number): number => Math.round(durationMs / 60_000);

const msFromInput = (value: string, fallbackMs: number): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallbackMs;
  }

  return Math.round(parsed * 60_000);
};

const statusLabel = (status: LimitStatus, remainingMs: number): string => {
  if (status === "exceeded") {
    return "Over limit";
  }

  if (status === "warning") {
    return `${formatDuration(remainingMs)} left`;
  }

  return "On track";
};

const isEditingSettings = (): boolean =>
  document.activeElement instanceof HTMLInputElement &&
  document.activeElement.classList.contains("setting-input");

const renderTabRow = (tab: PopupTabUsage, index: number, highestUsageMs: number): string => `
  <li class="tab-row ${tab.isActive ? "is-active" : ""} is-${tab.limitStatus}" data-tab-id="${tab.tabId}" data-window-id="${tab.windowId}" tabindex="0" role="button" aria-label="Open ${escapeHtml(tab.title)}">
    <div class="tab-topline">
      <div class="identity">
        <div class="rank">${index + 1}</div>
        <div class="favicon-frame">
          <img class="favicon" src="${escapeHtml(tab.favIconUrl ?? "")}" alt="" />
        </div>
      </div>
      <div class="row-actions">
        <time>${formatDuration(tab.displayMs)}</time>
        <button class="close-tab-button" type="button" data-close-tab-id="${tab.tabId}" aria-label="Close ${escapeHtml(tab.title)}" title="Close tab">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5" />
          </svg>
        </button>
      </div>
    </div>
    <div class="tab-meta">
      <div class="title-line">
        <strong>${escapeHtml(tab.title)}</strong>
        <span class="limit-chip">${statusLabel(tab.limitStatus, tab.remainingMs)}</span>
        ${tab.isActive ? '<span class="active-chip">Active</span>' : ""}
      </div>
      <span>${escapeHtml(hostnameFromUrl(tab.url))}</span>
    </div>
    <div class="usage-track" aria-hidden="true">
      <span style="width: ${Math.max(percentOfLongest(tab.displayMs, highestUsageMs), tab.limitPercent)}%"></span>
    </div>
  </li>
`;

const renderEmpty = (): void => {
  app.innerHTML = `
    <section class="shell">
      <header class="hero hero-empty">
        <div class="brand-mark" aria-hidden="true">
          <span></span>
        </div>
        <div class="hero-copy">
          <p class="eyebrow">Tab Times</p>
          <h1>Waiting for activity</h1>
          <p class="hero-subtitle">Open a few tabs and switch between them to start tracking focused time.</p>
        </div>
      </header>
      <div class="empty-state">
        <div class="empty-visual">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p>Your visited tabs will appear here, ranked by active time.</p>
      </div>
    </section>
  `;
};

const renderUsage = (summary: UsageSummary): void => {
  if (summary.tabs.length === 0) {
    renderEmpty();
    return;
  }

  const highestUsageMs = Math.max(...summary.tabs.map((tab) => tab.displayMs));
  const { maxTabMs, warningBeforeMs }: UsageSettings = summary.settings;

  app.innerHTML = `
    <section class="shell">
      <header class="hero">
        <div class="brand-mark" aria-hidden="true">
          <span></span>
        </div>
        <div class="hero-copy">
          <p class="eyebrow">Tab Times</p>
          <h1>${formatDuration(summary.totalMs)}</h1>
          <p class="hero-subtitle">Total active time across tracked tabs</p>
        </div>
        <button class="reset-button" type="button" title="Reset tracked time">Reset</button>
      </header>

      <section class="metrics" aria-label="Tracking summary">
        <div>
          <span>${summary.activeTabCount}</span>
          <p>Tracked tabs</p>
        </div>
        <div>
          <span>${formatDuration(highestUsageMs)}</span>
          <p>Longest session</p>
        </div>
      </section>

      <section class="settings-panel" aria-label="Usage limit settings">
        <div>
          <p class="settings-kicker">Limit guard</p>
          <strong>Per-tab focus limit</strong>
        </div>
        <label>
          <span>Limit</span>
          <input class="setting-input" data-setting="maxTabMs" type="number" min="1" step="5" value="${minutesFromMs(maxTabMs)}" />
          <em>min</em>
        </label>
        <label>
          <span>Warn</span>
          <input class="setting-input" data-setting="warningBeforeMs" type="number" min="0" step="1" value="${minutesFromMs(warningBeforeMs)}" />
          <em>min before</em>
        </label>
      </section>

      <div class="list-heading">
        <span>Ranked tabs</span>
        <span>Live</span>
      </div>

      <ol class="tab-list">
        ${summary.tabs.map((tab, index) => renderTabRow(tab, index, highestUsageMs)).join("")}
      </ol>
    </section>
  `;

  app.querySelector(".reset-button")?.addEventListener("click", () => {
    void resetUsage();
  });

  app.querySelectorAll<HTMLButtonElement>(".close-tab-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void closeTrackedTab(button);
    });
  });

  app.querySelectorAll<HTMLInputElement>(".setting-input").forEach((input) => {
    input.addEventListener("change", () => {
      void updateSettings();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      input.blur();
      void updateSettings();
    });
  });

  app.querySelectorAll<HTMLElement>(".tab-row").forEach((row) => {
    row.addEventListener("click", () => {
      void focusTrackedTab(row);
    });

    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      void focusTrackedTab(row);
    });
  });
};

const renderError = (message: string): void => {
  app.innerHTML = `
    <section class="shell">
      <header class="hero hero-empty">
        <div class="brand-mark" aria-hidden="true">
          <span></span>
        </div>
        <div class="hero-copy">
          <p class="eyebrow">Tab Times</p>
          <h1>Something needs attention</h1>
        </div>
      </header>
      <p class="error">${message}</p>
    </section>
  `;
};

const loadUsage = async (): Promise<void> => {
  const response = await sendMessage({ type: "GET_USAGE" });

  if (!response.ok) {
    renderError(response.error);
    return;
  }

  if (!("summary" in response)) {
    renderError("The background service returned an unexpected usage response.");
    return;
  }

  renderUsage(response.summary);
};

const resetUsage = async (): Promise<void> => {
  const button = app.querySelector<HTMLButtonElement>(".reset-button");

  if (button !== null) {
    button.disabled = true;
    button.textContent = "Resetting";
  }

  const response = await sendMessage({ type: "RESET_USAGE" });

  if (!response.ok) {
    renderError(response.error);
    return;
  }

  await loadUsage();
};

const updateSettings = async (): Promise<void> => {
  const maxInput = app.querySelector<HTMLInputElement>('[data-setting="maxTabMs"]');
  const warningInput = app.querySelector<HTMLInputElement>('[data-setting="warningBeforeMs"]');

  if (maxInput === null || warningInput === null) {
    return;
  }

  const response = await sendMessage({
    type: "UPDATE_SETTINGS",
    settings: {
      maxTabMs: msFromInput(maxInput.value, 60 * 60 * 1000),
      warningBeforeMs: msFromInput(warningInput.value, 10 * 60 * 1000)
    }
  });

  if (!response.ok) {
    renderError(response.error);
    return;
  }

  await loadUsage();
};

const focusTrackedTab = async (row: HTMLElement): Promise<void> => {
  const tabId = Number(row.dataset.tabId);
  const windowId = Number(row.dataset.windowId);

  if (!Number.isInteger(tabId) || !Number.isInteger(windowId)) {
    renderError("This tracked tab is missing navigation details.");
    return;
  }

  row.classList.add("is-opening");

  const response = await sendMessage({ type: "FOCUS_TAB", tabId, windowId });

  if (!response.ok) {
    row.classList.remove("is-opening");
    renderError(response.error);
    return;
  }

  row.classList.remove("is-opening");
};

const closeTrackedTab = async (button: HTMLButtonElement): Promise<void> => {
  const tabId = Number(button.dataset.closeTabId);

  if (!Number.isInteger(tabId)) {
    renderError("This tracked tab is missing close details.");
    return;
  }

  button.disabled = true;
  const response = await sendMessage({ type: "CLOSE_TAB", tabId });

  if (!response.ok) {
    renderError(response.error);
    return;
  }

  await loadUsage();
};

void loadUsage();
window.setInterval(() => {
  if (isEditingSettings()) {
    return;
  }

  void loadUsage();
}, 1_000);
