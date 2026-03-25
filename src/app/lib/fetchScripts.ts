import { JS_PERF_BOT_USER_AGENT } from "./constants";
import type { FetchScriptsErrorCode, FetchedPageScripts, ScriptTag } from "./types";

export class FetchScriptsError extends Error {
  code: FetchScriptsErrorCode;
  status: number | null;

  constructor(
    message: string,
    code: FetchScriptsErrorCode,
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

const parseAttributes = (attributeSource: string): Map<string, string | true> => {
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

const fetchHtml = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10_000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": JS_PERF_BOT_USER_AGENT,
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

    return response.text();
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
};

export async function fetchPageScripts(url: string): Promise<FetchedPageScripts> {
  const html = await fetchHtml(url);

  return {
    html,
    scripts: parseScriptTags(html),
  };
}

export async function fetchScripts(url: string): Promise<ScriptTag[]> {
  const page = await fetchPageScripts(url);
  return page.scripts;
}
