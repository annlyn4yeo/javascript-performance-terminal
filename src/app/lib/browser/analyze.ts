import { devices, type Page } from "playwright";

import { acquirePage, releasePage } from "./pool";
import {
  attachCDPHooks,
  collectCDPResults,
} from "./cdp";
import {
  injectObservers,
  readInjectedData,
} from "./inject";
import type {
  AnalyzeOptions,
  CoverageEntry,
  CoverageRange,
  CoverageResult,
  InjectedLongTask,
  PerformanceMetric,
  RuntimeAnalysisErrorCode,
  RuntimeAnalysisResult,
} from "../types";

export class RuntimeAnalysisError extends Error {
  code: RuntimeAnalysisErrorCode;

  constructor(message: string, code: RuntimeAnalysisErrorCode) {
    super(message);
    this.name = "RuntimeAnalysisError";
    this.code = code;
  }
}

const PIXEL_5 = devices["Pixel 5"];

const getMetricValue = (metrics: PerformanceMetric[], metricName: string): number =>
  metrics.find((metric) => metric.name === metricName)?.value ?? 0;

const secondsToMilliseconds = (value: number): number => value * 1000;

const mergeRanges = (ranges: CoverageRange[]): CoverageRange[] => {
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

const getRangeBytes = (ranges: CoverageRange[]): number =>
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

const getLongestTask = (longTasks: InjectedLongTask[]): InjectedLongTask =>
  longTasks.reduce<InjectedLongTask>(
    (longest, task) => (task.duration > longest.duration ? task : longest),
    { duration: 0, startTime: 0, attribution: "unknown" },
  );

const getTotalBlockingTime = (longTasks: InjectedLongTask[]): number =>
  longTasks.reduce((total, task) => {
    if (task.duration <= 50) {
      return total;
    }

    return total + (task.duration - 50);
  }, 0);

const configureMobileMode = async (page: Page): Promise<void> => {
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
    await options.onProgress?.({ type: "browser-ready" });

    try {
      const navigationStartedAt = Date.now();
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
      await options.onProgress?.({
        type: "page-loaded",
        timeMs: Date.now() - navigationStartedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown navigation error";
      const code =
        typeof message === "string" &&
        (message.toLowerCase().includes("timeout") ||
          message.toLowerCase().includes("timed out"))
          ? "TIMEOUT"
          : "FAILED";
      throw new RuntimeAnalysisError(
        `Failed to load ${url}: navigation timed out or page did not become idle. ${message}`,
        code,
      );
    }

    await page.waitForTimeout(1000);

    const cdpResults = await collectCDPResults(page, session);
    const injectedData = await readInjectedData(page);
    await options.onProgress?.({
      type: "timeline-collected",
      longTaskCount: injectedData.longTasks.length,
    });

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
    const totalCoverageBytes = coverage.reduce(
      (sum, entry) => sum + entry.totalBytes,
      0,
    );
    const totalUnusedBytes = coverage.reduce(
      (sum, entry) => sum + entry.unusedBytes,
      0,
    );
    const unusedPercent =
      totalCoverageBytes > 0
        ? Math.round((totalUnusedBytes / totalCoverageBytes) * 1000) / 10
        : 0;

    await options.onProgress?.({
      type: "coverage-analyzed",
      unusedPercent,
    });

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
