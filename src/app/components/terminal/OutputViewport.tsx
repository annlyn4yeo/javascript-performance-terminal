import type { RefObject } from "react";
import { COMPLETION_DIVIDER } from "@/app/lib/terminal/format";
import {
  STATUS_ICON_ERROR,
  STATUS_ICON_RESULT,
  STATUS_ICON_SEPARATOR,
  STATUS_ICON_STEP,
  STATUS_ICON_WARNING,
  TERMINAL_TEXT_ERROR_CLASS,
  TERMINAL_TEXT_DIM_CLASS,
  TERMINAL_TEXT_MUTED_CLASS,
  TERMINAL_TEXT_WARNING_CLASS,
} from "@/app/lib/constants";
import type { OutputLine, ResultsPayload } from "@/app/lib/types";
import { ResultsBlocks } from "./ResultsBlocks";

type OutputViewportProps = {
  outputLines: OutputLine[];
  resultsPayload: ResultsPayload | null;
  isStreaming: boolean;
  completionTimeMs: number | null;
  outputViewportRef: RefObject<HTMLDivElement>;
  bottomSentinelRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
};

const lineColorClass = (line: OutputLine): string => {
  if (line.type === "step" && !line.isActive) {
    return TERMINAL_TEXT_MUTED_CLASS;
  }

  if (line.type === "section-header") {
    return "text-[#A3A3A3]";
  }

  if (line.type === "result" || line.type === "warning") {
    return TERMINAL_TEXT_WARNING_CLASS;
  }

  if (line.type === "error") {
    return TERMINAL_TEXT_ERROR_CLASS;
  }

  return "text-foreground";
};

const renderLineMarker = (line: OutputLine): string => {
  if (line.type === "section-header" || line.type === "data-row") {
    return "";
  }

  if (line.type === "step") {
    return line.isActive ? STATUS_ICON_STEP : STATUS_ICON_SEPARATOR;
  }

  if (line.type === "result" || line.type === "step-complete") {
    return STATUS_ICON_RESULT;
  }

  if (line.type === "warning") {
    return STATUS_ICON_WARNING;
  }

  if (line.type === "error") {
    return STATUS_ICON_ERROR;
  }

  return STATUS_ICON_STEP;
};

export function OutputViewport({
  outputLines,
  resultsPayload,
  isStreaming,
  completionTimeMs,
  outputViewportRef,
  bottomSentinelRef,
  onScroll,
}: OutputViewportProps): JSX.Element {
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
              className={`min-h-7 whitespace-pre-wrap break-words ${lineColorClass(line)}`}
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
                <span className={`ml-2 ${TERMINAL_TEXT_DIM_CLASS}`}>
                  {STATUS_ICON_SEPARATOR} {line.timingText}
                </span>
              ) : null}
              {line.isActive ? (
                <span className={`terminal-inline-underscore ml-1 ${TERMINAL_TEXT_WARNING_CLASS}`}>
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
            <div className={`min-h-7 whitespace-pre-wrap break-words ${TERMINAL_TEXT_MUTED_CLASS}`}>
              {`analysis complete ${STATUS_ICON_SEPARATOR} ${completionTimeMs}ms total`}
            </div>
          </>
        ) : null}

        <div ref={bottomSentinelRef} />
      </div>
    </div>
  );
}
