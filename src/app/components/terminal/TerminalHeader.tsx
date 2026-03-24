type TerminalHeaderProps = {
  isStreaming: boolean;
};

export function TerminalHeader({ isStreaming }: TerminalHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-5 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "#FF5F57" }}
            aria-hidden="true"
          />
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "#FFBD2E" }}
            aria-hidden="true"
          />
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "#28C840" }}
            aria-hidden="true"
          />
        </div>
        <span className="text-[#F59E0B]">jsperf</span>
      </div>
    </header>
  );
}
