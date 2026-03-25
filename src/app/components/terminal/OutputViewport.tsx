import type { RefObject } from "react";
import { COMPLETION_DIVIDER } from "@/app/lib/terminal/format";
import type { OutputLine, ResultsPayload } from "@/app/lib/terminal/types";
import { ResultsBlocks } from "./ResultsBlocks";

type OutputViewportProps = {
  hasStarted: boolean;
  outputLines: OutputLine[];
  resultsPayload: ResultsPayload | null;
  isStreaming: boolean;
  completionTimeMs: number | null;
  outputViewportRef: RefObject<HTMLDivElement>;
  bottomSentinelRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
};

const lineColorClass = (type: OutputLine["type"]) => {
  if (type === "result" || type === "warning") {
    return "text-[#F59E0B]";
  }

  if (type === "error") {
    return "text-[#EF4444]";
  }

  return "text-foreground";
};

const renderLineMarker = (line: OutputLine) => {
  if (line.type === "section-header" || line.type === "data-row") {
    return "";
  }

  if (line.type === "result" || line.type === "step-complete") {
    return "\u2713";
  }

  if (line.type === "warning") {
    return "\u26a0";
  }

  if (line.type === "error") {
    return "\u2717";
  }

  return "\u25b6";
};

export function OutputViewport({
  hasStarted,
  outputLines,
  resultsPayload,
  isStreaming,
  completionTimeMs,
  outputViewportRef,
  bottomSentinelRef,
  onScroll,
}: OutputViewportProps) {
  return (
    <div
      ref={outputViewportRef}
      onScroll={onScroll}
      className="scrollbar-hidden flex-1 overflow-y-auto"
    >
      <div className="w-full max-w-[880px] pr-2 text-[15px] leading-7">
        {outputLines.map((line, index) => {
          const isLastLine = index === outputLines.length - 1;
          const marker = renderLineMarker(line);

          return (
            <div
              key={`${line.message}-${index}`}
              className={`min-h-7 whitespace-pre-wrap break-words ${lineColorClass(line.type)}`}
            >
              {marker ? (
                <span
                  className={
                    line.isActive ? "terminal-active-marker inline-block" : ""
                  }
                >
                  {marker}
                </span>
              ) : null}
              <span className={marker ? "ml-2" : ""}>{line.message}</span>
              {line.timingText ? (
                <span className="ml-2 text-[#555555]">
                  {"\u00b7"} {line.timingText}
                </span>
              ) : null}
              {line.isActive ? (
                <span className="terminal-inline-underscore ml-1 text-[#F59E0B]">
                  _
                </span>
              ) : null}
              {isStreaming && isLastLine && !line.isActive ? (
                <span
                  className="terminal-cursor ml-1 inline-block h-5 w-2 align-[-3px]"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}

        {resultsPayload ? (
          <>
            {outputLines.length > 0 ? (
              <div className="min-h-7 whitespace-pre-wrap break-words"> </div>
            ) : null}
            <ResultsBlocks resultsPayload={resultsPayload} />
          </>
        ) : null}

        {completionTimeMs !== null ? (
          <>
            <div className="min-h-7 whitespace-pre-wrap break-words"> </div>
            <div className="min-h-7 whitespace-pre-wrap break-words">
              {COMPLETION_DIVIDER}
            </div>
            <div className="min-h-7 whitespace-pre-wrap break-words text-[#777777]">
              {`analysis complete \u00b7 ${completionTimeMs}ms total`}
            </div>
          </>
        ) : null}

        <div ref={bottomSentinelRef} />
      </div>
    </div>
  );
}
