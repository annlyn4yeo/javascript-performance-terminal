export type ScriptTag = {
  src: string | null;
  isInline: boolean;
  isAsync: boolean;
  isDeferred: boolean;
  isModule: boolean;
  inlineSize: number | null;
};

export class FetchScriptsError extends Error {
  code: "HTTP_ERROR" | "TIMEOUT" | "NETWORK_ERROR";
  status: number | null;

  constructor(
    message: string,
    code: "HTTP_ERROR" | "TIMEOUT" | "NETWORK_ERROR",
    status: number | null = null,
  ) {
    super(message);
    this.name = "FetchScriptsError";
    this.code = code;
    this.status = status;
  }
}

const SCRIPT_TAG_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const ATTRIBUTE_REGEX = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const textEncoder = new TextEncoder();

const parseAttributes = (attributeSource: string) => {
  const attributes = new Map<string, string | true>();
  let match: RegExpExecArray | null = ATTRIBUTE_REGEX.exec(attributeSource);

  while (match) {
    const [, rawName, doubleQuotedValue, singleQuotedValue, unquotedValue] = match;
    const normalizedName = rawName.toLowerCase();
    const value = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? true;
    attributes.set(normalizedName, value);
    match = ATTRIBUTE_REGEX.exec(attributeSource);
  }

  ATTRIBUTE_REGEX.lastIndex = 0;

  return attributes;
};

export const parseScriptTags = (html: string): ScriptTag[] => {
  const scripts: ScriptTag[] = [];
  let match: RegExpExecArray | null = SCRIPT_TAG_REGEX.exec(html);

  while (match) {
    const [, attributeSource, inlineContent] = match;
    const attributes = parseAttributes(attributeSource);
    const rawSrc = attributes.get("src");
    const src = typeof rawSrc === "string" ? rawSrc : null;

    if (src?.includes("data:")) {
      match = SCRIPT_TAG_REGEX.exec(html);
      continue;
    }

    const rawType = attributes.get("type");
    const type = typeof rawType === "string" ? rawType.toLowerCase() : null;
    const isInline = src === null;

    scripts.push({
      src,
      isInline,
      isAsync: attributes.has("async"),
      isDeferred: attributes.has("defer"),
      isModule: type === "module",
      inlineSize: isInline ? textEncoder.encode(inlineContent).length : null,
    });

    match = SCRIPT_TAG_REGEX.exec(html);
  }

  SCRIPT_TAG_REGEX.lastIndex = 0;

  return scripts;
};

export async function fetchScripts(url: string): Promise<ScriptTag[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10_000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; jsperf-bot/1.0)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new FetchScriptsError(
        `Failed to fetch scripts from ${url}: ${response.status} ${response.statusText}`,
        "HTTP_ERROR",
        response.status,
      );
    }

    const html = await response.text();
    return parseScriptTags(html);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new FetchScriptsError(`Timed out while fetching ${url}`, "TIMEOUT");
    }

    if (error instanceof FetchScriptsError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new FetchScriptsError(`Failed to fetch scripts from ${url}: ${message}`, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}
