import type { Page } from "playwright";

import { getBrowser } from "./worker";

const MAX_CONCURRENT_PAGES = 3;

let activePageCount = 0;
const waitQueue: Array<() => void> = [];

const logActiveCount = (action: "acquire" | "release") => {
  console.log(`[playwright-pool] ${action} active=${activePageCount} queued=${waitQueue.length}`);
};

const waitForSlot = async () => {
  if (activePageCount < MAX_CONCURRENT_PAGES) {
    return;
  }

  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
};

const releaseSlot = () => {
  activePageCount = Math.max(0, activePageCount - 1);
  logActiveCount("release");

  const next = waitQueue.shift();
  if (next) {
    next();
  }
};

export async function acquirePage(): Promise<Page> {
  await waitForSlot();
  activePageCount += 1;
  logActiveCount("acquire");

  try {
    const browser = await getBrowser();
    return await browser.newPage();
  } catch (error) {
    releaseSlot();
    throw error;
  }
}

export async function releasePage(page: Page): Promise<void> {
  try {
    await page.close();
  } finally {
    releaseSlot();
  }
}
