import { detectFramework } from "@/app/lib/detectFramework";
import { fetchPageScripts } from "@/app/lib/fetchScripts";
import { measureScriptSizes } from "@/app/lib/measureScripts";

const encoder = new TextEncoder();

type StreamPayload =
  | { type: "step"; message: string }
  | { type: "result"; message: string }
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

const isValidHttpUrl = (value: string) => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!url || !isValidHttpUrl(url)) {
        controller.enqueue(createEventChunk({ type: "error", message: "\u2717 Invalid URL" }));
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
        const page = await fetchPageScripts(url);
        const fetchDuration = Date.now() - fetchStartedAt;

        html = page.html;
        scripts = page.scripts;

        send({
          type: "result",
          message: `\u2713 ${scripts.length} scripts found \u00b7 ${formatMilliseconds(fetchDuration)}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown fetch error";
        send({ type: "error", message: `\u2717 ${message}` });
        controller.close();
        return;
      }

      send({ type: "step", message: "\u25B6 Measuring script sizes..." });

      const measureStartedAt = Date.now();
      const measuredScripts = await measureScriptSizes(scripts, url);
      const measureDuration = Date.now() - measureStartedAt;
      const totalBytes = measuredScripts.reduce((sum, script) => sum + (script.sizeBytes ?? 0), 0);

      send({
        type: "result",
        message: `\u2713 Sizes resolved \u00b7 total ${formatKilobytes(totalBytes)} KB \u00b7 ${formatMilliseconds(
          measureDuration,
        )}`,
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
