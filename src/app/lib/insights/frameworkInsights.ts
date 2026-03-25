import { BYTES_PER_KILOBYTE } from "../constants";
import type { DetectedFramework, Insight, MergedScript, RuntimeResult } from "../types";

const bytesToKilobytes = (value: number): number =>
  Math.round(value / BYTES_PER_KILOBYTE);

const hasCodeSplitScript = (scripts: MergedScript[]): boolean =>
  scripts.some((script) => {
    const normalizedSrc = script.src.toLowerCase();

    return normalizedSrc.includes("chunk") || normalizedSrc.includes("lazy");
  });

const getTotalSizeBytes = (scripts: MergedScript[]): number =>
  scripts.reduce((sum, script) => sum + (script.sizeBytes ?? 0), 0);

const getBlockingCount = (scripts: MergedScript[]): number =>
  scripts.filter((script) => script.isBlocking).length;

const getHydrationGapInsight = (
  hydrationGap: number,
  criticalThreshold: number,
  warningThreshold: number,
): Insight | null => {
  if (hydrationGap > criticalThreshold) {
    return {
      level: "critical",
      message: `Hydration gap is ${Math.round(hydrationGap)}ms — users see content but cannot interact for over 2 seconds`,
    };
  }

  if (hydrationGap > warningThreshold) {
    return {
      level: "warning",
      message: `Hydration gap of ${Math.round(hydrationGap)}ms detected between FCP and TTI`,
    };
  }

  return null;
};

export function getFrameworkInsights(
  framework: DetectedFramework,
  runtime: RuntimeResult,
  scripts: MergedScript[],
): Insight[] {
  const insights: Insight[] = [];
  const totalSizeBytes = getTotalSizeBytes(scripts);
  const blockingCount = getBlockingCount(scripts);
  const frameworkName = framework.name;

  if (frameworkName === "Next.js" || frameworkName === "React") {
    const hydrationInsight = getHydrationGapInsight(
      runtime.hydrationGap,
      2000,
      800,
    );

    if (hydrationInsight) {
      insights.push(hydrationInsight);
    }

    if (!hasCodeSplitScript(scripts)) {
      insights.push({
        level: "warning",
        message:
          "No code splitting detected — entire JS bundle loads on every page",
      });
    }

    if (framework.meta === "Pages Router") {
      insights.push({
        level: "info",
        message:
          "Running Pages Router — consider App Router for improved streaming and partial rendering",
      });
    }
  }

  if (frameworkName === "Nuxt" || frameworkName === "Vue") {
    const hydrationInsight = getHydrationGapInsight(
      runtime.hydrationGap,
      1500,
      800,
    );

    if (hydrationInsight) {
      insights.push(hydrationInsight);
    }

    const eagerStoreBundle = scripts.find((script) => {
      const normalizedSrc = script.src.toLowerCase();

      return (
        (normalizedSrc.includes("vuex") || normalizedSrc.includes("pinia")) &&
        (script.sizeBytes ?? 0) > 50 * BYTES_PER_KILOBYTE
      );
    });

    if (eagerStoreBundle?.sizeBytes) {
      insights.push({
        level: "warning",
        message: `Store bundle (${bytesToKilobytes(eagerStoreBundle.sizeBytes)}KB) is loading eagerly — consider lazy-loading store modules`,
      });
    }
  }

  if (frameworkName === "Angular") {
    const zoneScript = scripts.find((script) =>
      script.src.toLowerCase().includes("zone.js"),
    );

    if (zoneScript?.sizeBytes) {
      insights.push({
        level: "warning",
        message: `zone.js detected (${bytesToKilobytes(zoneScript.sizeBytes)}KB) — adds overhead to all async operations. Zoneless Angular is available in v18+`,
      });
    } else if (zoneScript) {
      insights.push({
        level: "warning",
        message:
          "zone.js detected — adds overhead to all async operations. Zoneless Angular is available in v18+",
      });
    }

    if (totalSizeBytes > 500 * BYTES_PER_KILOBYTE) {
      insights.push({
        level: "critical",
        message:
          "Total JS exceeds 500KB — Angular bundles benefit significantly from route-level lazy loading",
      });
    }
  }

  if (frameworkName === "SvelteKit" && totalSizeBytes > 200 * BYTES_PER_KILOBYTE) {
    insights.push({
      level: "warning",
      message: `Svelte bundles are typically under 50KB — ${bytesToKilobytes(totalSizeBytes)}KB suggests imported dependencies are large`,
    });
  }

  if (frameworkName === "jQuery") {
    const jqueryScripts = scripts.filter((script) =>
      script.src.toLowerCase().includes("jquery"),
    );

    if (jqueryScripts.length > 1) {
      insights.push({
        level: "critical",
        message:
          "Multiple jQuery versions detected — this causes conflicts and doubles the load cost",
      });
    }

    if (
      jqueryScripts.some(
        (script) => !script.src.toLowerCase().includes(".min."),
      )
    ) {
      insights.push({
        level: "warning",
        message:
          "Unminified jQuery detected — always use the minified build in production",
      });
    }
  }

  if (frameworkName === "Unknown" && blockingCount > 3) {
    insights.push({
      level: "critical",
      message: `${blockingCount} blocking scripts in <head> with no framework optimisation layer — consider async/defer on all`,
    });
  }

  if (runtime.tbt > 600) {
    insights.push({
      level: "critical",
      message: `Total Blocking Time of ${Math.round(runtime.tbt)}ms will cause significant input delay on mid-range devices`,
    });
  } else if (runtime.tbt > 300) {
    insights.push({
      level: "warning",
      message: `Total Blocking Time of ${Math.round(runtime.tbt)}ms — aim for under 200ms`,
    });
  }

  if (runtime.longestTask.duration > 500) {
    insights.push({
      level: "critical",
      message: `A single task ran for ${Math.round(runtime.longestTask.duration)}ms — the main thread was completely frozen for half a second`,
    });
  }

  return insights;
}
