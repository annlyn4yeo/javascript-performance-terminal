import type { RuntimeAnalysisResult } from "@/app/lib/browser/analyze";
import type { FrameworkDetection } from "@/app/lib/detectFramework";
import type { MergedScript, MergeSummary } from "@/app/lib/mergeResults";
import type { MeasuredScriptTag } from "@/app/lib/measureScripts";

export type OutputLine = {
  message: string;
  type: "step" | "result" | "warning" | "error";
  isActive: boolean;
  timingText: string | null;
};

export type ResultsPayload = {
  scripts: MeasuredScriptTag[] | MergedScript[];
  framework: FrameworkDetection;
  runtime: RuntimeAnalysisResult | null;
  summary: MergeSummary | null;
};

export type StreamMessage =
  | { type: "step"; message: string }
  | { type: "result"; message: string }
  | { type: "warning"; message: string }
  | { type: "error"; message: string }
  | { type: "results"; payload: ResultsPayload }
  | { type: "done" };
