import type { FormEvent, RefObject } from "react";
import {
  TERMINAL_PLACEHOLDER_DARK_MUTED_CLASS,
  TERMINAL_TEXT_WARNING_CLASS,
} from "@/app/lib/constants";

type PromptBarProps = {
  inputRef: RefObject<HTMLInputElement>;
  inputValue: string;
  isStreaming: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: string) => void;
};

export function PromptBar({
  inputRef,
  inputValue,
  isStreaming,
  onSubmit,
  onChange,
}: PromptBarProps): JSX.Element {
  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[880px] py-3 text-[15px] leading-7"
    >
      <div className="flex items-center gap-3">
        <span className={TERMINAL_TEXT_WARNING_CLASS}>$</span>
        <span className="text-neutral-400">analyze</span>
        <span className={TERMINAL_TEXT_WARNING_CLASS}>{"\u203A"}</span>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://example.com"
          className={`w-full bg-transparent text-foreground outline-none ${TERMINAL_PLACEHOLDER_DARK_MUTED_CLASS}`}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="Analyze URL"
          disabled={isStreaming}
        />
      </div>
    </form>
  );
}
