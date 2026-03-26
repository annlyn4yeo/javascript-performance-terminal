import chromium from "@sparticuz/chromium";
import type { Browser } from "playwright";

const BASE_CHROMIUM_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

let browserPromise: Promise<Browser> | null = null;

const isServerlessRuntime = Boolean(process.env.VERCEL);

const formatLaunchError = (rawMessage: string): string => {
  if (rawMessage.includes("libnss3.so")) {
    return [
      "Failed to launch Playwright Chromium in the serverless runtime: missing Linux shared library libnss3.so.",
      "This usually means a runtime/binary mismatch.",
      "Fix by pinning Vercel to Node.js 20.x and using a recent @sparticuz/chromium release compatible with Amazon Linux 2023.",
      `Original error: ${rawMessage}`,
    ].join(" ");
  }

  return `Failed to launch Playwright Chromium. Ensure Playwright is installed. If running on Vercel, include @sparticuz/chromium files in Next output tracing. Original error: ${rawMessage}`;
};

const launchBrowser = async (): Promise<Browser> => {
  try {
    const { chromium: playwrightChromium } = await import("playwright");

    if (isServerlessRuntime) {
      const executablePath = await chromium.executablePath(process.env.CHROMIUM_PACK_URL);

      return await playwrightChromium.launch({
        headless: true,
        args: chromium.args,
        executablePath,
      });
    }

    return await playwrightChromium.launch({
      headless: true,
      args: BASE_CHROMIUM_LAUNCH_ARGS,
    });
  } catch (error) {
    browserPromise = null;

    const message = error instanceof Error ? error.message : "Unknown Playwright launch error";
    throw new Error(formatLaunchError(message));
  }
};

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }

  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) {
    return;
  }

  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}
