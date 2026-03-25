import type { MergedScript } from "@/app/lib/mergeResults";
import {
  DIVIDER_LINE,
  formatBytesPretty,
  isMergedScriptArray,
  padCell,
} from "@/app/lib/terminal/format";
import type { ResultsPayload } from "@/app/lib/terminal/types";

type ResultsBlocksProps = {
  resultsPayload: ResultsPayload | null;
};

const scriptRiskClass = (riskLevel: MergedScript["riskLevel"]) => {
  if (riskLevel === "critical") {
    return "text-[#EF4444]";
  }

  if (riskLevel === "warning") {
    return "text-[#F59E0B]";
  }

  return "text-foreground";
};

const insightLevelClass = (
  level: "critical" | "warning" | "info",
) => {
  if (level === "critical") {
    return "text-[#EF4444]";
  }

  if (level === "warning") {
    return "text-[#F59E0B]";
  }

  return "text-[#777777]";
};

const recommendationPriorityClass = (priority: 1 | 2 | 3) => {
  if (priority === 1) {
    return "text-[#EF4444]";
  }

  if (priority === 2) {
    return "text-[#F59E0B]";
  }

  return "text-foreground";
};

const intentClass = (category: MergedScript["intent"]["category"]) => {
  if (category === "framework") {
    return "text-[#6366F1]";
  }

  if (category === "analytics") {
    return "text-[#EC4899]";
  }

  if (category === "ab-testing") {
    return "text-[#8B5CF6]";
  }

  if (category === "payments") {
    return "text-[#22C55E]";
  }

  if (category === "ads") {
    return "text-[#EF4444]";
  }

  if (category === "support") {
    return "text-[#3B82F6]";
  }

  if (category === "monitoring") {
    return "text-[#F59E0B]";
  }

  if (category === "cdn") {
    return "text-[#555555]";
  }

  return "text-[#333333]";
};

export function ResultsBlocks({ resultsPayload }: ResultsBlocksProps) {
  if (!resultsPayload || !resultsPayload.runtime || !resultsPayload.summary) {
    return null;
  }

  if (!isMergedScriptArray(resultsPayload.scripts)) {
    return null;
  }

  const { runtime, summary, scripts } = resultsPayload;
  const totalSizePretty = formatBytesPretty(summary.totalSizeBytes);
  const unusedPretty = formatBytesPretty(summary.totalUnusedBytes);

  return (
    <>
      <div className="min-h-7 whitespace-pre-wrap break-words">{DIVIDER_LINE}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words"> </div>
      <div className="min-h-7 whitespace-pre-wrap break-words">OVERVIEW</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`Total JS Weight        ${totalSizePretty}`}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`Total Blocking Time    ${Math.round(runtime.tbt)}ms`}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`Time to Interactive    ${Math.round(runtime.tti)}ms`}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`First Contentful Paint ${Math.round(runtime.fcp)}ms`}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`Hydration Gap          ${Math.round(runtime.hydrationGap)}ms`}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`Unused JS              ${summary.totalUnusedPercent}%  (${unusedPretty} never executed)`}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`Long Tasks             ${runtime.longTasks.length} detected  (longest: ${Math.round(runtime.longestTask.duration)}ms)`}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`Third-party Scripts    ${summary.thirdPartyCount} of ${summary.totalScripts}`}</div>
      <div className="min-h-7 whitespace-pre-wrap break-words"> </div>
      <div className="min-h-7 whitespace-pre-wrap break-words">SCRIPTS TABLE</div>
      <div className="min-h-7 whitespace-pre-wrap break-words">{`${padCell("SCRIPT", 20)}${padCell("HOST", 20)}${padCell("INTENT", 13)}${padCell("SIZE", 10)}${padCell("UNUSED", 10)}STATUS`}</div>
      {scripts.map((script, index) => {
        const scriptName = script.src.split("/").pop() || script.src;
        const sizeLabel = script.sizePretty ?? "unknown";
        const intentLabel = script.intent.label;
        const unusedLabel =
          script.unusedPercent === null
            ? "n/a"
            : `${Math.round(script.unusedPercent)}%`;
        const statusLabel = `${script.isBlocking ? "blocking" : script.isDeferred ? "deferred" : "async"} ${script.riskLevel === "critical" ? "\u2717" : "\u2713"}`;

        return (
          <div
            key={`${script.src}-${index}`}
            className="min-h-7 whitespace-pre-wrap break-words text-foreground"
          >
            <span>{padCell(scriptName, 20)}</span>
            <span>{padCell(script.host, 20)}</span>
            <span className={intentClass(script.intent.category)}>
              {padCell(intentLabel, 13)}
            </span>
            <span>{padCell(sizeLabel, 10)}</span>
            <span>{padCell(unusedLabel, 10)}</span>
            <span className={scriptRiskClass(script.riskLevel)}>{statusLabel}</span>
          </div>
        );
      })}
      <div className="min-h-7 whitespace-pre-wrap break-words"> </div>
      <div className="min-h-7 whitespace-pre-wrap break-words">FRAMEWORK INSIGHTS</div>
      {resultsPayload.insights.length > 0 ? (
        resultsPayload.insights.map((insight, index) => (
          <div
            key={`${insight.level}-${insight.message}-${index}`}
            className={`min-h-7 whitespace-pre-wrap break-words ${insightLevelClass(insight.level)}`}
          >
            {insight.message}
          </div>
        ))
      ) : (
        <div className="min-h-7 whitespace-pre-wrap break-words text-[#777777]">
          No framework-specific insights detected.
        </div>
      )}
      <div className="min-h-7 whitespace-pre-wrap break-words"> </div>
      <div className="min-h-7 whitespace-pre-wrap break-words">RECOMMENDATIONS</div>
      {resultsPayload.recommendations.length > 0 ? (
        resultsPayload.recommendations.map((recommendation, index) => (
          <div
            key={`${recommendation.priority}-${recommendation.message}-${index}`}
            className={`min-h-7 whitespace-pre-wrap break-words ${recommendationPriorityClass(recommendation.priority)}`}
          >
            {`${recommendation.priority}. ${recommendation.message}`}
          </div>
        ))
      ) : (
        <div className="min-h-7 whitespace-pre-wrap break-words text-[#777777]">
          No high-priority recommendations right now.
        </div>
      )}
    </>
  );
}
