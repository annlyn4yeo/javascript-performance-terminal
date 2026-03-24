"use client";

import { FormEvent, useRef, useState } from "react";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (!outputRef.current) {
        return;
      }

      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setIsStreaming(true);
    setOutputLines((currentLines) => [...currentLines, "\u25B6 Fetching page..."]);
    setInputValue("");
    scrollToBottom();

    timeoutRef.current = window.setTimeout(() => {
      setIsStreaming(false);
      timeoutRef.current = null;
      scrollToBottom();
    }, 1200);
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 px-6 py-5 text-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" aria-hidden="true" />
        <span className="text-[#F59E0B]">jsperf</span>
      </header>

      <section
        className={`flex flex-1 flex-col px-6 pb-6 ${
          outputLines.length === 0 ? "items-center justify-center" : "justify-start"
        }`}
      >
        <div className="flex w-full max-w-[680px] flex-col gap-6">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 rounded-md border border-[#1F1F1F] bg-[#0A0A0A] px-4 py-3"
          >
            <span className="text-[#F59E0B]">$</span>
            <span className="text-neutral-300">analyze</span>
            <span className="text-[#F59E0B]">{"\u203A"}</span>
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="https://example.com"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-neutral-600"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              aria-label="Analyze URL"
            />
          </form>

          {outputLines.length > 0 ? (
            <div
              ref={outputRef}
              className="max-h-[40vh] overflow-y-auto rounded-md border border-[#1F1F1F] bg-[#0C0C0C] px-4 py-3"
            >
              {outputLines.map((line, index) => {
                const isLastLine = index === outputLines.length - 1;

                return (
                  <div key={`${line}-${index}`} className="min-h-6 whitespace-pre-wrap break-words">
                    {line}
                    {isStreaming && isLastLine ? (
                      <span
                        className="terminal-cursor ml-1 inline-block h-5 w-2 align-[-3px]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
