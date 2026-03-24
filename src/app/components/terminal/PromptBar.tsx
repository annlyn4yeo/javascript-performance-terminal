type PromptBarProps = {
  inputRef: React.RefObject<HTMLInputElement>;
  inputValue: string;
  isStreaming: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (value: string) => void;
};

export function PromptBar({
  inputRef,
  inputValue,
  isStreaming,
  onSubmit,
  onChange,
}: PromptBarProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[880px] py-3 text-[15px] leading-7"
    >
      <div className="flex items-center gap-3">
        <span className="text-[#F59E0B]">$</span>
        <span className="text-neutral-400">analyze</span>
        <span className="text-[#F59E0B]">{"\u203A"}</span>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://example.com"
          className="w-full bg-transparent text-foreground outline-none placeholder:text-[#333333]"
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
