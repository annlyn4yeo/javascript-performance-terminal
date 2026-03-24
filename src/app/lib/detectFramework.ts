import type { ScriptTag } from "./fetchScripts";

export type FrameworkDetection = {
  name:
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
  version: string | null;
  meta: string | null;
};

const getScriptSources = (scripts: ScriptTag[]) =>
  scripts
    .map((script) => script.src?.toLowerCase() ?? null)
    .filter((src): src is string => src !== null);

const extractNextData = (html: string) => {
  const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as { buildId?: string; appDir?: boolean };
  } catch {
    return null;
  }
};

const extractJQueryVersion = (scriptSources: string[]) => {
  for (const src of scriptSources) {
    const versionMatch = src.match(/jquery[-.]([0-9]+(?:\.[0-9]+){1,2})/i);

    if (versionMatch) {
      return versionMatch[1];
    }
  }

  return null;
};

export function detectFramework(html: string, scripts: ScriptTag[]): FrameworkDetection {
  const normalizedHtml = html.toLowerCase();
  const scriptSources = getScriptSources(scripts);
  const nextData = extractNextData(html);

  if (html.includes("__NEXT_DATA__") || scriptSources.some((src) => src.includes("_next/static"))) {
    return {
      name: "Next.js",
      version: nextData?.buildId ?? null,
      meta: nextData ? (nextData.appDir ? "App Router" : "Pages Router") : null,
    };
  }

  if (html.includes("__NUXT__") || scriptSources.some((src) => src.includes("_nuxt/"))) {
    return {
      name: "Nuxt",
      version: null,
      meta: null,
    };
  }

  if (normalizedHtml.includes("ng-version") || scriptSources.some((src) => src.includes("angular"))) {
    return {
      name: "Angular",
      version: null,
      meta: null,
    };
  }

  if (normalizedHtml.includes("__sveltekit") || scriptSources.some((src) => src.includes("/_app/"))) {
    return {
      name: "SvelteKit",
      version: null,
      meta: null,
    };
  }

  if (html.includes("__remixContext")) {
    return {
      name: "Remix",
      version: null,
      meta: null,
    };
  }

  if (normalizedHtml.includes("window.___gatsby") || scriptSources.some((src) => src.includes("gatsby-"))) {
    return {
      name: "Gatsby",
      version: null,
      meta: null,
    };
  }

  if (
    normalizedHtml.includes("__vue__") ||
    normalizedHtml.includes("data-v-app") ||
    normalizedHtml.includes("id=\"__nuxt\"") ||
    scriptSources.some((src) => src.includes("vue"))
  ) {
    return {
      name: "Vue",
      version: null,
      meta: null,
    };
  }

  if (
    normalizedHtml.includes("/_astro/") ||
    normalizedHtml.includes("astro-island") ||
    scriptSources.some((src) => src.includes("/_astro/") || src.includes("astro"))
  ) {
    return {
      name: "Astro",
      version: null,
      meta: null,
    };
  }

  if (
    normalizedHtml.includes("__preactattr_") ||
    scriptSources.some((src) => src.includes("preact"))
  ) {
    return {
      name: "Preact",
      version: null,
      meta: null,
    };
  }

  if (
    normalizedHtml.includes("__reactfiber") ||
    normalizedHtml.includes("__reactcontainer") ||
    normalizedHtml.includes("data-reactroot") ||
    scriptSources.some((src) => src.includes("react") || src.includes("react-dom"))
  ) {
    return {
      name: "React",
      version: null,
      meta: null,
    };
  }

  if (scriptSources.some((src) => src.includes("jquery"))) {
    return {
      name: "jQuery",
      version: extractJQueryVersion(scriptSources),
      meta: null,
    };
  }

  return {
    name: "Unknown",
    version: null,
    meta: null,
  };
}
