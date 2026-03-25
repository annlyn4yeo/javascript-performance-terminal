import { analyzeRuntime, RuntimeAnalysisError } from "@/app/lib/browser/analyze";
import {
  BYTES_PER_KILOBYTE,
  STATUS_ICON_ERROR,
  STATUS_ICON_RESULT,
  STATUS_ICON_SEPARATOR,
  STATUS_ICON_STEP,
  STATUS_ICON_WARNING,
} from "@/app/lib/constants";
import { detectFramework } from "@/app/lib/detectFramework";
import { FetchScriptsError, fetchPageScripts } from "@/app/lib/fetchScripts";
import { getFrameworkInsights } from "@/app/lib/insights/frameworkInsights";
import { getRecommendations } from "@/app/lib/insights/recommendations";
import { mergeResults } from "@/app/lib/mergeResults";
import { measureScriptSizes } from "@/app/lib/measureScripts";
import type { ScriptTag, StreamMessage } from "@/app/lib/types";

const encoder = new TextEncoder();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestLogByIp = new Map<string, number[]>();

const createEventChunk = (payload: StreamMessage): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

const createStreamHeaders = (): Record<string, string> => ({
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
});

const formatMilliseconds = (timeMs: number): string => `${timeMs}ms`;

const formatKilobytes = (sizeBytes: number): string =>
  `${Math.round((sizeBytes / BYTES_PER_KILOBYTE) * 10) / 10}`;

const normalizeUrl = (value: string): string | null => {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      return parsedUrl.toString();
    }
  } catch {
    try {
      const parsedUrl = new URL(`https://${value}`);
      if (parsedUrl.protocol === "https:") {
        return parsedUrl.toString();
      }
    } catch {
      return null;
    }
  }

  return null;
};

const getClientIp = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
};

const isRateLimited = (ip: string): boolean => {
  const now = Date.now();
  const recentRequests = (requestLogByIp.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLogByIp.set(ip, recentRequests);
    return true;
  }

  recentRequests.push(now);
  requestLogByIp.set(ip, recentRequests);
  return false;
};

