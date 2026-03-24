import type { ScriptTag } from "./fetchScripts";

export type MeasuredScriptTag = ScriptTag & {
  absoluteUrl: string;
  sizeBytes: number | null;
  sizePretty: string | null;
  host: string;
  isThirdParty: boolean;
};

const USER_AGENT = "Mozilla/5.0 (compatible; jsperf-bot/1.0)";

const formatBytes = (sizeBytes: number | null) => {
  if (sizeBytes === null) {
    return null;
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  }

  return `${Math.round(sizeBytes / (1024 * 102.4)) / 10} MB`;
};

const withTimeout = async (input: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const readBodySize = async (response: Response) => {
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
