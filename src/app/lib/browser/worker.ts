import chromium from "@sparticuz/chromium";
import type { Browser } from "playwright";

const BASE_CHROMIUM_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

const CHROMIUM_LAUNCH_ARGS =
  process.platform === "linux"
    ? [...BASE_CHROMIUM_LAUNCH_ARGS, "--single-process"]
    : BASE_CHROMIUM_LAUNCH_ARGS;

let browserPromise: Promise<Browser> | null = null;

const launchBrowser = async (): Promise<Browser> => {
  try {
    if (process.env.VERCEL) {
      const { chromium: playwrightChromium } = await import("playwright");

      return await playwrightChromium.launch({
        headless: true,
        args: [...chromium.args, ...CHROMIUM_LAUNCH_ARGS],
        executablePath: await chromium.executablePath(),
      });
    }

    const { chromium: playwrightChromium } = await import("playwright");

    return await playwrightChromium.launch({
      headless: true,
      args: CHROMIUM_LAUNCH_ARGS,
    });
  } catch (error) {
    browserPromise = null;

    const message = error instanceof Error ? error.message : "Unknown Playwright launch error";

    throw new Error(
      `Failed to launch Playwright Chromium. Ensure Playwright is installed and run "npx playwright install chromium". Original error: ${message}`,
    );
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