const mapFetchErrorToMessage = (error: unknown): string => {
  if (error instanceof FetchScriptsError) {
    if (error.code === "TIMEOUT") {
      return `${STATUS_ICON_ERROR} Request timed out after 10s \u2014 site may be blocking automated access`;
    }

    if (error.code === "HTTP_ERROR" && error.status !== null) {
      return `${STATUS_ICON_ERROR} Server returned ${error.status} \u2014 cannot analyze this page`;
    }

    return `${STATUS_ICON_ERROR} ${error.message}`;
  }

  if (error instanceof Error) {
    return `${STATUS_ICON_ERROR} ${error.message}`;
  }

  return `${STATUS_ICON_ERROR} Unknown fetch error`;
};

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const normalizedUrl = url ? normalizeUrl(url) : null;
  const clientIp = getClientIp(request);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
      if (!normalizedUrl) {
        controller.enqueue(createEventChunk({ type: "error", message: `${STATUS_ICON_ERROR} Invalid URL` }));
        controller.enqueue(createEventChunk({ type: "done" }));
        controller.close();
        return;
      }

      if (isRateLimited(clientIp)) {
        controller.enqueue(
          createEventChunk({
            type: "error",
            message: `${STATUS_ICON_ERROR} Rate limit reached \u2014 please wait a minute`,
          }),
        );
        controller.enqueue(createEventChunk({ type: "done" }));
        controller.close();
        return;
      }

      const send = (payload: StreamMessage): void => {
        controller.enqueue(createEventChunk(payload));
      };

      let html = "";
      let scripts: ScriptTag[] = [];

      send({ type: "step", message: `${STATUS_ICON_STEP} Fetching page...` });

      try {
        const fetchStartedAt = Date.now();
        const page = await fetchPageScripts(normalizedUrl);
        const fetchDuration = Date.now() - fetchStartedAt;

        html = page.html;
        scripts = page.scripts;

        if (scripts.length === 0) {
          send({
            type: "result",
            message: `${STATUS_ICON_RESULT} Page loaded ${STATUS_ICON_SEPARATOR} ${STATUS_ICON_WARNING} No JavaScript detected on this page ${STATUS_ICON_SEPARATOR} ${formatMilliseconds(
              fetchDuration,
            )}`,
          });
        } else {
          send({
            type: "result",
            message: `${STATUS_ICON_RESULT} ${scripts.length} scripts found ${STATUS_ICON_SEPARATOR} ${formatMilliseconds(fetchDuration)}`,
          });
        }

        if (scripts.length >= 50) {
          send({
            type: "warning",
            message: `${STATUS_ICON_WARNING} ${scripts.length} scripts found \u2014 large pages may take longer to analyze`,
          });
        }
      } catch (error) {
        send({ type: "error", message: mapFetchErrorToMessage(error) });
        send({ type: "done" });
        controller.close();
        return;
      }

      send({ type: "step", message: `${STATUS_ICON_STEP} Measuring script sizes...` });

      const measureStartedAt = Date.now();
      const measuredScripts = await measureScriptSizes(scripts, normalizedUrl);
      const measureDuration = Date.now() - measureStartedAt;
      const totalBytes = measuredScripts.reduce((sum, script) => sum + (script.sizeBytes ?? 0), 0);
      const unreachableCount = measuredScripts.filter((script) => !script.isInline && script.sizeBytes === null).length;

      send({
        type: "result",
        message: `${STATUS_ICON_RESULT} Sizes resolved ${STATUS_ICON_SEPARATOR} total ${formatKilobytes(totalBytes)} KB${
          unreachableCount > 0 ? ` ${STATUS_ICON_SEPARATOR} ${unreachableCount} unreachable` : ""
        } ${STATUS_ICON_SEPARATOR} ${formatMilliseconds(measureDuration)}`,
      });

      send({ type: "step", message: `${STATUS_ICON_STEP} Detecting framework...` });

      const frameworkStartedAt = Date.now();
      const framework = detectFramework(html, scripts);
      const frameworkDuration = Date.now() - frameworkStartedAt;
      const frameworkDetails = [framework.name, framework.version, framework.meta].filter(Boolean).join(" ");

      send({
        type: "result",
        message: `${STATUS_ICON_RESULT} ${frameworkDetails || "Unknown"} ${STATUS_ICON_SEPARATOR} ${formatMilliseconds(frameworkDuration)}`,
      });

      send({ type: "step", message: `${STATUS_ICON_STEP} Launching browser session...` });

      try {
        const runtime = await analyzeRuntime(normalizedUrl, {
          mobile: false,
          onProgress: async (event) => {
            if (event.type === "browser-ready") {
              return;
            }

            if (event.type === "page-loaded") {
              send({
                type: "result",
                message: `${STATUS_ICON_RESULT} Page loaded ${STATUS_ICON_SEPARATOR} networkidle reached ${STATUS_ICON_SEPARATOR} ${formatMilliseconds(
                  event.timeMs,
                )}`,
              });
              send({
                type: "step",
                message: `${STATUS_ICON_STEP} Collecting performance timeline...`,
              });
              return;
            }

            if (event.type === "timeline-collected") {
              send({
                type: "result",
                message: `${STATUS_ICON_RESULT} Timeline collected ${STATUS_ICON_SEPARATOR} ${event.longTaskCount} long tasks detected`,
              });
              send({
                type: "step",
                message: `${STATUS_ICON_STEP} Measuring unused JavaScript...`,
              });
              return;
            }

            send({
              type: "result",
              message: `${STATUS_ICON_RESULT} Coverage analyzed ${STATUS_ICON_SEPARATOR} ${event.unusedPercent}% unused JS`,
            });
          },
        });

        const merged = mergeResults(measuredScripts, runtime.coverage);
        const insights = getFrameworkInsights(framework, runtime, merged.scripts);
        const recommendations = getRecommendations(merged.scripts, runtime, merged.summary);

        send({
          type: "results",
          payload: {
            scripts: merged.scripts,
            framework,
            runtime,
            summary: merged.summary,
            insights,
            recommendations,
          },
        });
      } catch (error) {
        if (error instanceof RuntimeAnalysisError && error.code === "TIMEOUT") {
          send({
            type: "warning",
            message: `${STATUS_ICON_WARNING} Runtime analysis timed out \u2014 showing static results only`,
          });
          send({
            type: "results",
            payload: {
              scripts: measuredScripts,
              framework,
              runtime: null,
              summary: null,
              insights: [],
              recommendations: [],
            },
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown runtime analysis error";
        send({
          type: "error",
          message: `${STATUS_ICON_ERROR} Runtime analysis failed \u2014 ${message}`,
        });
        send({
          type: "results",
          payload: {
            scripts: measuredScripts,
            framework,
            runtime: null,
            summary: null,
            insights: [],
            recommendations: [],
          },
        });
        send({ type: "done" });
        controller.close();
        return;
      }

      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: createStreamHeaders(),
  });
}
