export type FrameworkName =
  | "Next.js"
  | "Nuxt"
  | "Angular"
  | "SvelteKit"
  | "Remix"
  | "Gatsby"
  | "Vue"
  | "React"
  | "Astro"
  | "Preact"
  | "jQuery"
  | "Unknown";

export type FrameworkDetection = {
  name: FrameworkName;
  version: string | null;
  meta: string | null;
};

export type ScriptTag = {
  src: string | null;
  isInline: boolean;
  isAsync: boolean;
  isDeferred: boolean;
  isModule: boolean;
  inlineSize: number | null;
};

export type FetchedPageScripts = {
  html: string;
  scripts: ScriptTag[];
};

export type FetchScriptsErrorCode = "HTTP_ERROR" | "TIMEOUT" | "NETWORK_ERROR";

export type MeasuredScriptTag = ScriptTag & {
  absoluteUrl: string;
  sizeBytes: number | null;
  sizePretty: string | null;
  host: string;
  isThirdParty: boolean;
};

export type Category =
  | "framework"
  | "analytics"
  | "ab-testing"
  | "payments"
  | "ads"
  | "support"
  | "cdn"
  | "monitoring"
  | "unknown";

export type ScriptIntent = {
  category: Category;
  label: string;
};

export type CoverageFunctionRange = {
  startOffset: number;
  endOffset: number;
  count: number;
};

export type CoverageFunction = {
  functionName: string;
  ranges: CoverageFunctionRange[];
  isBlockCoverage: boolean;
};

export type CoverageEntry = {
  scriptId: string;
  url: string;
  functions: CoverageFunction[];
};

export type CoverageRange = {
  startOffset: number;
  endOffset: number;
};

export type PerformanceMetric = {
  name: string;
  value: number;
};

export type InjectedLongTask = {
  duration: number;
  startTime: number;
  attribution: string;
};

export type InjectedData = {
  longTasks: InjectedLongTask[];
  navStart: number;
};

export type CDPResults = {
  coverageResult: CoverageEntry[];
  metrics: PerformanceMetric[];
  longTasks: InjectedLongTask[];
};

export type AnalyzeProgressEvent =
  | { type: "browser-ready" }
  | { type: "page-loaded"; timeMs: number }
  | { type: "timeline-collected"; longTaskCount: number }
  | { type: "coverage-analyzed"; unusedPercent: number };

export type AnalyzeOptions = {
  mobile?: boolean;
  onProgress?: (event: AnalyzeProgressEvent) => void | Promise<void>;
};

export type CoverageResult = {
  url: string;
  totalBytes: number;
  usedBytes: number;
  unusedBytes: number;
  unusedPercent: number;
};

export type RuntimeAnalysisResult = {
  fcp: number;
  tti: number;
  tbt: number;
  hydrationGap: number;
  scriptDuration: number;
  layoutDuration: number;
  longTasks: InjectedLongTask[];
  longestTask: InjectedLongTask;
  coverage: CoverageResult[];
};

export type RuntimeAnalysisErrorCode = "TIMEOUT" | "FAILED";

export type RiskLevel = "critical" | "warning" | "ok";

export type MergedScript = {
  src: string;
  host: string;
  isThirdParty: boolean;
  isAsync: boolean;
  isDeferred: boolean;
  isModule: boolean;
  sizeBytes: number | null;
  sizePretty: string | null;
  usedBytes: number | null;
  unusedBytes: number | null;
  unusedPercent: number | null;
  intent: ScriptIntent;
  isBlocking: boolean;
  riskLevel: RiskLevel;
};

export type MergeSummary = {
  totalScripts: number;
  totalSizeBytes: number;
  totalUnusedBytes: number;
  totalUnusedPercent: number;
  blockingCount: number;
  thirdPartyCount: number;
  criticalCount: number;
};

export type MergeResultsOutput = {
  scripts: MergedScript[];
  summary: MergeSummary;
};

export type RuntimeResult = RuntimeAnalysisResult;
export type DetectedFramework = FrameworkDetection;
export type ResultSummary = MergeSummary;

export type InsightLevel = "critical" | "warning" | "info";

export type Insight = {
  level: InsightLevel;
  message: string;
};

export type RecommendationPriority = 1 | 2 | 3;

export type Recommendation = {
  priority: RecommendationPriority;
  message: string;
};

export type OutputLineType =
  | "step"
  | "result"
  | "step-complete"
  | "section-header"
  | "data-row"
  | "warning"
  | "error";

export type OutputLine = {
  message: string;
  type: OutputLineType;
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
