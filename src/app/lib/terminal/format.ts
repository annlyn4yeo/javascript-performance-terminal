import {
  STATUS_ICON_ERROR,
  STATUS_ICON_RESULT,
  STATUS_ICON_STEP,
  STATUS_ICON_WARNING,
} from "@/app/lib/constants";
import type { MergedScript, ResultsPayload } from "@/app/lib/types";
import { formatBytes } from "@/app/lib/utils";

export const DIVIDER_LINE = "-".repeat(30);
export const COMPLETION_DIVIDER = "-".repeat(41);

export const formatBytesPretty = (sizeBytes: number): string => {
  return formatBytes(sizeBytes) ?? "0 B";
};

export const padCell = (value: string, width: number): string => {
  if (value.length >= width) {
    return `${value.slice(0, width - 1)} `;
  }

  return value.padEnd(width, " ");
};

export const stripStatusPrefix = (message: string): string =>
  message.replace(
    new RegExp(`^(?:[${STATUS_ICON_STEP}${STATUS_ICON_RESULT}${STATUS_ICON_ERROR}${STATUS_ICON_WARNING}])\\s*`, "i"),
    "",
  );

export const splitTiming = (
  message: string,
): {
  cleanMessage: string;
  timingText: string | null;
} => {
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
