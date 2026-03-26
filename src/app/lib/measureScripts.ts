import { JS_PERF_BOT_USER_AGENT } from "./constants";
import type { MeasuredScriptTag, ScriptTag } from "./types";
import { formatBytes } from "./utils";

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

const toMeasuredInlineScript = (
  script: ScriptTag,
  absoluteUrl: string,
  host: string,
  isThirdParty: boolean,
): MeasuredScriptTag => ({
  ...script,
  absoluteUrl,
  sizeBytes: script.inlineSize,
  sizePretty: formatBytes(script.inlineSize),
  host,
  isThirdParty,
});

const toMeasuredUnknownSizeScript = (
  script: ScriptTag,
  absoluteUrl: string,
  host: string,
  isThirdParty: boolean,
): MeasuredScriptTag => ({
  ...script,
  absoluteUrl,
  sizeBytes: null,
  sizePretty: null,
  host,
  isThirdParty,
});

const toMeasuredKnownSizeScript = (
  script: ScriptTag,
  absoluteUrl: string,
  host: string,
  isThirdParty: boolean,
  sizeBytes: number,
): MeasuredScriptTag => ({
  ...script,
  absoluteUrl,
  sizeBytes,
  sizePretty: formatBytes(sizeBytes),
  host,
  isThirdParty,
});

const getHeadContentLength = async (
  absoluteUrl: string,
): Promise<number | null> => {
  const headResponse = await withTimeout(
    absoluteUrl,
    {
      method: "HEAD",
    },
    5_000,
  );

  if (!headResponse.ok) {
    return null;
  }

  const contentLength = headResponse.headers.get("content-length");
  if (!contentLength) {
    return null;
  }

  const parsedSize = Number.parseInt(contentLength, 10);
  return Number.isNaN(parsedSize) ? null : parsedSize;
};

const getBodySize = async (absoluteUrl: string): Promise<number | null> => {
  const getResponse = await withTimeout(
    absoluteUrl,
    {
      method: "GET",
    },
    5_000,
  );

  if (!getResponse.ok) {
    return null;
  }

  return readBodySize(getResponse);
};

const resolveScript = async (
  script: ScriptTag,
  baseHost: string,
  baseUrl: string,
): Promise<MeasuredScriptTag> => {
  const absoluteUrl = script.src
    ? new URL(script.src, baseUrl).toString()
    : baseUrl;
  const host = new URL(absoluteUrl).host;
  const isThirdParty = host !== baseHost;

  if (script.isInline || script.src === null) {
    return toMeasuredInlineScript(script, absoluteUrl, host, isThirdParty);
  }

  try {
    const headContentLength = await getHeadContentLength(absoluteUrl);
    if (headContentLength !== null) {
      return toMeasuredKnownSizeScript(
        script,
        absoluteUrl,
        host,
        isThirdParty,
        headContentLength,
      );
    }

    const bodySize = await getBodySize(absoluteUrl);
    if (bodySize === null) {
      return toMeasuredUnknownSizeScript(
        script,
        absoluteUrl,
        host,
        isThirdParty,
      );
    }

    return toMeasuredKnownSizeScript(
      script,
      absoluteUrl,
      host,
      isThirdParty,
      bodySize,
    );
  } catch {
    return toMeasuredUnknownSizeScript(script, absoluteUrl, host, isThirdParty);
  }
};

export async function measureScriptSizes(
  scripts: ScriptTag[],
  baseUrl: string,
): Promise<MeasuredScriptTag[]> {
  const baseHost = new URL(baseUrl).host;
  const measurements = scripts.map((script) =>
    resolveScript(script, baseHost, baseUrl),
  );
  const settledMeasurements = await Promise.allSettled(measurements);

  return settledMeasurements.map((result, index) => {
    const script = scripts[index];
    const fallbackAbsoluteUrl = script.src
      ? new URL(script.src, baseUrl).toString()
      : baseUrl;
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
