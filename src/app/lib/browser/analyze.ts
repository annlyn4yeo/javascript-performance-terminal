import { devices, type Page } from "playwright";

import { acquirePage, releasePage } from "./pool";
import {
  attachCDPHooks,
  collectCDPResults,
  type CoverageEntry,
  type PerformanceMetric,
} from "./cdp";
import {
  injectObservers,
  readInjectedData,
  type InjectedLongTask,
} from "./inject";

export type AnalyzeOptions = {
  mobile?: boolean;
};

export type CoverageResult = {
  url: string;
  totalBytes: number;
  usedBytes: number;
  unusedBytes: number;
  unusedPercent: number;
};

export type RuntimeAnalysisResult = {
  fcp: number;
  tti: number;
  tbt: number;
  hydrationGap: number;
  scriptDuration: number;
  layoutDuration: number;
  longTasks: InjectedLongTask[];
  longestTask: InjectedLongTask;
  coverage: CoverageResult[];
};

const PIXEL_5 = devices["Pixel 5"];

const getMetricValue = (metrics: PerformanceMetric[], metricName: string) =>
  metrics.find((metric) => metric.name === metricName)?.value ?? 0;

const secondsToMilliseconds = (value: number) => value * 1000;

const mergeRanges = (
  ranges: Array<{ startOffset: number; endOffset: number }>,
) => {
  if (ranges.length === 0) {
    return [];
  }

  const sortedRanges = [...ranges].sort(
    (left, right) => left.startOffset - right.startOffset,
  );
  const mergedRanges = [sortedRanges[0]];

  for (const range of sortedRanges.slice(1)) {
    const current = mergedRanges[mergedRanges.length - 1];

    if (range.startOffset <= current.endOffset) {
      current.endOffset = Math.max(current.endOffset, range.endOffset);
      continue;
    }

    mergedRanges.push({ ...range });
  }

  return mergedRanges;
};

const getRangeBytes = (
  ranges: Array<{ startOffset: number; endOffset: number }>,
) =>
  ranges.reduce(
    (total, range) => total + (range.endOffset - range.startOffset),
    0,
  );

const buildCoverageResult = (entry: CoverageEntry): CoverageResult => {
  const allRanges = entry.functions.flatMap((fn) =>
    fn.ranges.map((range) => ({
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    })),
  );

  const usedRanges = entry.functions.flatMap((fn) =>
    fn.ranges
      .filter((range) => range.count > 0)
      .map((range) => ({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
      })),
  );

  const totalBytes = getRangeBytes(mergeRanges(allRanges));
  const usedBytes = getRangeBytes(mergeRanges(usedRanges));
  const unusedBytes = Math.max(0, totalBytes - usedBytes);
  const unusedPercent =
    totalBytes > 0 ? Math.round((unusedBytes / totalBytes) * 1000) / 10 : 0;

  return {
    url: entry.url,
    totalBytes,
    usedBytes,
    unusedBytes,
    unusedPercent,
  };
};

const getLongestTask = (longTasks: InjectedLongTask[]) =>
  longTasks.reduce<InjectedLongTask>(
    (longest, task) => (task.duration > longest.duration ? task : longest),
    { duration: 0, startTime: 0, attribution: "unknown" },
  );

const getTotalBlockingTime = (longTasks: InjectedLongTask[]) =>
  longTasks.reduce((total, task) => {
    if (task.duration <= 50) {
      return total;
    }

    return total + (task.duration - 50);
  }, 0);

const configureMobileMode = async (page: Page) => {
  await page.setViewportSize(PIXEL_5.viewport);

  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Emulation.setUserAgentOverride", {
    userAgent: PIXEL_5.userAgent,
  });
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: PIXEL_5.viewport.width,
    height: PIXEL_5.viewport.height,
    deviceScaleFactor: PIXEL_5.deviceScaleFactor,
    mobile: true,
    screenWidth: PIXEL_5.viewport.width,
    screenHeight: PIXEL_5.viewport.height,
  });
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
  });
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.5 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 40,
  });
};

export async function analyzeRuntime(
  url: string,
  options: AnalyzeOptions = { mobile: false },
): Promise<RuntimeAnalysisResult> {
  const page = await acquirePage();

  try {
    if (options.mobile) {
      await configureMobileMode(page);
    }

    await page.addInitScript(injectObservers());
    const session = await attachCDPHooks(page);

    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown navigation error";
      throw new Error(
        `Failed to load ${url}: navigation timed out or page did not become idle. ${message}`,
      );
    }

    await page.waitForTimeout(1000);

    const cdpResults = await collectCDPResults(page, session);
    const injectedData = await readInjectedData(page);

    const fcp = secondsToMilliseconds(
      getMetricValue(cdpResults.metrics, "FirstContentfulPaint"),
    );
    const tti = secondsToMilliseconds(
      getMetricValue(cdpResults.metrics, "InteractiveTime"),
    );
    const scriptDuration = secondsToMilliseconds(
      getMetricValue(cdpResults.metrics, "ScriptDuration"),
    );
    const layoutDuration = secondsToMilliseconds(
      getMetricValue(cdpResults.metrics, "LayoutDuration"),
    );
    const longTasks = injectedData.longTasks;
    const tbt = getTotalBlockingTime(longTasks);
    const longestTask = getLongestTask(longTasks);
    const coverage = cdpResults.coverageResult
      .filter((entry) => entry.url)
      .map(buildCoverageResult);

    return {
      fcp,
      tti,
      tbt,
      hydrationGap: Math.max(0, tti - fcp),
      scriptDuration,
      layoutDuration,
      longTasks,
      longestTask,
      coverage,
    };
  } finally {
    await releasePage(page);
  }
}
