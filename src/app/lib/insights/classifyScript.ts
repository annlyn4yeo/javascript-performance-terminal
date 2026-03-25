import type { MergedScript } from "../mergeResults";

export type Category =
  | "framework"
  | "analytics"
  | "ab-testing"
  | "payments"
  | "ads"
  | "support"
  | "cdn"
  | "monitoring"
  | "unknown";

export type ScriptIntent = {
  category: Category;
  label: string;
};

type ClassificationRule = {
  category: Exclude<Category, "unknown">;
  label: string;
  patterns: string[];
};

const RULES: ClassificationRule[] = [
  {
    category: "framework",
    label: "React",
    patterns: ["react"],
  },
  {
    category: "framework",
    label: "Vue",
    patterns: ["vue"],
  },
  {
    category: "framework",
    label: "Angular",
    patterns: ["angular"],
  },
  {
    category: "framework",
    label: "Svelte",
    patterns: ["svelte"],
  },
  {
    category: "framework",
    label: "Next.js",
    patterns: ["next"],
  },
  {
    category: "framework",
    label: "Nuxt",
    patterns: ["nuxt"],
  },
  {
    category: "framework",
    label: "Ember",
    patterns: ["ember"],
  },
  {
    category: "framework",
    label: "Backbone",
    patterns: ["backbone"],
  },
  {
    category: "framework",
    label: "jQuery",
    patterns: ["jquery"],
  },
  {
    category: "analytics",
    label: "Analytics",
    patterns: [
      "gtm",
      "googletagmanager",
      "analytics",
      "segment",
      "mixpanel",
      "hotjar",
      "fullstory",
      "heap",
      "amplitude",
      "posthog",
      "clarity",
    ],
  },
  {
    category: "ab-testing",
    label: "A/B Testing",
    patterns: ["optimizely", "launchdarkly", "split.io", "vwo", "ab-tasty"],
  },
  {
    category: "payments",
    label: "Payments",
    patterns: ["stripe", "braintree", "paypal", "square", "adyen", "checkout"],
  },
  {
    category: "ads",
    label: "Advertising",
    patterns: [
      "doubleclick",
      "googlesyndication",
      "adroll",
      "criteo",
      "taboola",
      "outbrain",
      "pubmatic",
    ],
  },
  {
    category: "support",
    label: "Support / Chat",
    patterns: ["intercom", "zendesk", "freshdesk", "drift", "crisp", "hubspot"],
  },
  {
    category: "monitoring",
    label: "Error Monitoring",
    patterns: ["sentry", "datadog", "newrelic", "rollbar", "bugsnag", "raygun"],
  },
  {
    category: "cdn",
    label: "CDN",
    patterns: ["cloudfront", "fastly", "cloudflare", "jsdelivr", "unpkg", "cdnjs"],
  },
];

const UNKNOWN_INTENT: ScriptIntent = {
  category: "unknown",
  label: "Unknown",
};

export function classifyScript(
  script: Pick<MergedScript, "src">,
): ScriptIntent {
  const normalizedSrc = script.src.toLowerCase();

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => normalizedSrc.includes(pattern))) {
      return {
        category: rule.category,
        label: rule.label,
      };
    }
  }

  return UNKNOWN_INTENT;
}
