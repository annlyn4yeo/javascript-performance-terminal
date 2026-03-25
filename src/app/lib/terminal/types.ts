import type { RuntimeAnalysisResult } from "@/app/lib/browser/analyze";
import type { FrameworkDetection } from "@/app/lib/detectFramework";
import type { Insight } from "@/app/lib/insights/frameworkInsights";
import type { Recommendation } from "@/app/lib/insights/recommendations";
import type { MergedScript, MergeSummary } from "@/app/lib/mergeResults";
import type { MeasuredScriptTag } from "@/app/lib/measureScripts";

export type OutputLine = {
  message: string;
  type:
    | "step"
    | "result"
    | "step-complete"
    | "section-header"
    | "data-row"
    | "warning"
    | "error";
  isActive: boolean;
  timingText: string | null;
};

export type ResultsPayload = {
  scripts: MeasuredScriptTag[] | MergedScript[];
  framework: FrameworkDetection;
  runtime: RuntimeAnalysisResult | null;
  summary: MergeSummary | null;
  insights: Insight[];
  recommendations: Recommendation[];
};

export type StreamMessage =
  | { type: "step"; message: string }
  | { type: "result"; message: string }
  | { type: "step-complete"; message: string }
  | { type: "section-header"; message: string }
  | { type: "data-row"; message: string }
  | { type: "warning"; message: string }
  | { type: "error"; message: string }
  | { type: "results"; payload: ResultsPayload }
  | { type: "done" };
