import type { Page, CDPSession } from "playwright";
import type {
  CDPResults,
  CoverageEntry,
  InjectedLongTask,
  PerformanceMetric,
} from "../types";

type CoverageResponse = {
  result?: unknown;
};

type MetricsResponse = {
  metrics?: unknown;
};

const isCoverageRange = (
  value: unknown,
): value is { startOffset: number; endOffset: number; count: number } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "startOffset" in value &&
    typeof value.startOffset === "number" &&
    "endOffset" in value &&
    typeof value.endOffset === "number" &&
    "count" in value &&
    typeof value.count === "number"
  );
};

const isCoverageFunction = (
  value: unknown,
): value is { functionName: string; ranges: unknown[]; isBlockCoverage: boolean } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "functionName" in value &&
    typeof value.functionName === "string" &&
    "ranges" in value &&
    Array.isArray(value.ranges) &&
    "isBlockCoverage" in value &&
    typeof value.isBlockCoverage === "boolean"
  );
};

const isCoverageEntry = (value: unknown): value is CoverageEntry => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (
    !("scriptId" in value && typeof value.scriptId === "string") ||
    !("url" in value && typeof value.url === "string") ||
    !("functions" in value && Array.isArray(value.functions))
  ) {
    return false;
  }

  return value.functions.every(
    (fn) => isCoverageFunction(fn) && fn.ranges.every((range) => isCoverageRange(range)),
  );
};

const isPerformanceMetric = (value: unknown): value is PerformanceMetric => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "name" in value &&
    typeof value.name === "string" &&
    "value" in value &&
    typeof value.value === "number"
  );
};

const parseCoverageEntries = (value: unknown): CoverageEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  value.forEach((entry: unknown) => {
    if (!isCoverageEntry(entry)) {
      throw new Error("Invalid CDP coverage entry payload");
    }
  });

  return value;
};

const parsePerformanceMetrics = (value: unknown): PerformanceMetric[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  value.forEach((metric: unknown) => {
    if (!isPerformanceMetric(metric)) {
      throw new Error("Invalid CDP metrics payload");
    }
  });

  return value;
};

const isInjectedLongTask = (value: unknown): value is InjectedLongTask => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "duration" in value &&
    typeof value.duration === "number" &&
    "startTime" in value &&
    typeof value.startTime === "number" &&
    "attribution" in value &&
    typeof value.attribution === "string"
  );
};

const parseInjectedLongTasks = (value: unknown): InjectedLongTask[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  value.forEach((task: unknown) => {
    if (!isInjectedLongTask(task)) {
      throw new Error("Invalid injected long-task payload");
    }
  });

  return value;
};

export async function attachCDPHooks(page: Page): Promise<CDPSession> {
  const session = await page.context().newCDPSession(page);

  await session.send("Performance.enable");
  await session.send("Profiler.enable");
  await session.send("Runtime.enable");
  await session.send("Profiler.startPreciseCoverage", {
    callCount: false,
    detailed: true,
  });

  return session;
}

export async function collectCDPResults(page: Page, session: CDPSession): Promise<CDPResults> {
  const coverageResponse: CoverageResponse = await session.send(
    "Profiler.takePreciseCoverage",
  );
  const metricsResponse: MetricsResponse = await session.send(
    "Performance.getMetrics",
  );
  const longTasksRaw: unknown = await page.evaluate(() => window.__longTasks ?? []);

  return {
    coverageResult: parseCoverageEntries(coverageResponse.result),
    metrics: parsePerformanceMetrics(metricsResponse.metrics),
    longTasks: parseInjectedLongTasks(longTasksRaw),
  };
}
