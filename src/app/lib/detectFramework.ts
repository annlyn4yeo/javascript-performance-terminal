import type { FrameworkDetection, ScriptTag } from "./types";

type NextData = { buildId?: string; appDir?: boolean };
type Detector = (
  html: string,
  normalizedHtml: string,
  scriptSources: string[],
) => FrameworkDetection | null;

const getScriptSources = (scripts: ScriptTag[]): string[] =>
  scripts
    .map((script) => script.src?.toLowerCase() ?? null)
    .filter((src): src is string => src !== null);

const isNextData = (value: unknown): value is NextData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const buildId = Reflect.get(value, "buildId");
  const appDir = Reflect.get(value, "appDir");
  const hasValidBuildId = buildId === undefined || typeof buildId === "string";
  const hasValidAppDir = appDir === undefined || typeof appDir === "boolean";

  return hasValidBuildId && hasValidAppDir;
};

const extractNextData = (html: string): NextData | null => {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );

  if (!match) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(match[1]);
    return isNextData(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractJQueryVersion = (scriptSources: string[]): string | null => {
  for (const src of scriptSources) {
    const versionMatch = src.match(/jquery[-.]([0-9]+(?:\.[0-9]+){1,2})/i);

    if (versionMatch) {
      return versionMatch[1];
    }
  }

  return null;
};

const detectNext = (
  html: string,
  _normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  if (
    !html.includes("__NEXT_DATA__") &&
    !scriptSources.some((src) => src.includes("_next/static"))
  ) {
    return null;
  }

  const nextData = extractNextData(html);

  return {
    name: "Next.js",
    version: nextData?.buildId ?? null,
    meta: nextData ? (nextData.appDir ? "App Router" : "Pages Router") : null,
  };
};

const detectNuxt = (
  _html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  if (
    !normalizedHtml.includes("__nuxt__") &&
    !scriptSources.some((src) => src.includes("_nuxt/"))
  ) {
    return null;
  }

  return {
    name: "Nuxt",
    version: null,
    meta: null,
  };
};

const detectAngular = (
  _html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  if (
    !normalizedHtml.includes("ng-version") &&
    !scriptSources.some((src) => src.includes("angular"))
  ) {
    return null;
  }

  return {
    name: "Angular",
    version: null,
    meta: null,
  };
};

const detectSvelteKit = (
  _html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  if (
    !normalizedHtml.includes("__sveltekit") &&
    !scriptSources.some((src) => src.includes("/_app/"))
  ) {
    return null;
  }

  return {
    name: "SvelteKit",
    version: null,
    meta: null,
  };
};

const detectRemix = (html: string): FrameworkDetection | null => {
  if (!html.includes("__remixContext")) {
    return null;
  }

  return {
    name: "Remix",
    version: null,
    meta: null,
  };
};

const detectGatsby = (
  _html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  if (
    !normalizedHtml.includes("window.___gatsby") &&
    !scriptSources.some((src) => src.includes("gatsby-"))
  ) {
    return null;
  }

  return {
    name: "Gatsby",
    version: null,
    meta: null,
  };
};

const detectVue = (
  _html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  const hasVueMarkers =
    normalizedHtml.includes("__vue__") ||
    normalizedHtml.includes("data-v-app") ||
    normalizedHtml.includes('id="__nuxt"');

  if (!hasVueMarkers && !scriptSources.some((src) => src.includes("vue"))) {
    return null;
  }

  return {
    name: "Vue",
    version: null,
    meta: null,
  };
};

const detectAstro = (
  _html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  const hasAstroMarkers =
    normalizedHtml.includes("/_astro/") ||
    normalizedHtml.includes("astro-island");

  if (
    !hasAstroMarkers &&
    !scriptSources.some(
      (src) => src.includes("/_astro/") || src.includes("astro"),
    )
  ) {
    return null;
  }

  return {
    name: "Astro",
    version: null,
    meta: null,
  };
};

const detectPreact = (
  _html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  if (
    !normalizedHtml.includes("__preactattr_") &&
    !scriptSources.some((src) => src.includes("preact"))
  ) {
    return null;
  }

  return {
    name: "Preact",
    version: null,
    meta: null,
  };
};

const detectReact = (
  _html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  const hasReactMarkers =
    normalizedHtml.includes("__reactfiber") ||
    normalizedHtml.includes("__reactcontainer") ||
    normalizedHtml.includes("data-reactroot");

  if (
    !hasReactMarkers &&
    !scriptSources.some(
      (src) => src.includes("react") || src.includes("react-dom"),
    )
  ) {
    return null;
  }

  return {
    name: "React",
    version: null,
    meta: null,
  };
};

const detectJquery = (
  _html: string,
  _normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  if (!scriptSources.some((src) => src.includes("jquery"))) {
    return null;
  }

  return {
    name: "jQuery",
    version: extractJQueryVersion(scriptSources),
    meta: null,
  };
};

const DETECTORS: Detector[] = [
  detectNext,
  detectNuxt,
  detectAngular,
  detectSvelteKit,
  detectRemix,
  detectGatsby,
  detectVue,
  detectAstro,
  detectPreact,
  detectReact,
  detectJquery,
];

const detectFromRules = (
  html: string,
  normalizedHtml: string,
  scriptSources: string[],
): FrameworkDetection | null => {
  for (const detector of DETECTORS) {
    const result = detector(html, normalizedHtml, scriptSources);

    if (result) {
      return result;
    }
  }

  return null;
};

export function detectFramework(
  html: string,
  scripts: ScriptTag[],
): FrameworkDetection {
  const normalizedHtml = html.toLowerCase();
  const scriptSources = getScriptSources(scripts);

  const detected = detectFromRules(html, normalizedHtml, scriptSources);
  if (detected) {
    return detected;
  }

  return {
    name: "Unknown",
    version: null,
    meta: null,
  };
}
