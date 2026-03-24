import type { MergedScript } from "@/app/lib/mergeResults";
import type { ResultsPayload } from "./types";

export const DIVIDER_LINE = "-".repeat(30);
export const COMPLETION_DIVIDER = "-".repeat(41);

export const formatBytesPretty = (sizeBytes: number) => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  }

  return `${Math.round(sizeBytes / (1024 * 102.4)) / 10} MB`;
};

export const padCell = (value: string, width: number) => {
  if (value.length >= width) {
    return `${value.slice(0, width - 1)} `;
  }

  return value.padEnd(width, " ");
};

export const stripStatusPrefix = (message: string) =>
  message.replace(/^(?:[\u25b6\u2713\u2717\u26a0])\s*/i, "");

export const splitTiming = (message: string) => {
  const timingMatch = message.match(/\s+\u00b7\s+([0-9]+ms)$/);

  if (!timingMatch) {
    return {
      cleanMessage: stripStatusPrefix(message),
      timingText: null,
    };
  }

  return {
    cleanMessage: stripStatusPrefix(
      message.replace(/\s+\u00b7\s+[0-9]+ms$/, ""),
    ),
    timingText: timingMatch[1],
  };
};

export const isMergedScriptArray = (
  scripts: ResultsPayload["scripts"],
): scripts is MergedScript[] => scripts.every((script) => "riskLevel" in script);
