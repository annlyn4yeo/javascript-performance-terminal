import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE } from "../constants";
import type {
  Recommendation,
  ResultSummary,
  MergedScript,
  RuntimeResult,
} from "../types";
import { bytesToKilobytes } from "../utils";

const LARGE_BLOCKING_SCRIPT_BYTES = 150 * BYTES_PER_KILOBYTE;
const ONE_MB = BYTES_PER_MEGABYTE;

const getFilename = (src: string): string => {
  try {
    const url = new URL(src);
    const segments = url.pathname.split("/").filter(Boolean);

    return segments[segments.length - 1] ?? src;
  } catch {
    const normalizedSrc = src.split("?")[0];
    const segments = normalizedSrc.split("/").filter(Boolean);

    return segments[segments.length - 1] ?? src;
  }
};

const sortByPriority = (left: Recommendation, right: Recommendation): number =>
  left.priority - right.priority;

const getSuffix = (count: number): string =>
  count > 1 ? ` (+${count - 1} more)` : "";

const getLargeBlockingRecommendation = (
  scripts: MergedScript[],
): Recommendation | null => {
  const largeBlockingScripts = scripts.filter(
    (script) =>
      script.isBlocking &&
      (script.sizeBytes ?? 0) > LARGE_BLOCKING_SCRIPT_BYTES,
  );

  if (largeBlockingScripts.length === 0) {
    return null;
  }

  const [firstScript] = largeBlockingScripts;
  const sizeKb = bytesToKilobytes(firstScript.sizeBytes ?? 0);
  const filename = getFilename(firstScript.src);

  return {
    priority: 1,
    message: `Defer ${filename}${getSuffix(largeBlockingScripts.length)} (${sizeKb}KB) — it is blocking render and is large enough to significantly delay TTI`,
  };
};

const getUnusedJsRecommendation = (
  summary: ResultSummary,
): Recommendation | null => {
  if (summary.totalUnusedPercent <= 60) {
    return null;
  }

  return {
    priority: 1,
    message: `${Math.round(summary.totalUnusedPercent)}% of loaded JS is never executed — aggressive code splitting could save ${bytesToKilobytes(summary.totalUnusedBytes)}KB`,
  };
};

const getTbtRecommendation = (
  runtime: RuntimeResult,
): Recommendation | null => {
  if (runtime.tbt <= 600) {
    return null;
  }

  return {
    priority: 1,
    message: `Reduce main thread work — Total Blocking Time of ${Math.round(runtime.tbt)}ms will fail Core Web Vitals`,
  };
};

const getBlockingSupportRecommendation = (
  scripts: MergedScript[],
): Recommendation | null => {
  const blockingSupportScripts = scripts.filter(
    (script) => script.isBlocking && script.intent.category === "support",
  );

  if (blockingSupportScripts.length === 0) {
    return null;
  }

  const [firstScript] = blockingSupportScripts;

  return {
    priority: 2,
    message: `${firstScript.intent.label} (${getFilename(firstScript.src)}${getSuffix(blockingSupportScripts.length)}) loads synchronously — chat widgets should always load after interaction`,
  };
};

const getAdScriptsRecommendation = (
  scripts: MergedScript[],
): Recommendation | null => {
  const adScripts = scripts.filter(
    (script) => script.intent.category === "ads",
  );

  if (adScripts.length === 0) {
    return null;
  }

  const adScriptBytes = adScripts.reduce(
    (sum, script) => sum + (script.sizeBytes ?? 0),
    0,
  );

  return {
    priority: 2,
    message: `Ad scripts (${adScripts.length} detected) contribute ${bytesToKilobytes(adScriptBytes)}KB — load with Facade pattern to defer until needed`,
  };
};

const getTotalJsRecommendation = (
  summary: ResultSummary,
): Recommendation | null => {
  if (summary.totalSizeBytes <= ONE_MB) {
    return null;
  }

  return {
    priority: 2,
    message: "Total JS exceeds 1MB — audit and remove unused dependencies",
  };
};

const getSmallBlockingRecommendation = (
  scripts: MergedScript[],
): Recommendation | null => {
  const smallBlockingScripts = scripts.filter(
    (script) =>
      script.isBlocking &&
      (script.sizeBytes ?? Number.POSITIVE_INFINITY) < 10 * BYTES_PER_KILOBYTE,
  );

  if (smallBlockingScripts.length === 0) {
    return null;
  }

  const [firstScript] = smallBlockingScripts;

  return {
    priority: 3,
    message: `Small scripts (${getFilename(firstScript.src)}${getSuffix(smallBlockingScripts.length)}) should use async or defer — synchronous loading is unnecessary at this size`,
  };
};

const getBlockingAnalyticsRecommendation = (
  scripts: MergedScript[],
): Recommendation | null => {
  const blockingAnalyticsScripts = scripts.filter(
    (script) => script.isBlocking && script.intent.category === "analytics",
  );

  if (blockingAnalyticsScripts.length === 0) {
    return null;
  }

  const [firstScript] = blockingAnalyticsScripts;

  return {
    priority: 3,
    message: `${firstScript.intent.label} (${getFilename(firstScript.src)}${getSuffix(blockingAnalyticsScripts.length)}) is blocking — analytics should never block page render`,
  };
};

const getThirdPartyCountRecommendation = (
  summary: ResultSummary,
): Recommendation | null => {
  if (summary.thirdPartyCount <= 8) {
    return null;
  }

  return {
    priority: 3,
    message: `${summary.thirdPartyCount} third-party scripts — each is an external dependency outside your control`,
  };
};

export function getRecommendations(
  scripts: MergedScript[],
  runtime: RuntimeResult,
  summary: ResultSummary,
): Recommendation[] {
  const recommendations = [
    getLargeBlockingRecommendation(scripts),
    getUnusedJsRecommendation(summary),
    getTbtRecommendation(runtime),
    getBlockingSupportRecommendation(scripts),
    getAdScriptsRecommendation(scripts),
    getTotalJsRecommendation(summary),
    getSmallBlockingRecommendation(scripts),
    getBlockingAnalyticsRecommendation(scripts),
    getThirdPartyCountRecommendation(summary),
  ].filter(
    (recommendation): recommendation is Recommendation =>
      recommendation !== null,
  );

  return recommendations.sort(sortByPriority).slice(0, 6);
}
