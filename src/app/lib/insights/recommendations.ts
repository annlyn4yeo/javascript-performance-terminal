import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE } from "../constants";
import type {
  Recommendation,
  ResultSummary,
  MergedScript,
  RuntimeResult,
} from "../types";

const LARGE_BLOCKING_SCRIPT_BYTES = 150 * BYTES_PER_KILOBYTE;
const ONE_MB = BYTES_PER_MEGABYTE;

const bytesToKilobytes = (value: number): number =>
  Math.round(value / BYTES_PER_KILOBYTE);

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

export function getRecommendations(
  scripts: MergedScript[],
  runtime: RuntimeResult,
  summary: ResultSummary,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const largeBlockingScripts = scripts.filter(
    (script) =>
      script.isBlocking && (script.sizeBytes ?? 0) > LARGE_BLOCKING_SCRIPT_BYTES,
  );

  if (largeBlockingScripts.length > 0) {
    const [firstScript] = largeBlockingScripts;
    const sizeKb = bytesToKilobytes(firstScript.sizeBytes ?? 0);
    const filename = getFilename(firstScript.src);
    const suffix =
      largeBlockingScripts.length > 1
        ? ` (+${largeBlockingScripts.length - 1} more)`
        : "";

    recommendations.push({
      priority: 1,
      message: `Defer ${filename}${suffix} (${sizeKb}KB) — it is blocking render and is large enough to significantly delay TTI`,
    });
  }

  if (summary.totalUnusedPercent > 60) {
    recommendations.push({
      priority: 1,
      message: `${Math.round(summary.totalUnusedPercent)}% of loaded JS is never executed — aggressive code splitting could save ${bytesToKilobytes(summary.totalUnusedBytes)}KB`,
    });
  }

  if (runtime.tbt > 600) {
    recommendations.push({
      priority: 1,
      message: `Reduce main thread work — Total Blocking Time of ${Math.round(runtime.tbt)}ms will fail Core Web Vitals`,
    });
  }

  const blockingSupportScripts = scripts.filter(
    (script) => script.isBlocking && script.intent.category === "support",
  );

  if (blockingSupportScripts.length > 0) {
    const [firstScript] = blockingSupportScripts;
    const suffix =
      blockingSupportScripts.length > 1
        ? ` (+${blockingSupportScripts.length - 1} more)`
        : "";

    recommendations.push({
      priority: 2,
      message: `${firstScript.intent.label} (${getFilename(firstScript.src)}${suffix}) loads synchronously — chat widgets should always load after interaction`,
    });
  }

  const adScripts = scripts.filter((script) => script.intent.category === "ads");

  if (adScripts.length > 0) {
    const adScriptBytes = adScripts.reduce(
      (sum, script) => sum + (script.sizeBytes ?? 0),
      0,
    );

    recommendations.push({
      priority: 2,
      message: `Ad scripts (${adScripts.length} detected) contribute ${bytesToKilobytes(adScriptBytes)}KB — load with Facade pattern to defer until needed`,
    });
  }

  if (summary.totalSizeBytes > ONE_MB) {
    recommendations.push({
      priority: 2,
      message:
        "Total JS exceeds 1MB — audit and remove unused dependencies",
    });
  }

  const smallBlockingScripts = scripts.filter(
    (script) =>
      script.isBlocking &&
      (script.sizeBytes ?? Number.POSITIVE_INFINITY) < 10 * BYTES_PER_KILOBYTE,
  );

  if (smallBlockingScripts.length > 0) {
    const [firstScript] = smallBlockingScripts;
    const suffix =
      smallBlockingScripts.length > 1
        ? ` (+${smallBlockingScripts.length - 1} more)`
        : "";

    recommendations.push({
      priority: 3,
      message: `Small scripts (${getFilename(firstScript.src)}${suffix}) should use async or defer — synchronous loading is unnecessary at this size`,
    });
  }

  const blockingAnalyticsScripts = scripts.filter(
    (script) => script.isBlocking && script.intent.category === "analytics",
  );

  if (blockingAnalyticsScripts.length > 0) {
    const [firstScript] = blockingAnalyticsScripts;
    const suffix =
      blockingAnalyticsScripts.length > 1
        ? ` (+${blockingAnalyticsScripts.length - 1} more)`
        : "";

    recommendations.push({
      priority: 3,
      message: `${firstScript.intent.label} (${getFilename(firstScript.src)}${suffix}) is blocking — analytics should never block page render`,
    });
  }

  if (summary.thirdPartyCount > 8) {
    recommendations.push({
      priority: 3,
      message: `${summary.thirdPartyCount} third-party scripts — each is an external dependency outside your control`,
    });
  }

  return recommendations.sort(sortByPriority).slice(0, 6);
}
