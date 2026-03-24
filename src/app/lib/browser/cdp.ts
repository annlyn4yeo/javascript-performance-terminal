import type { Page, CDPSession } from "playwright";

export type CoverageEntry = {
  scriptId: string;
  url: string;
  functions: Array<{
    functionName: string;
    ranges: Array<{
      startOffset: number;
      endOffset: number;
      count: number;
    }>;
    isBlockCoverage: boolean;
  }>;
};

export type PerformanceMetric = {
  name: string;
  value: number;
};

export type LongTask = {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
};

export type CDPResults = {
  coverageResult: CoverageEntry[];
  metrics: PerformanceMetric[];
  longTasks: LongTask[];
};

declare global {
  interface Window {
    __longTasks?: LongTask[];
  }
}

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
  const coverageResponse = await session.send("Profiler.takePreciseCoverage");
  const metricsResponse = await session.send("Performance.getMetrics");
  const longTasks = await page.evaluate(() => window.__longTasks ?? []);

  return {
    coverageResult: coverageResponse.result as CoverageEntry[],
    metrics: metricsResponse.metrics as PerformanceMetric[],
    longTasks,
  };
}
