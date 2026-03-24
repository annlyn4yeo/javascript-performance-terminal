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
  const longTasks = [...runtime.longTasks]
    .sort((left, right) => right.duration - left.duration)
    .slice(0, 10);
  const remainingLongTaskCount = Math.max(
    0,
    runtime.longTasks.length - longTasks.length,
  );

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
      <div className="min-h-7 whitespace-pre-wrap break-words">{`${padCell("SCRIPT", 20)}${padCell("HOST", 20)}${padCell("SIZE", 10)}${padCell("UNUSED", 10)}STATUS`}</div>
      {scripts.map((script, index) => {
        const scriptName = script.src.split("/").pop() || script.src;
        const sizeLabel = script.sizePretty ?? "unknown";
        const unusedLabel =
          script.unusedPercent === null
            ? "n/a"
            : `${Math.round(script.unusedPercent)}%`;
        const statusLabel = `${script.isBlocking ? "blocking" : script.isDeferred ? "deferred" : "async"} ${script.riskLevel === "critical" ? "\u2717" : "\u2713"}`;

        return (
          <div
            key={`${script.src}-${index}`}
            className={`min-h-7 whitespace-pre-wrap break-words ${scriptRiskClass(script.riskLevel)}`}
          >
            {`${padCell(scriptName, 20)}${padCell(script.host, 20)}${padCell(sizeLabel, 10)}${padCell(unusedLabel, 10)}${statusLabel}`}
          </div>
        );
      })}
      <div className="min-h-7 whitespace-pre-wrap break-words"> </div>
      <div className="min-h-7 whitespace-pre-wrap break-words">LONG TASKS</div>
      {longTasks.map((task, index) => (
        <div
          key={`${task.startTime}-${task.duration}-${index}`}
          className="min-h-7 whitespace-pre-wrap break-words"
        >
          {`${padCell(`${Math.round(task.startTime)}ms`, 12)}${padCell(`${Math.round(task.duration)}ms`, 10)}${task.attribution}`}
        </div>
      ))}
      {remainingLongTaskCount > 0 ? (
        <div className="min-h-7 whitespace-pre-wrap break-words">{`+ ${remainingLongTaskCount} more`}</div>
      ) : null}
    </>
  );
}
