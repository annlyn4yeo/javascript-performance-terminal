import {
  BYTES_PER_KILOBYTE,
  BYTES_PER_MEGABYTE,
  JS_PERF_BOT_USER_AGENT,
} from "./constants";
import type { MeasuredScriptTag, ScriptTag } from "./types";

const formatBytes = (sizeBytes: number | null): string | null => {
  if (sizeBytes === null) {
    return null;
  }

  if (sizeBytes < BYTES_PER_KILOBYTE) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < BYTES_PER_MEGABYTE) {
    return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  }

  return `${Math.round(sizeBytes / (BYTES_PER_KILOBYTE * 102.4)) / 10} MB`;
};

const withTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      headers: {
        "User-Agent": JS_PERF_BOT_USER_AGENT,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const readBodySize = async (response: Response): Promise<number> => {
  const buffer = await response.arrayBuffer();
  return buffer.byteLength;
};

const resolveScript = async (
  script: ScriptTag,
  baseHost: string,
  baseUrl: string,
): Promise<MeasuredScriptTag> => {
  const absoluteUrl = script.src ? new URL(script.src, baseUrl).toString() : baseUrl;
  const host = new URL(absoluteUrl).host;
  const isThirdParty = host !== baseHost;

  if (script.isInline || script.src === null) {
    return {
      ...script,
      absoluteUrl,
      sizeBytes: script.inlineSize,
      sizePretty: formatBytes(script.inlineSize),
      host,
      isThirdParty,
    };
  }

  try {
    const headResponse = await withTimeout(
      absoluteUrl,
      {
        method: "HEAD",
      },
      5_000,
    );

    if (headResponse.ok) {
      const contentLength = headResponse.headers.get("content-length");

      if (contentLength) {
        const parsedSize = Number.parseInt(contentLength, 10);

        if (!Number.isNaN(parsedSize)) {
          return {
            ...script,
            absoluteUrl,
            sizeBytes: parsedSize,
            sizePretty: formatBytes(parsedSize),
            host,
            isThirdParty,
          };
        }
      }
    }

    const getResponse = await withTimeout(
      absoluteUrl,
      {
        method: "GET",
      },
      5_000,
    );

    if (!getResponse.ok) {
      return {
        ...script,
        absoluteUrl,
        sizeBytes: null,
        sizePretty: null,
        host,
        isThirdParty,
      };
    }

    const sizeBytes = await readBodySize(getResponse);

    return {
      ...script,
      absoluteUrl,
      sizeBytes,
      sizePretty: formatBytes(sizeBytes),
      host,
      isThirdParty,
    };
  } catch {
    return {
      ...script,
      absoluteUrl,
      sizeBytes: null,
      sizePretty: null,
      host,
      isThirdParty,
    };
  }
};

export async function measureScriptSizes(
  scripts: ScriptTag[],
  baseUrl: string,
): Promise<MeasuredScriptTag[]> {
  const baseHost = new URL(baseUrl).host;
  const measurements = scripts.map((script) => resolveScript(script, baseHost, baseUrl));
  const settledMeasurements = await Promise.allSettled(measurements);

  return settledMeasurements.map((result, index) => {
    const script = scripts[index];
    const fallbackAbsoluteUrl = script.src ? new URL(script.src, baseUrl).toString() : baseUrl;
    const fallbackHost = new URL(fallbackAbsoluteUrl).host;

    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      ...script,
      absoluteUrl: fallbackAbsoluteUrl,
      sizeBytes: null,
      sizePretty: null,
      host: fallbackHost,
      isThirdParty: fallbackHost !== baseHost,
    };
  });
}
