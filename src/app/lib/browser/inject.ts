import type { Page } from "playwright";

export type InjectedLongTask = {
  duration: number;
  startTime: number;
  attribution: string;
};

export type InjectedData = {
  longTasks: InjectedLongTask[];
  navStart: number;
};

declare global {
  interface Window {
    __longTasks?: InjectedLongTask[];
    __navStart?: number;
  }
}

export function injectObservers(): string {
  return `
    (() => {
      window.__longTasks = [];
      window.__navStart = performance.timeOrigin;

      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          window.__longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
            attribution: entry.attribution?.[0]?.name || 'unknown'
          });
        });
      });

      observer.observe({ entryTypes: ['longtask'] });
    })();
  `;
}

export async function readInjectedData(page: Page): Promise<InjectedData> {
  return page.evaluate(() => ({
    longTasks: window.__longTasks ?? [],
    navStart: window.__navStart ?? 0,
  }));
}
