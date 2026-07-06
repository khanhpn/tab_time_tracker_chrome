import {
  activateTab,
  createInitialState,
  formatDuration,
  getLimitStatus,
  getSortedUsage,
  keepOnlyOpenTabs,
  normalizeSettings,
  removeTabsFromState,
  resetStateToActiveTab,
  resetState
} from "../src/tracker";

describe("tab usage tracker", () => {
  it("accumulates time only for the active tab and resumes previous totals", () => {
    let state = createInitialState();

    state = activateTab(state, { tabId: 1, windowId: 1, title: "Docs" }, 1_000);
    state = activateTab(state, { tabId: 2, windowId: 1, title: "Mail" }, 6_000);
    state = activateTab(state, { tabId: 1, windowId: 1, title: "Docs" }, 9_000);

    const usage = getSortedUsage(state, 11_000);

    expect(usage.map((tab) => [tab.title, tab.displayMs, tab.isActive])).toEqual([
      ["Docs", 7_000, true],
      ["Mail", 3_000, false]
    ]);
  });

  it("sorts tabs by the highest usage time", () => {
    let state = createInitialState();

    state = activateTab(state, { tabId: 1, windowId: 1, title: "Short" }, 0);
    state = activateTab(state, { tabId: 2, windowId: 1, title: "Long" }, 1_000);

    expect(getSortedUsage(state, 6_000).map((tab) => tab.title)).toEqual(["Long", "Short"]);
  });

  it("keeps the current active tab first even when another tab has more time", () => {
    let state = createInitialState();

    state = activateTab(state, { tabId: 1, windowId: 1, title: "Long old tab" }, 0);
    state = activateTab(state, { tabId: 2, windowId: 1, title: "Current tab" }, 10_000);

    expect(getSortedUsage(state, 11_000).map((tab) => [tab.title, tab.isActive])).toEqual([
      ["Current tab", true],
      ["Long old tab", false]
    ]);
  });

  it("marks tabs as warning or exceeded based on usage settings", () => {
    const settings = { maxTabMs: 60_000, warningBeforeMs: 10_000 };
    let state = createInitialState();

    state = activateTab(state, { tabId: 1, windowId: 1, title: "Normal" }, 0);
    state = activateTab(state, { tabId: 2, windowId: 1, title: "Warning" }, 20_000);
    state = activateTab(state, { tabId: 3, windowId: 1, title: "Exceeded" }, 75_000);

    const usageByTitle = new Map(
      getSortedUsage(state, 140_000, settings).map((tab) => [tab.title, tab])
    );

    expect(usageByTitle.get("Normal")?.limitStatus).toBe("normal");
    expect(usageByTitle.get("Warning")?.limitStatus).toBe("warning");
    expect(usageByTitle.get("Exceeded")?.limitStatus).toBe("exceeded");
    expect(usageByTitle.get("Exceeded")?.limitPercent).toBe(100);
  });

  it("normalizes usage settings with a one minute minimum and warning capped at max", () => {
    expect(normalizeSettings({ maxTabMs: 30_000, warningBeforeMs: 120_000 })).toEqual({
      maxTabMs: 60_000,
      warningBeforeMs: 60_000
    });
    expect(getLimitStatus(50_000, { maxTabMs: 60_000, warningBeforeMs: 10_000 })).toBe("warning");
  });

  it("removes tracked tabs from state and resets everything to zero", () => {
    let state = createInitialState();

    state = activateTab(state, { tabId: 1, windowId: 1, title: "One" }, 0);
    state = activateTab(state, { tabId: 2, windowId: 1, title: "Two" }, 1_000);
    state = removeTabsFromState(state, [1]);

    expect(getSortedUsage(state, 2_000).map((tab) => tab.tabId)).toEqual([2]);
    expect(resetState()).toEqual(createInitialState());
  });

  it("drops tracked tabs that no longer exist", () => {
    let state = createInitialState();

    state = activateTab(state, { tabId: 1, windowId: 1, title: "Closed tab" }, 0);
    state = activateTab(state, { tabId: 2, windowId: 1, title: "Open tab" }, 1_000);

    const reconciled = keepOnlyOpenTabs(state, [2]);

    expect(Object.keys(reconciled.tabs)).toEqual(["2"]);
    expect(reconciled.activeTabId).toBe(2);
  });

  it("resets old totals and starts tracking the current active tab from zero", () => {
    let state = createInitialState();

    state = activateTab(state, { tabId: 1, windowId: 1, title: "Old tab" }, 0);
    state = activateTab(state, { tabId: 2, windowId: 1, title: "Current tab" }, 5_000);
    state = resetStateToActiveTab(state, { tabId: 2, windowId: 1, title: "Current tab" }, 10_000);

    expect(getSortedUsage(state, 10_000)).toEqual([
      {
        tabId: 2,
        windowId: 1,
        title: "Current tab",
        url: "",
        favIconUrl: undefined,
        accumulatedMs: 0,
        lastActivatedAt: 10_000,
        displayMs: 0,
        isActive: true,
        limitStatus: "normal",
        limitPercent: 0,
        remainingMs: 3_600_000
      }
    ]);
    expect(getSortedUsage(state, 12_500)[0]?.displayMs).toBe(2_500);
  });

  it("formats durations for compact popup display", () => {
    expect(formatDuration(9_000)).toBe("9s");
    expect(formatDuration(65_000)).toBe("1m 05s");
    expect(formatDuration(3_660_000)).toBe("1h 01m");
  });
});
