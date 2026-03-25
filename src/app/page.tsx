"use client";

import { FormEvent, useRef, useState } from "react";
import { OutputViewport } from "@/app/components/terminal/OutputViewport";
import { PromptBar } from "@/app/components/terminal/PromptBar";
import { TerminalHeader } from "@/app/components/terminal/TerminalHeader";
import { splitTiming, stripStatusPrefix } from "@/app/lib/terminal/format";
import type {
  OutputLine,
  ResultsPayload,
  StreamMessage,
} from "@/app/lib/terminal/types";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [resultsPayload, setResultsPayload] = useState<ResultsPayload | null>(
    null,
  );
  const [hasStarted, setHasStarted] = useState(false);
  const [completionTimeMs, setCompletionTimeMs] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const outputViewportRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUp = useRef(false);
  const submitTimeRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (userScrolledUp.current) {
        return;
      }

      bottomSentinelRef.current?.scrollIntoView({
        block: "end",
      });
    });
  };

  const handleScroll = () => {
    const viewport = outputViewportRef.current;

    if (!viewport) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    userScrolledUp.current = distanceFromBottom > 24;
  };

  const appendOutputLine = (line: OutputLine) => {
    setOutputLines((currentLines) => [...currentLines, line]);
    scrollToBottom();
  };

  const resolveActiveLine = (lineType: OutputLine["type"], message: string) => {
    const { cleanMessage, timingText } = splitTiming(message);
    let resolved = false;

    setOutputLines((currentLines) => {
      const nextLines = [...currentLines];

      for (let index = nextLines.length - 1; index >= 0; index -= 1) {
        if (!nextLines[index].isActive) {
          continue;
        }

        nextLines[index] = {
          ...nextLines[index],
          type: lineType,
          message: cleanMessage,
          isActive: false,
          timingText,
        };
        resolved = true;
        break;
      }

      if (!resolved) {
        nextLines.push({
          message: cleanMessage,
          type: lineType,
          isActive: false,
          timingText,
        });
      }

      return nextLines;
    });

    scrollToBottom();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedValue = inputValue.trim();

    if (!trimmedValue || isStreaming) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    userScrolledUp.current = false;
    submitTimeRef.current = Date.now();

    setHasStarted(true);
    setIsStreaming(true);
    setInputValue("");
    setResultsPayload(null);
    setCompletionTimeMs(null);
    setOutputLines([]);

    try {
      const response = await fetch(
        `/api/analyze?url=${encodeURIComponent(trimmedValue)}`,
        {
          method: "GET",
          signal: abortController.signal,
        },
      );

      if (!response.ok || !response.body) {
        appendOutputLine({
          type: "error",
          message: `Request failed with status ${response.status}`,
          isActive: false,
          timingText: null,
        });
        setIsStreaming(false);
        inputRef.current?.focus();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamCompleted = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (!streamCompleted) {
            appendOutputLine({
              type: "error",
              message: "Connection lost \u2014 try again",
              isActive: false,
              timingText: null,
            });
            setIsStreaming(false);
            inputRef.current?.focus();
          }
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
            scrollToBottom();
            continue;
          }

          if (parsedMessage.type === "done") {
            streamCompleted = true;
            setIsStreaming(false);
            setOutputLines((currentLines) =>
              currentLines.map((line) =>
                line.isActive ? { ...line, isActive: false } : line,
              ),
            );
            setCompletionTimeMs(
              submitTimeRef.current === null
                ? null
                : Date.now() - submitTimeRef.current,
            );
            scrollToBottom();
            inputRef.current?.focus();
            continue;
          }

          if (parsedMessage.type === "step") {
            appendOutputLine({
              type: "step",
              message: stripStatusPrefix(parsedMessage.message),
              isActive: true,
              timingText: null,
            });
            continue;
          }

          if (parsedMessage.type === "warning") {
            appendOutputLine({
              type: "warning",
              message: stripStatusPrefix(parsedMessage.message),
              isActive: false,
              timingText: null,
            });
            continue;
          }

          if (parsedMessage.type === "step-complete") {
            appendOutputLine({
              type: "step-complete",
              message: stripStatusPrefix(parsedMessage.message),
              isActive: false,
              timingText: null,
            });
            continue;
          }

          if (parsedMessage.type === "section-header") {
            appendOutputLine({
              type: "section-header",
              message: parsedMessage.message,
              isActive: false,
              timingText: null,
            });
            continue;
          }

          if (parsedMessage.type === "data-row") {
            appendOutputLine({
              type: "data-row",
              message: parsedMessage.message,
              isActive: false,
              timingText: null,
            });
            continue;
          }

          resolveActiveLine(parsedMessage.type, parsedMessage.message);
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        appendOutputLine({
          type: "error",
          message: "Unable to analyze the URL.",
          isActive: false,
          timingText: null,
        });
      }

      setIsStreaming(false);
      inputRef.current?.focus();
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TerminalHeader isStreaming={isStreaming} />

      <section className="flex min-h-0 flex-1 flex-col px-6 pb-6">
        <OutputViewport
          hasStarted={hasStarted}
          outputLines={outputLines}
          resultsPayload={resultsPayload}
          isStreaming={isStreaming}
          completionTimeMs={completionTimeMs}
          outputViewportRef={outputViewportRef}
          bottomSentinelRef={bottomSentinelRef}
          onScroll={handleScroll}
        />

        <PromptBar
          inputRef={inputRef}
          inputValue={inputValue}
          isStreaming={isStreaming}
          onSubmit={handleSubmit}
          onChange={(value) => {
            if (!hasStarted && value.length > 0) {
              setHasStarted(true);
            }

            setInputValue(value);
          }}
        />
      </section>
    </main>
  );
}
