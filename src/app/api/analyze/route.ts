import { detectFramework } from "@/app/lib/detectFramework";
import { FetchScriptsError, fetchPageScripts } from "@/app/lib/fetchScripts";
import { measureScriptSizes } from "@/app/lib/measureScripts";

const encoder = new TextEncoder();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestLogByIp = new Map<string, number[]>();

type StreamPayload =
  | { type: "step"; message: string }
  | { type: "result"; message: string }
  | { type: "warning"; message: string }
  | { type: "error"; message: string }
  | {
      type: "results";
      payload: {
        scripts: Awaited<ReturnType<typeof measureScriptSizes>>;
        framework: ReturnType<typeof detectFramework>;
      };
    }
  | { type: "done" };

const createEventChunk = (payload: StreamPayload) =>
  encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

const createStreamHeaders = () => ({
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
});

const formatMilliseconds = (timeMs: number) => `${timeMs}ms`;

const formatKilobytes = (sizeBytes: number) => `${Math.round((sizeBytes / 1024) * 10) / 10}`;

const normalizeUrl = (value: string) => {
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

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
};

const isRateLimited = (ip: string) => {
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

const mapFetchErrorToMessage = (error: unknown) => {
  if (error instanceof FetchScriptsError) {
    if (error.code === "TIMEOUT") {
      return "\u2717 Request timed out after 10s \u2014 site may be blocking automated access";
    }

    if (error.code === "HTTP_ERROR" && error.status !== null) {
      return `\u2717 Server returned ${error.status} \u2014 cannot analyze this page`;
    }

    return `\u2717 ${error.message}`;
  }

  if (error instanceof Error) {
    return `\u2717 ${error.message}`;
  }

  return "\u2717 Unknown fetch error";
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const normalizedUrl = url ? normalizeUrl(url) : null;
  const clientIp = getClientIp(request);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!normalizedUrl) {
        controller.enqueue(createEventChunk({ type: "error", message: "\u2717 Invalid URL" }));
        controller.close();
        return;
      }

      if (isRateLimited(clientIp)) {
        controller.enqueue(
          createEventChunk({ type: "error", message: "\u2717 Rate limit reached \u2014 please wait a minute" }),
        );
        controller.close();
        return;
      }

      const send = (payload: StreamPayload) => {
        controller.enqueue(createEventChunk(payload));
      };

      let html = "";
      let scripts: Awaited<ReturnType<typeof fetchPageScripts>>["scripts"] = [];

      send({ type: "step", message: "\u25B6 Fetching page..." });

      try {
        const fetchStartedAt = Date.now();
        const page = await fetchPageScripts(normalizedUrl);
        const fetchDuration = Date.now() - fetchStartedAt;

        html = page.html;
        scripts = page.scripts;

        if (scripts.length === 0) {
          send({
            type: "result",
            message: `\u2713 Page loaded \u00b7 \u26a0 No JavaScript detected on this page \u00b7 ${formatMilliseconds(
              fetchDuration,
            )}`,
          });
        } else {
          send({
            type: "result",
            message: `\u2713 ${scripts.length} scripts found \u00b7 ${formatMilliseconds(fetchDuration)}`,
          });
        }

        if (scripts.length >= 50) {
          send({
            type: "warning",
            message: `\u26a0 ${scripts.length} scripts found \u2014 large pages may take longer to analyze`,
          });
        }
      } catch (error) {
        send({ type: "error", message: mapFetchErrorToMessage(error) });
        controller.close();
        return;
      }

      send({ type: "step", message: "\u25B6 Measuring script sizes..." });

      const measureStartedAt = Date.now();
      const measuredScripts = await measureScriptSizes(scripts, normalizedUrl);
      const measureDuration = Date.now() - measureStartedAt;
      const totalBytes = measuredScripts.reduce((sum, script) => sum + (script.sizeBytes ?? 0), 0);
      const unreachableCount = measuredScripts.filter((script) => !script.isInline && script.sizeBytes === null).length;

      send({
        type: "result",
        message: `\u2713 Sizes resolved \u00b7 total ${formatKilobytes(totalBytes)} KB${
          unreachableCount > 0 ? ` \u00b7 ${unreachableCount} unreachable` : ""
        } \u00b7 ${formatMilliseconds(measureDuration)}`,
      });

      send({ type: "step", message: "\u25B6 Detecting framework..." });

      const frameworkStartedAt = Date.now();
      const framework = detectFramework(html, scripts);
      const frameworkDuration = Date.now() - frameworkStartedAt;
      const frameworkDetails = [framework.name, framework.version, framework.meta].filter(Boolean).join(" ");

      send({
        type: "result",
        message: `\u2713 ${frameworkDetails || "Unknown"} \u00b7 ${formatMilliseconds(frameworkDuration)}`,
      });

      send({
        type: "results",
        payload: {
          scripts: measuredScripts,
          framework,
        },
      });

      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: createStreamHeaders(),
  });
}
