import { BYTES_PER_KILOBYTE } from "./constants";
import type { CoverageResult } from "./types";
import type {
  MeasuredScriptTag,
  MergeResultsOutput,
  MergeSummary,
  MergedScript,
  RuntimeAnalysisResult,
} from "./types";
import { classifyScript } from "./insights/classifyScript";

export type EnrichedScriptTag = MeasuredScriptTag;
export type RuntimeResult = RuntimeAnalysisResult;

const CRITICAL_SCRIPT_SIZE_BYTES = 100 * BYTES_PER_KILOBYTE;

const getRiskLevel = (
  isBlocking: boolean,
  sizeBytes: number | null,
  unusedPercent: number | null,
): MergedScript["riskLevel"] => {
  if (isBlocking && (sizeBytes ?? 0) > CRITICAL_SCRIPT_SIZE_BYTES) {
    return "critical";
  }

  if (isBlocking || (unusedPercent ?? 0) > 50) {
    return "warning";
  }

  return "ok";
};

export function mergeResults(
  staticScripts: EnrichedScriptTag[],
  coverage: CoverageResult[],
): MergeResultsOutput {
  const coverageByUrl = new Map(coverage.map((entry) => [entry.url, entry]));

  const scripts = staticScripts
    .filter((script) => script.src !== null)
    .map<MergedScript>((script) => {
      const coverageEntry = coverageByUrl.get(script.absoluteUrl);
      const isBlocking = !script.isAsync && !script.isDeferred;
      const unusedPercent = coverageEntry?.unusedPercent ?? null;

      return {
        src: script.src ?? script.absoluteUrl,
        host: script.host,
        isThirdParty: script.isThirdParty,
        isAsync: script.isAsync,
        isDeferred: script.isDeferred,
        isModule: script.isModule,
        sizeBytes: script.sizeBytes,
        sizePretty: script.sizePretty,
        usedBytes: coverageEntry?.usedBytes ?? null,
        unusedBytes: coverageEntry?.unusedBytes ?? null,
        unusedPercent,
        intent: classifyScript({ src: script.src ?? script.absoluteUrl }),
        isBlocking,
        riskLevel: getRiskLevel(isBlocking, script.sizeBytes, unusedPercent),
      };
    });

  const totalSizeBytes = scripts.reduce((sum, script) => sum + (script.sizeBytes ?? 0), 0);
  const totalUnusedBytes = scripts.reduce((sum, script) => sum + (script.unusedBytes ?? 0), 0);
  const blockingCount = scripts.filter((script) => script.isBlocking).length;
  const thirdPartyCount = scripts.filter((script) => script.isThirdParty).length;
  const criticalCount = scripts.filter((script) => script.riskLevel === "critical").length;

  const summary: MergeSummary = {
    totalScripts: scripts.length,
    totalSizeBytes,
    totalUnusedBytes,
    totalUnusedPercent: totalSizeBytes > 0 ? Math.round((totalUnusedBytes / totalSizeBytes) * 1000) / 10 : 0,
    blockingCount,
    thirdPartyCount,
    criticalCount,
  };

  return {
    scripts,
    summary,
  };
}
