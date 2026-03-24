"use client";

import { FormEvent, useRef, useState } from "react";
import type { FrameworkDetection } from "@/app/lib/detectFramework";
import type { MeasuredScriptTag } from "@/app/lib/measureScripts";

type OutputLine = {
  message: string;
  type: "step" | "result" | "error";
};

type ResultsPayload = {
  scripts: MeasuredScriptTag[];
  framework: FrameworkDetection;
};

type StreamMessage =
  | { type: "step"; message: string }
  | { type: "result"; message: string }
  | { type: "error"; message: string }
  | { type: "results"; payload: ResultsPayload }
  | { type: "done" };

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [resultsPayload, setResultsPayload] = useState<ResultsPayload | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (!outputRef.current) {
        return;
      }

      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    });
  };

  const appendOutputLine = (line: OutputLine) => {
    setOutputLines((currentLines) => [...currentLines, line]);
    scrollToBottom();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedValue = inputValue.trim();

    if (!trimmedValue) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsStreaming(true);
    setInputValue("");
    setResultsPayload(null);

    try {
      const response = await fetch(`/api/analyze?url=${encodeURIComponent(trimmedValue)}`, {
        method: "GET",
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        appendOutputLine({
          type: "error",
          message: `Request failed with status ${response.status}`,
        });
        setIsStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventChunk of events) {
          const dataLine = eventChunk
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (!dataLine) {
            continue;
          }

          const parsedMessage = JSON.parse(dataLine.slice(6)) as StreamMessage;

          if (parsedMessage.type === "results") {
            setResultsPayload(parsedMessage.payload);
            console.log("Phase 1 results", parsedMessage.payload);
            continue;
          }

          if (parsedMessage.type === "done") {
            setIsStreaming(false);
            scrollToBottom();
            continue;
          }

          appendOutputLine(parsedMessage);
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        appendOutputLine({
          type: "error",
          message: "Unable to analyze the URL.",
        });
      }

      setIsStreaming(false);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  const lineColorClass = (type: OutputLine["type"]) => {
    if (type === "result") {
      return "text-[#F59E0B]";
    }

    if (type === "error") {
      return "text-[#EF4444]";
    }

    return "text-foreground";
  };

  return (
    <main
      className="flex min-h-screen flex-col bg-background text-foreground"
      data-has-results={resultsPayload ? "true" : "false"}
    >
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
                  <div
                    key={`${line.message}-${index}`}
                    className={`min-h-6 whitespace-pre-wrap break-words ${lineColorClass(line.type)}`}
                  >
                    {line.message}
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
